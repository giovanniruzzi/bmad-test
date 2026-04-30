// Mirror of api/src/db.ts's Task type. Boundary mapping happens server-side
// (architecture.md#4.5) — the JSON wire format is the contract here.
export type Task = {
  id: number;
  description: string;
  completed: boolean;
  createdAt: string;
};

// Shared error-message extractor used by createTask, toggleTask, deleteTask.
// Tries the {error: string} JSON shape (the API's documented contract per
// architecture.md#4.4) and falls back to "${status} ${statusText}" on
// non-JSON bodies (e.g. 502 from a misconfigured proxy, empty 504, etc.).
// Not exported — internal to this module. Not extracted to a separate file
// because there are exactly three callers and they all live in api.ts
// (architecture.md#5.3 — extract on third repetition; do not pre-extract).
async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (
      body !== null &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
    ) {
      return (body as { error: string }).error;
    }
  } catch {
    // Non-JSON body — fall through to the status-text fallback.
  }
  return `${response.status} ${response.statusText}`;
}

// Same-origin contract: relative URL only (architecture.md#3.4, #4.2).
// In dev, Vite's server.proxy forwards /api/* to localhost:3000.
// In prod, Caddy serves web/dist and proxies /api/* to the api container.
export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks');
  if (!response.ok) {
    throw new Error(`GET /api/tasks failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as Task[];
}

// POST /api/tasks — create one task. The Content-Type header is REQUIRED;
// without it Express's express.json() does not populate req.body and the
// server returns 400 "description must be a string" (Story 2.1 AC #5).
export async function createTask(description: string): Promise<Task> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!response.ok) {
    throw new Error(`POST /api/tasks failed: ${await parseError(response)}`);
  }
  return (await response.json()) as Task;
}

// PATCH /api/tasks/:id — flips the completed flag and returns the full
// updated Task. Caller (App.tsx handleToggle) replaces the matching task in
// local state with the returned object — server is the source of truth. No
// optimistic UI here (Story 3.4 territory).
export async function toggleTask(id: number, completed: boolean): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  if (!response.ok) {
    throw new Error(`PATCH /api/tasks/${id} failed: ${await parseError(response)}`);
  }
  return (await response.json()) as Task;
}

// DELETE /api/tasks/:id — remove one task. No request body, no Content-Type
// header. Server returns 204 on success — do NOT call response.json() on
// success (would throw SyntaxError on the empty body). Caller (App.tsx
// handleDelete) filters the task out of local state on resolve.
export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`DELETE /api/tasks/${id} failed: ${await parseError(response)}`);
  }
}
