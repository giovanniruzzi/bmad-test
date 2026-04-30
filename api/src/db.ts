import { Pool } from 'pg';

export type Task = {
  id: number;
  description: string;
  completed: boolean;
  createdAt: string;
};

// Single pool for the lifetime of the process. Default settings are correct
// for one user and one container; do not tune (architecture.md#3.3).
// statement_timeout caps any single query at 10s so a hung query cannot
// exhaust all 10 pool connections with no recovery.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required but not set');
}
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  statement_timeout: 10_000,
});

// Without this, an idle-client error from pg crashes the process via an
// unhandled 'error' event. Logging is sufficient — pg removes the bad client
// from the pool automatically.
pool.on('error', (err) => {
  console.error('Unexpected idle pg client error:', err);
});

// Block startup until Postgres responds. Retries 30 times at 1 s intervals,
// then throws. Caller (server.ts) MUST await this before app.listen(...).
export async function waitForDb(): Promise<void> {
  const maxAttempts = 30;
  const delayMs = 1000;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      lastErr = err;
      console.log(`Waiting for database... (${attempt}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
  console.error(
    `Failed to connect to database after ${maxAttempts} attempts: ${message}`,
  );
  throw lastErr;
}

// One-table, four-column read. owner_id is intentionally NOT selected
// (architecture.md#4.1, #4.2 — omitted from API JSON in Phase 0).
export async function listTasks(): Promise<Task[]> {
  const { rows } = await pool.query<{
    id: string;
    description: string;
    completed: boolean;
    created_at: Date;
  }>('SELECT id, description, completed, created_at FROM tasks ORDER BY id ASC');

  // Boundary mapping: snake_case DB → camelCase JSON. Happens here exactly
  // once in the codebase (architecture.md#4.5).
  return rows.map((row) => ({
    id: Number(row.id),
    description: row.description,
    completed: row.completed,
    createdAt: row.created_at.toISOString(),
  }));
}

// Single-statement insert with RETURNING — one round-trip, no follow-up SELECT.
// owner_id is intentionally NOT in the RETURNING list (architecture.md#4.1,
// #4.2 — omitted from API JSON in Phase 0). Same column list and same
// snake_case → camelCase mapping as listTasks (architecture.md#4.5 — boundary
// mapping in one place). Caller is responsible for validating `description`
// (server.ts route handler does this); db.ts trusts its caller. SQL injection
// is prevented by the $1 placeholder, never by string interpolation.
export async function createTask(description: string): Promise<Task> {
  const { rows } = await pool.query<{
    id: string;
    description: string;
    completed: boolean;
    created_at: Date;
  }>(
    'INSERT INTO tasks (description) VALUES ($1) RETURNING id, description, completed, created_at',
    [description],
  );
  // INSERT ... RETURNING with no WHERE clause always returns exactly one row.
  // The non-null assertion is safe (and required by noUncheckedIndexedAccess).
  const row = rows[0]!;
  return {
    id: Number(row.id),
    description: row.description,
    completed: row.completed,
    createdAt: row.created_at.toISOString(),
  };
}

// Single-statement update with RETURNING — one round-trip, no follow-up
// SELECT. Returns null when no row matches (route handler converts to 404).
// Returns the FULL post-update Task otherwise (route handler returns 200 +
// body). owner_id is intentionally NOT touched (architecture.md#4.1 —
// single-user Phase 0). Same column list and same snake_case → camelCase
// mapping as listTasks / createTask (architecture.md#4.5 — boundary mapping
// in one place). Caller (server.ts route handler) is responsible for
// validating `id` and `completed`; db.ts trusts its caller. SQL injection
// is prevented by the $1/$2 placeholders, never by string interpolation.
export async function toggleTask(
  id: number,
  completed: boolean,
): Promise<Task | null> {
  const { rows } = await pool.query<{
    id: string;
    description: string;
    completed: boolean;
    created_at: Date;
  }>(
    'UPDATE tasks SET completed = $2 WHERE id = $1 RETURNING id, description, completed, created_at',
    [id, completed],
  );
  // UPDATE ... RETURNING returns 0 rows when WHERE matches nothing.
  // noUncheckedIndexedAccess types rows[0] as the row shape | undefined.
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    id: Number(row.id),
    description: row.description,
    completed: row.completed,
    createdAt: row.created_at.toISOString(),
  };
}
