# Story 1.2: Database schema and `init.sql` bootstrap

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the builder,
I want the `tasks` table schema defined as a single `CREATE TABLE` statement that Postgres runs automatically on first boot,
so that no migration framework is needed and the schema is reproducible from a `pg_dump` recipient.

## Acceptance Criteria

1. A new file `db/init.sql` exists at the repository root path `db/init.sql`. It contains a single `CREATE TABLE IF NOT EXISTS tasks` statement that matches Architecture §3.3 **byte-for-byte** on the column definitions: `id BIGSERIAL PRIMARY KEY`, `description TEXT NOT NULL CHECK (length(description) > 0 AND length(description) <= 500)`, `completed BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `owner_id BIGINT NULL`.
2. The `owner_id` column appears literally as `owner_id BIGINT NULL` and is immediately followed (on the same line as a trailing SQL comment, or on the next line as a `--` SQL comment) by a note stating it is reserved for Phase 1 auth and references PRD FR13 (e.g., `-- Reserved for Phase 1 auth (PRD FR13). Always NULL in Phase 0.`).
3. `db/init.sql` contains **only** the single `CREATE TABLE IF NOT EXISTS tasks` statement (plus optional file-header comments and the `owner_id` inline comment from AC #2). It does **not** create indexes (the `BIGSERIAL PRIMARY KEY` already creates the only index Phase 0 needs), does **not** create additional tables, does **not** issue `INSERT` seed data, does **not** define functions, triggers, views, or roles, and does **not** issue `GRANT`/`REVOKE` statements.
4. The previously-created `db/.gitkeep` placeholder file is **deleted** in this story (the directory now has a real tracked file in `init.sql` and no longer needs the keep-marker).
5. `README.md` is updated to add a top-level `## Schema` section. The section documents every column of the `tasks` table in a Markdown table (or equivalent structured list) with at minimum: column name, SQL type, nullability (NOT NULL / NULL), default value (or "—"), and a short purpose description. Detail must be sufficient for a reader holding only `pg_dump` output of the schema to recreate the same `init.sql` from the README alone.
6. The README `## Schema` section explicitly notes that `owner_id` is nullable and reserved for Phase 1 auth (PRD FR13) and that it is **omitted from API JSON responses** in Phase 0 (per Architecture §4.2 / §4.1 boundary mapping).
7. The README `## Schema` section shows the canonical `CREATE TABLE` statement inside a fenced ` ```sql ` code block, matching `db/init.sql` exactly so the two cannot drift unnoticed during code review.
8. No migration framework or schema-versioning tool is added to the project. Specifically, none of the following appear anywhere in the repo as a dependency, devDependency, configuration file, directory, or generated artifact: Flyway, Liquibase, Prisma (Prisma Migrate, `schema.prisma`, `prisma/migrations/`), Drizzle (`drizzle.config.ts`, `drizzle/migrations/`), TypeORM migrations, Sequelize migrations, Knex migrations, `node-pg-migrate`, `db-migrate`, `pg-migrator`, `umzug`, Atlas. No new package is added to either `api/package.json` or `web/package.json` in this story.
9. No `migrations/` directory is created at the repository root or anywhere else in the tree (per Architecture §5.3: "If any of these appears in the Phase 0 codebase, it is a discipline-thesis violation").
10. No code in `api/src/` is modified to attempt to run schema creation at startup. Schema bootstrap is the exclusive responsibility of Postgres mounting `db/init.sql` into `/docker-entrypoint-initdb.d/`. The `api/src/db.ts` placeholder created in Story 1.1 remains untouched in this story (changes to `db.ts` belong to Story 1.3).
11. **Static SQL verification** (since no Postgres container exists yet — Story 1.5 owns Compose): `db/init.sql` parses without syntax errors when fed to a SQL syntax checker. The dev agent verifies this by running one of the following locally (whichever is available):
    - **Preferred:** `docker run --rm -v "$PWD/db:/sql" postgres:17-alpine sh -c "postgres -D /tmp/d --version && pg_ctl init -D /tmp/d -o '-A trust' && pg_ctl start -D /tmp/d -l /tmp/log && createdb -h localhost -U postgres tasky_smoke && psql -h localhost -U postgres -d tasky_smoke -f /sql/init.sql && psql -h localhost -U postgres -d tasky_smoke -c '\d tasks' && pg_ctl stop -D /tmp/d"` (one-shot ephemeral Postgres 17 container; succeeds with exit code 0; stdout shows the `tasks` table definition).
    - **Acceptable fallback:** `docker run --rm -i postgres:17-alpine psql -X --set ON_ERROR_STOP=1 -d "host=/tmp port=0" 2>&1 | head` is **not** sufficient — fallback only when Docker is unavailable: log the SQL file contents to the Debug Log References and assert by visual diff against Architecture §3.3 that every character matches. Document in Completion Notes which path was used and why.

## Tasks / Subtasks

- [x] **Task 1: Author `db/init.sql` with the locked schema** (AC: #1, #2, #3)
  - [x] Open the project root at `/Users/gio/Source/bmad-test/`.
  - [x] Create the file `db/init.sql` (do NOT modify any existing files in this task).
  - [x] Write a short file-header comment block (3–5 lines) stating: file purpose ("Tasky Phase 0 schema — bootstrapped by Postgres on first volume init"), how it is consumed (mounted into `/docker-entrypoint-initdb.d/` by `docker-compose.yml` in Story 1.5), and the cross-reference to `README.md` `## Schema` for human-readable column docs. Use `--` line comments (not `/* */` blocks) for grep-friendliness.
  - [x] Below the header, write **exactly one** `CREATE TABLE IF NOT EXISTS tasks (...)` statement with the five columns listed in Architecture §3.3, in the exact order: `id`, `description`, `completed`, `created_at`, `owner_id`. Match the column types, constraints, and defaults character-for-character against the locked schema in Architecture §3.3 (see Dev Notes → "Locked schema — paste this verbatim").
  - [x] On (or directly after) the `owner_id` line, add a `-- Reserved for Phase 1 auth (PRD FR13). Always NULL in Phase 0.` comment so the intent is visible inside the SQL file itself.
  - [x] Confirm the file contains **no other DDL**: no `CREATE INDEX`, no other `CREATE TABLE`, no `CREATE FUNCTION`, no `CREATE TRIGGER`, no `CREATE VIEW`, no `CREATE ROLE`, no `GRANT`/`REVOKE`, no `INSERT`, no `ALTER`. The only allowed top-level statement is the single `CREATE TABLE IF NOT EXISTS tasks (...)`.
  - [x] Save the file with a trailing newline (POSIX convention; prevents some `psql` warnings).

- [x] **Task 2: Remove the `db/.gitkeep` placeholder** (AC: #4)
  - [x] `git rm db/.gitkeep` from the project root (or delete via filesystem and `git add db/`).
  - [x] Confirm `ls -A1 db/` now shows only `init.sql`.

- [x] **Task 3: Verify the SQL parses (static verification)** (AC: #11)
  - [x] Attempt the **preferred** verification: spin up an ephemeral Postgres 17 Docker container, load `db/init.sql`, and run `\d tasks` to confirm the table exists with the expected columns. The exact one-liner is in AC #11 above; adapt to the local Docker setup.
  - [x] If the preferred verification succeeds, capture the `\d tasks` output to `Debug Log References` in the Dev Agent Record.
  - [x] If Docker is unavailable, use the fallback: paste the full contents of `db/init.sql` into `Debug Log References` and assert (in `Completion Notes`) that every character matches Architecture §3.3's locked schema. Document why Docker was unavailable. *(Not needed — Path A succeeded.)*
  - [x] **Do not** create any persistent test database, named volume, or `.gitignored` runtime artifact in this task — verification is ephemeral and leaves zero on-disk trace beyond log entries.

- [x] **Task 4: Update `README.md` with the `## Schema` section** (AC: #5, #6, #7)
  - [x] Open `README.md` at the project root.
  - [x] Insert a new top-level section `## Schema` **after** the existing repository line (`Repository: https://github.com/giovanniruzzi/bmad-test`) and before any other section (the README is currently a 5-line stub, so this section becomes the second top-level section).
  - [x] Inside `## Schema`, write a one-sentence intro framing what the section covers (e.g., "Phase 0 ships a single `tasks` table. The schema is bootstrapped by Postgres on first volume initialization from `db/init.sql`.").
  - [x] Add a Markdown table (or fenced `sql` code block plus a per-column list) documenting all five columns. Required columns of the documentation table: **Column**, **Type**, **Nullability**, **Default**, **Purpose**. Pull the values directly from `db/init.sql` so the README cannot drift; if you change one, change the other in the same commit.
  - [x] Below the column table, add a fenced ` ```sql ` code block containing the canonical `CREATE TABLE IF NOT EXISTS tasks (...)` statement that matches `db/init.sql` byte-for-byte (excluding file-header comments — only the `CREATE TABLE` statement itself).
  - [x] Add an explicit note paragraph: `> \`owner_id\` is nullable and reserved for Phase 1 multi-user auth (PRD FR13). It is always NULL in Phase 0 and is omitted from API JSON responses (Architecture §4.1, §4.2).`
  - [x] **Do not** add Quickstart, Deploy, API endpoint table, or Phase 0 gaps content — those sections are owned by Story 3.3 (Distribution-ready README). This story adds *only* the `## Schema` section.

- [x] **Task 5: Verify no migration framework leaked in** (AC: #8, #9, #10)
  - [x] Run `cat api/package.json` and confirm `dependencies` and `devDependencies` are unchanged from Story 1.1's final state (`express`, `pg` in deps; `typescript`, `@types/node`, `@types/express`, `tsx` in devDeps). No new keys.
  - [x] Run `cat web/package.json` and confirm dependencies are unchanged from Story 1.1's Vite-template state.
  - [x] Run `find . -path ./node_modules -prune -o -path './_bmad*' -prune -o -path './web/node_modules' -prune -o -path './api/node_modules' -prune -o -name 'migrations' -print -o -name 'schema.prisma' -print -o -name 'drizzle.config.*' -print 2>/dev/null` and confirm zero matches outside ignored paths.
  - [x] Open `api/src/db.ts` and confirm it still contains only the Story 1.1 placeholder (`// TODO: Story 1.2 / 1.3 — pg.Pool + listTasks/createTask/toggleTask/deleteTask` + `export {};`). Do **not** modify this file in this story.
  - [x] Open `api/src/server.ts` and confirm it still contains only the Story 1.1 placeholder. Do **not** modify this file.

- [x] **Task 6: Final integrity check before declaring done** (AC: all)
  - [x] `git status` shows: `db/init.sql` (new, staged), `db/.gitkeep` (deleted, staged), `README.md` (modified, staged). Nothing else changed by this story.
  - [x] `git diff --staged db/init.sql` matches the locked schema in Dev Notes → "Locked schema — paste this verbatim" character-for-character.
  - [x] `git diff --staged README.md` adds the `## Schema` section and nothing else.
  - [x] No new files appear in the project root, `api/`, `web/`, or `e2e/` directories. Specifically: no `package.json` was created at the project root by this story. *(A pre-existing root `package.json` may exist from prior unrelated work — see Dev Notes → "Pre-existing repo state to be aware of"; do not remove it in this story.)*
  - [x] Commit with a message such as `feat(db): add tasks schema and init.sql bootstrap (Story 1.2)`. Do not push (push is a manual builder action, not a dev-agent action — same convention as Story 1.1 Task 9).

## Dev Notes

### Locked schema — paste this verbatim into `db/init.sql`

[Source: architecture.md#3.3]

This is the single source of truth for the schema. `db/init.sql` and the `## Schema` section of `README.md` must both reproduce this exactly. If you find yourself "improving" it, stop and consult — drift here breaks `pg_dump` reproducibility (FR39) and the Phase 1 auth migration path (FR13).

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          BIGSERIAL PRIMARY KEY,
  description TEXT NOT NULL CHECK (length(description) > 0 AND length(description) <= 500),
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id    BIGINT NULL  -- Reserved for Phase 1 auth (PRD FR13). Always NULL in Phase 0.
);
```

Notes on each line (do not put these notes inside the SQL — they explain the design for the reader of this story; the SQL itself only carries the one `owner_id` comment from AC #2):

- `id BIGSERIAL PRIMARY KEY`: 64-bit auto-incrementing integer. Postgres-native sequence. Fits cleanly in JSON `number` (safe up to 2^53). UUID/ULID would be theater for a single-user app — see Architecture §3.3.
- `description TEXT NOT NULL CHECK (length(description) > 0 AND length(description) <= 500)`: TEXT (not VARCHAR) because Postgres treats them identically for storage and `TEXT` carries no width-spec ceremony. The `CHECK` enforces the 1–500 char range that the API will also enforce in `server.ts` (Story 2.1 / 2.3 / 2.4). Defense-in-depth: the DB rejects garbage even if the API validation is bypassed.
- `completed BOOLEAN NOT NULL DEFAULT FALSE`: Always-set boolean. Default ensures `INSERT (description) VALUES (...)` works without specifying `completed`.
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`: Timezone-aware timestamp. Always UTC at the storage layer (Postgres normalizes `TIMESTAMPTZ` to UTC). The API serializes to ISO-8601 UTC strings (Architecture §4.2). Default ensures inserts don't need to provide it.
- `owner_id BIGINT NULL`: Nullable foreign-key-shaped column. Phase 0 always inserts NULL. Phase 1 will add a `users` table and a `REFERENCES users(id)` constraint without altering the column's type or nullability — that's the entire point of putting it here in Phase 0. **Do not** add `REFERENCES` in Phase 0 (no `users` table exists; would be a syntax error). **Do not** make it `NOT NULL` (would break Phase 0 inserts and force a coupled change in Phase 1).

### Why no migration framework

[Source: architecture.md#3.3, architecture.md#5.3, prd.md#FR39]

Phase 0 ships exactly one schema version. There is no `v2`. There is no `ALTER TABLE` migration. `pg_dump` of the running DB followed by `psql -f init.sql` of a fresh DB must produce identical tables — that *is* the durability story (NFR22, FR39).

A migration framework solves a problem that does not exist at this scale and would:

- Add a dependency the README has to mention.
- Force a `migrations/` directory the discipline thesis explicitly forbids (Architecture §5.3).
- Create a "where does the schema live?" ambiguity (in `init.sql`? in `migrations/`? both?) that didn't need to exist.
- Establish a Phase 0 commitment Phase 1 would have to either keep or rip out — the worst category of premature abstraction.

If Phase 1 needs schema changes, the answer is: write a one-off SQL script alongside `init.sql` and document the upgrade procedure in the README. That decision belongs to Phase 1, not now.

### Why `init.sql` lives in `db/` (not `api/db/init.sql` or `api/src/init.sql`)

[Source: architecture.md#5.1, architecture.md#3.3]

The Postgres official Docker image runs scripts mounted into `/docker-entrypoint-initdb.d/` exactly once, on first volume initialization. In Story 1.5, `docker-compose.yml` will mount `./db/init.sql` to `/docker-entrypoint-initdb.d/init.sql` on the `db` service. Keeping it under top-level `db/` (not under `api/`) makes that mount path obvious, keeps schema concerns out of application code, and lets the `db/` directory grow into a small home for any future SQL-only artifacts (`pg_dump` examples, restore scripts) without leaking SQL into `api/src/`.

### What this story does NOT touch

These are out of scope for Story 1.2 — touching them is scope creep. They belong to specific later stories:

- `api/src/db.ts` — the `pg.Pool` and the four query functions (`listTasks`, `createTask`, `toggleTask`, `deleteTask`) are **Story 1.3** (`listTasks`) and **Stories 2.1 / 2.3 / 2.4** (the three mutations).
- `api/src/server.ts` — Express setup, routes, error middleware, graceful shutdown are **Story 1.3**.
- `docker-compose.yml` and the actual mounting of `init.sql` into a running Postgres container — **Story 1.5**.
- README quickstart, API endpoint table, philosophy paragraph, screenshot, Phase 0 gaps section — **Story 3.3**. This story only adds `## Schema`.
- Indexes beyond the primary key — none planned for Phase 0; revisit only if a real query pattern justifies it (none in Phase 0 does, since the largest list query is "all rows" and a hundred-row table is trivially seq-scanned).

### Pre-existing repo state to be aware of

[Source: filesystem inspection at story creation time, 2026-04-29]

- A stray top-level `package.json` exists at the project root (`/Users/gio/Source/bmad-test/package.json`). It was **not** created by Story 1.1 and is **not** part of the Architecture §5.1 file tree — it is leftover from earlier exploration. **Do not remove it in this story** (out of scope; not introduced by this story; would create unrelated diff noise). If it bothers you, raise it as a separate cleanup task. The Story 1.1 AC #1 invariant ("no top-level `package.json`") is technically violated by this file, but Story 1.2 does not own that violation.
- The current `README.md` is exactly 5 lines: title, blank, description, blank, repository line. The `## Schema` insertion (Task 4) goes after the repository line.
- `db/.gitkeep` exists from Story 1.1 Task 3 and is removed in this story (AC #4).
- `api/src/db.ts` and `api/src/server.ts` exist as Story 1.1 placeholders — **leave them untouched** (Task 5).
- The git working tree may not be clean before this story starts. Begin by inspecting `git status` and noting any pre-existing modifications that are not yours to touch.

### Naming and SQL style conventions

[Source: architecture.md#4.1, architecture.md#3.3]

- DB identifiers: `snake_case`. Both column names and the table name follow this (`tasks`, `created_at`, `owner_id`). The boundary mapping to JSON `camelCase` happens once in the API response builder (Story 2.1) — **not** in the schema.
- SQL keywords: UPPERCASE (`CREATE TABLE`, `NOT NULL`, `DEFAULT`, `CHECK`). Identifiers: lowercase. This matches the locked schema above and is the prevailing Postgres convention.
- Column alignment in `init.sql`: align type declarations vertically for readability (the locked schema above shows the alignment). It's noise-free in `git diff` for one-line edits and signals "this is a contract, not throwaway code."
- File: `db/init.sql` (one file, lowercase, no version suffix — there is no `init-v1.sql` or `001_init.sql` because there is no migration framework).

### Verification details (AC #11)

The story has no Postgres container available yet (Story 1.5 introduces Compose). Two acceptable verification paths:

**Path A — preferred (ephemeral Docker):**

```bash
# From project root. Creates and tears down an ephemeral Postgres 17 in one shot.
docker run --rm \
  -v "$PWD/db:/sql:ro" \
  -e POSTGRES_PASSWORD=verify \
  -e POSTGRES_DB=tasky_smoke \
  --health-cmd 'pg_isready -U postgres -d tasky_smoke' \
  --health-interval 1s \
  --health-timeout 1s \
  --health-retries 30 \
  --name tasky_init_smoke \
  -d postgres:17-alpine

# Wait for healthy, then load the SQL.
until [ "$(docker inspect -f '{{.State.Health.Status}}' tasky_init_smoke)" = "healthy" ]; do sleep 1; done
docker exec -i tasky_init_smoke psql -U postgres -d tasky_smoke -f /sql/init.sql
docker exec -i tasky_init_smoke psql -U postgres -d tasky_smoke -c '\d tasks'
docker stop tasky_init_smoke
```

The `\d tasks` output should show all five columns with the right types, NOT NULL flags, defaults, and the `tasks_description_check` constraint. Capture this output to Debug Log References.

**Path B — fallback (no Docker available):**

Read `db/init.sql` and visually diff against the locked schema above. Note in Completion Notes that Path B was used and why. Lower confidence than Path A, but the schema is small enough (one statement, five columns) that visual review is reliable.

### References

- [Source: epics.md#Story 1.2] — User story, acceptance criteria, scope boundaries.
- [Source: architecture.md#3.3] — Locked database schema; ID strategy rationale; persistence rationale; CHECK constraint rationale.
- [Source: architecture.md#3.4] — Mount path for `init.sql` (`/docker-entrypoint-initdb.d/`); Compose deferral to Story 1.5.
- [Source: architecture.md#4.1] — Naming convention boundary (snake_case DB → camelCase JSON); `owner_id` always omitted from API responses.
- [Source: architecture.md#4.2] — API response shape (no `owner_id`); justifies the README note (AC #6).
- [Source: architecture.md#5.1] — Repository layout: `db/init.sql` is the canonical location.
- [Source: architecture.md#5.3] — Explicit prohibition on `migrations/` and migration frameworks.
- [Source: prd.md#FR13] — Nullable `owner_id` for Phase 1 auth optionality.
- [Source: prd.md#FR38] — Schema field requirements (id, description, completed, created_at, nullable owner).
- [Source: prd.md#FR39] — Schema is documented in README at sufficient detail to recreate from `pg_dump` output.
- [Source: prd.md#NFR22] — `pg_dump`/`psql` is the backup/restore mechanism; cross-references the documented schema.
- [Source: 1-1-repository-scaffold-and-starter-templates.md] — Story 1.1 Dev Agent Record (file list confirms `db/.gitkeep` exists; placeholders in `api/src/` are untouchable in this story).

### Project Structure Notes

- The project root is `/Users/gio/Source/bmad-test/`. All paths above are relative to this root.
- After this story, `db/` contains exactly one tracked file: `init.sql`. The `.gitkeep` is gone (no longer needed once `init.sql` is the directory's reason to exist).
- The BMad scaffolding directories (`_bmad/`, `_bmad-output/`, `.agents/`, `docs/`) are unaffected by this story. Do not touch them.
- After this story, the only file in the entire repo that references the schema definition is `db/init.sql`. The README's `## Schema` section is human-readable documentation that mirrors the SQL — it is **not** a second source of truth, and any change to one must be made to the other in the same commit.

### Common mistakes to avoid

- ❌ Do **not** add `REFERENCES users(id)` to `owner_id`. There is no `users` table in Phase 0; it would be a syntax error. The whole point of `owner_id BIGINT NULL` is that Phase 1 adds the `REFERENCES` constraint later without altering the column.
- ❌ Do **not** add `NOT NULL` to `owner_id`. It must be nullable so Phase 0 inserts work without auth, and so Phase 1 can backfill `owner_id` for existing rows during the auth migration without a forced `NOT NULL` violation.
- ❌ Do **not** create indexes beyond the primary key. The `BIGSERIAL PRIMARY KEY` already creates a unique B-tree index. No other query in Phase 0 ranges or filters on a non-PK column.
- ❌ Do **not** add `CREATE EXTENSION` for `pgcrypto`, `uuid-ossp`, or anything else. Phase 0 uses no extensions. UUIDs are not used (see Architecture §3.3).
- ❌ Do **not** wrap the `CREATE TABLE` in `BEGIN; ... COMMIT;`. Postgres' `docker-entrypoint-initdb.d` runs each `.sql` file inside a single implicit transaction; an explicit transaction adds noise without changing semantics.
- ❌ Do **not** add `DROP TABLE IF EXISTS tasks;` before the `CREATE`. The `IF NOT EXISTS` guard is sufficient and safer (it makes accidental re-runs idempotent without nuking data).
- ❌ Do **not** modify `api/src/server.ts` or `api/src/db.ts`. They are Story 1.3 territory. This story is schema-only.
- ❌ Do **not** install any npm package. No `pg`-version bump, no schema-validation library, no `@types/*` change. Run zero `npm install` commands in this story.
- ❌ Do **not** create a `db/seed.sql` or `db/sample-data.sql` file. Phase 0 has no seed data. The empty list IS the first-load experience.
- ❌ Do **not** write the README quickstart, API table, screenshot, or Phase 0 gaps. Story 3.3 owns the distribution-ready README. This story adds only `## Schema`.

## Dev Agent Record

### Agent Model Used

claude-opus-4.7 (github-copilot/claude-opus-4.7) via OpenCode CLI; bmad-dev-story workflow.

### Debug Log References

**Verification Path A (preferred): ephemeral `postgres:17-alpine` Docker container.**

Command summary: ran `postgres:17-alpine` with `db/` mounted to `/docker-entrypoint-initdb.d/:ro` and `POSTGRES_DB=tasky_smoke`; Postgres auto-applied `init.sql` on first boot; container reached `healthy` in 1 s. Container was started with `--rm`, then explicitly stopped after verification — no on-disk trace remained (verified via `docker ps -a --filter name=tasky_init_smoke`).

`\d tasks` output (proves AC #1, #2, #3, #11):

```
                                       Table "public.tasks"
   Column    |           Type           | Collation | Nullable |              Default
-------------+--------------------------+-----------+----------+-----------------------------------
 id          | bigint                   |           | not null | nextval('tasks_id_seq'::regclass)
 description | text                     |           | not null |
 completed   | boolean                  |           | not null | false
 created_at  | timestamp with time zone |           | not null | now()
 owner_id    | bigint                   |           |          |
Indexes:
    "tasks_pkey" PRIMARY KEY, btree (id)
Check constraints:
    "tasks_description_check" CHECK (length(description) > 0 AND length(description) <= 500)
```

Constraint definitions:

```
tasks_description_check :: CHECK (((length(description) > 0) AND (length(description) <= 500)))
tasks_pkey              :: PRIMARY KEY (id)
```

Boundary tests against the running ephemeral DB:

| Test                                                         | Expected | Actual                                                              |
| ------------------------------------------------------------ | -------- | ------------------------------------------------------------------- |
| `INSERT (description) VALUES ('hello')`                      | OK       | OK — `id=1, completed=f, owner_id=NULL, created_at` set by default. |
| `INSERT (description) VALUES ('')`                           | Reject   | `ERROR: violates check constraint "tasks_description_check"`        |
| `INSERT (description) VALUES (repeat('x', 501))`             | Reject   | `ERROR: violates check constraint "tasks_description_check"`        |
| `INSERT (description) VALUES (repeat('x', 500))`             | OK       | `INSERT 0 1`, `length=500`                                          |

These exercise the `description CHECK` constraint at both bounds (1, 500) and just outside both bounds (0, 501) — the constraint behaves exactly as the locked schema specifies.

### Completion Notes List

- **Verification used Path A (ephemeral Docker Postgres 17).** Docker daemon was not running at story start; launched Docker Desktop and waited until healthy (3 s) before running the verification. No fallback to Path B was needed.
- **Locked schema reproduced byte-for-byte.** `db/init.sql` matches Architecture §3.3 character-for-character on the column definitions; the only additions are (a) the file-header comment block (specified by Task 1) and (b) the `owner_id` inline comment (specified by AC #2). Confirmed via `git diff --staged db/init.sql`.
- **README `## Schema` mirrors `init.sql`.** The fenced ` ```sql ` block in README contains the canonical `CREATE TABLE` statement (no header comments — only the DDL) so the two cannot drift unnoticed at code review time. Documented in the section intro that README and `init.sql` must be edited in the same commit.
- **No migration framework / no `migrations/` directory.** Verified: `api/package.json` and `web/package.json` are unchanged from Story 1.1; `find` for `migrations`, `schema.prisma`, `drizzle.config.*`, `knexfile.*`, `sequelize*.json` returned zero matches outside ignored paths. Zero `npm install` commands run.
- **`api/src/db.ts` and `api/src/server.ts` untouched.** Both still contain the Story 1.1 placeholders. They are Story 1.3 territory.
- **Pre-existing repo state preserved.** The stray top-level `package.json` (leftover from earlier exploration; not introduced by Story 1.1) was left in place per Dev Notes guidance — it is out of scope for Story 1.2 to remove. Same for the unrelated unstaged modifications to `.gitignore` and `1-1-...md` (pre-existing local edits not authored by this story).
- **Commit scope is exactly the story's authored files.** `feat(db): add tasks schema and init.sql bootstrap (Story 1.2)` (`0066527`) touches only `db/init.sql` (new), `db/.gitkeep` (deleted), `README.md` (modified). Not pushed (manual builder action, same convention as Story 1.1).
- **No tests/lints to run.** This story has no executable runtime code and no test framework is configured in the repo yet (Story 1.5+ territory). The AC #11 verification *is* the test — it ran a real Postgres 17 against the real `init.sql` and exercised the constraint at all four boundaries. No regressions possible because no prior code is changed.

### File List

| Path                  | Change   | Notes                                                                                  |
| --------------------- | -------- | -------------------------------------------------------------------------------------- |
| `db/init.sql`         | added    | Locked Phase 0 schema (single `CREATE TABLE IF NOT EXISTS tasks`); 14 lines incl. header. |
| `db/.gitkeep`         | deleted  | No longer needed once `init.sql` keeps the directory.                                  |
| `README.md`           | modified | Added `## Schema` section (column table, canonical SQL block, `owner_id` note). +26 lines. |

## Change Log

| Date       | Version | Change                                                                                                                                                                                            | Author |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-29 | 0.1     | Story drafted (ready-for-dev) by create-story workflow.                                                                                                                                           | PM     |
| 2026-04-29 | 1.0     | Story implemented. Created `db/init.sql` with locked Phase 0 schema, removed `db/.gitkeep`, added `## Schema` section to README. Verified via ephemeral Postgres 17 (Path A). Status → review. Commit `0066527`. | Dev    |
