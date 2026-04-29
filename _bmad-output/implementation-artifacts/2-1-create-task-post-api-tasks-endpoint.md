# Story 2.1: Create task — `POST /api/tasks` endpoint

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As any client (the frontend, `curl`, an iOS Shortcut, a cron job),
I want to create a new task by sending a JSON description to the API,
so that programmatic capture works at zero additional cost beyond the documented REST surface.

## Acceptance Criteria

1. **`api/src/db.ts` exports a new `createTask(description: string): Promise<Task>` function.** It is added to the existing module (do NOT replace `pool`, `Task`, `waitForDb`, or `listTasks` — they were locked by Story 1.3 and the file is now ~70 lines). The function executes a single parameterized `INSERT INTO tasks (description) VALUES ($1) RETURNING id, description, completed, created_at` query against the shared `pool` (re-using the snake_case → camelCase mapping pattern already established in `listTasks`). It returns the inserted row already mapped to the `Task` shape (camelCase, ISO-8601 string for `createdAt`, `id` coerced via `Number(...)`). The function MUST NOT do its own validation — input validation is the route handler's job (AC #4–#7); `createTask` trusts its caller. [Source: architecture.md#4.4, architecture.md#4.5, epics.md#Story 2.1]

2. **`createTask` uses `RETURNING` rather than a follow-up `SELECT`.** The Postgres `INSERT ... RETURNING ...` clause delivers the row's server-generated columns (`id`, `created_at`) and the persisted column values (`description`, `completed`) in a single round-trip. This matches `listTasks`'s explicit-column pattern (Story 1.3 AC #1) and prevents the most common mistake of doing two queries. **`owner_id` is NOT in the column list** — same omission rule as `listTasks` (Architecture §4.1, §4.2). The `RETURNING` list MUST be exactly `id, description, completed, created_at` in that order, so the `pool.query<{...}>` row generic stays parallel to `listTasks`'s. [Source: api/src/db.ts:54–69, architecture.md#4.1, architecture.md#4.2]

3. **`createTask`'s SQL string is a plain string literal — no template literals, no concatenation, no `${...}` interpolation.** Even though `description` looks "safe" in some cases, the parameterization rule from Story 1.3 AC #5 ("never string-interpolate user input; always use `pool.query(text, values)`") MUST hold here too: the value goes through the second argument (`[description]`), the placeholder is `$1`. SQL-injection prevention is the obvious reason; consistency with `listTasks`'s style is the secondary one. [Source: architecture.md#4.4, 1-3-...md AC #5]

4. **`api/src/server.ts` mounts a new `POST /api/tasks` route — and only that route is added.** It sits next to (after) the existing `GET /api/tasks` handler, BEFORE the error middleware (Express's error-middleware contract requires the four-argument middleware to remain last). The route handler is `async`, has signature `async (req: Request, res: Response, next: NextFunction) => { ... }`, awaits a call to `createTask(description)` from `./db.js` (note the `.js` suffix — `module: "nodenext"` requires it; same gotcha as Story 1.3), and on success responds with **HTTP 201** and the created `Task` JSON via `res.status(201).json(task)`. `Content-Type: application/json` is set automatically by `res.json()` — do not also set it manually. On any thrown DB error, the handler MUST forward via `next(err)` so the single error middleware (Story 1.3 AC #8) returns the 500. Mounting more than one new route in this story is scope creep (PATCH = Story 2.3, DELETE = Story 2.4). [Source: epics.md#Story 2.1, architecture.md#4.2, architecture.md#4.4, api/src/server.ts:14–21]

5. **The request body is read via `req.body.description` and validated manually — no Zod, no Joi, no Yup, no `express-validator`, no `class-validator`.** The Architecture mandates manual `typeof` and length checks for Phase 0 (§3.2 Backend → "Validation: Manual"; §4.4 → "Validation errors are thrown with a `.status = 400` property"). Concretely, the validation logic is exactly:

   ```ts
   const { description } = req.body ?? {};
   if (typeof description !== 'string') {
     const err = new Error('description must be a string');
     (err as Error & { status?: number }).status = 400;
     throw err;
   }
   if (description.length < 1 || description.length > 500) {
     const err = new Error('description must be between 1 and 500 characters');
     (err as Error & { status?: number }).status = 400;
     throw err;
   }
   ```

   The `req.body ?? {}` guard handles the case where `Content-Type` is not `application/json` and Express does not populate `req.body`. The pattern of throwing an `Error` with a `.status` property is the contract Story 1.3 AC #8 already implemented in the error middleware (`status < 500 ? err.message : 'Internal server error'`) — it MUST be reused so Phase 0 stays at one error middleware, not two. **Throw, do not `return res.status(400).json(...)` directly** — the latter would split error formatting across two places and bypass the single-source-of-truth `console.error(err)` log line. [Source: architecture.md#3.2, architecture.md#4.4, api/src/server.ts:23–31, epics.md#Story 2.1]

6. **Validation rules — exhaustive list (every condition that returns 400):**
   - Body parsed but `description` is missing (`undefined`) → 400 `description must be a string`
   - `description` is `null` → 400 `description must be a string` (`typeof null === 'object'`)
   - `description` is a number / boolean / array / object → 400 `description must be a string`
   - `description === ''` (empty string after parse) → 400 `description must be between 1 and 500 characters`
   - `description.length > 500` → 400 `description must be between 1 and 500 characters` (matches the DB `CHECK` in `db/init.sql` — defense-in-depth alignment, NOT a duplicate enforcement; the API MUST reject before the SQL would, so the user sees the clean 400 message and not a 500 from a `CheckViolation`).
   - **Length-counting unit asymmetry (intentional, not a bug):** JS `String.prototype.length` counts UTF-16 code units (so each emoji or other supplementary-plane character counts as 2); Postgres `length(text)` counts characters (each emoji counts as 1). A 251-emoji string has JS length 502 → API rejects it with 400; the DB `CHECK` would have allowed it (length 251). This means the API is *stricter* than the DB for non-BMP input, which is the correct direction (we never let through input the DB would reject; we just sometimes reject input the DB would accept). Do **not** "fix" this with `[...description].length` (Unicode code points) or `Array.from(new Intl.Segmenter().segment(description)).length` (grapheme clusters) — Phase 0 single-user, English-language workflow does not justify the complexity, and the asymmetry breaks no contract. Record it as known if the runtime smoke surprises you.
   - **Whitespace-only descriptions ARE accepted in this story.** The frontend (Story 2.2) trims and silently ignores empty/whitespace-only inputs at the UI; the server's job is the integrity bound (length 1–500 raw chars) only. Adding server-side `.trim()` would diverge from the DB `CHECK` (which uses `length(description)` on the raw text) and create a frontend-vs-API mismatch. [Source: db/init.sql:10, epics.md#Story 2.2 AC, epics.md#Story 2.1]
   - The express-thrown 400 cases (malformed JSON body, oversized body) are handled by the existing `express.json({ limit: '10kb' })` middleware (Story 1.3 AC #7) and surface as 400s through the same error middleware automatically — DO NOT add a separate try/catch around `express.json()` for them.

7. **Validation failure response shape:** HTTP 400 with body `{ "error": "<message>" }` — the same `{error: string}` shape as 5xx errors. The error middleware already produces this (Story 1.3 AC #8 logic: `res.status(status).json({ error: message })`). Concrete expected bodies for the bad-input cases:
   - missing/non-string description → `{"error":"description must be a string"}`
   - empty / over-500 description → `{"error":"description must be between 1 and 500 characters"}`
   - malformed JSON (Express's own `entity.parse.failed`) → `{"error":"<express's parse error message>"}` (the existing middleware leaks `err.message` for `status < 500`; this is the deferred Phase 0 trade-off recorded in `deferred-work.md` and is NOT to be changed in this story).
   No error codes, no `details` array, no field path — Phase 0 has one client and one developer; plain English is enough (Architecture §4.2). [Source: architecture.md#4.2, deferred-work.md, api/src/server.ts:26–31]

8. **Success response shape — HTTP 201 with the created task in camelCase JSON.** Body is exactly:

   ```json
   { "id": <number>, "description": "<string>", "completed": false, "createdAt": "<ISO-8601 UTC>" }
   ```

   Field rules:
   - `id` is a JSON number (matches `BIGSERIAL`; safe up to 2^53 — same caveat as `listTasks`, recorded in `deferred-work.md`). MUST be coerced via `Number(row.id)` because the `pg` driver returns BIGSERIAL as a string by default — same coercion `listTasks` uses.
   - `description` is the unmodified server-stored value (no trim, no normalization).
   - `completed` is the literal boolean `false`. The `RETURNING` list emits the persisted column value (which is `false` because the schema has `DEFAULT FALSE`). Do NOT hardcode the literal `false` in the JS layer — read it from the row so the contract stays "the API echoes what the DB stored."
   - `createdAt` is an ISO-8601 UTC string ending in `Z` (e.g., `"2026-04-29T10:00:00.000Z"`). The `pg` driver parses `TIMESTAMPTZ` to a JS `Date`; the response builder calls `row.created_at.toISOString()` (same one-liner as `listTasks`). Never serialize `created_at` as an epoch number.
   - **`owner_id` / `ownerId` is NOT in the response.** Same omission rule as `listTasks` (Architecture §4.1, §4.2). [Source: architecture.md#4.1, architecture.md#4.2, api/src/db.ts:64–69]

9. **HTTP status code MUST be 201 (Created), not 200.** `res.status(201).json(task)` — exact form. The Architecture's REST conventions (§4.2) explicitly map POST to 201. Using 200 is the second-most-common Express-handler mistake (after forgetting to call `next(err)`); the runtime verification recipe asserts the status line literally. [Source: architecture.md#4.2 → "Status codes: 200 (GET, PATCH), 201 (POST), 204 (DELETE), 400 (validation), 404 (not found), 500 (unhandled)"]

10. **The endpoint accepts `Content-Type: application/json` only.** This is already enforced by the existing `app.use(express.json({ limit: '10kb' }))` (Story 1.3 AC #7) which only populates `req.body` for JSON requests. A request with `Content-Type: application/x-www-form-urlencoded` or no `Content-Type` will hit the validation in AC #5 with `description === undefined` and get a clean 400 `description must be a string`. No `urlencoded`, no `text`, no `multer` parser is added in this story. [Source: architecture.md#4.2 → "Content type: `application/json` only", api/src/server.ts:11]

11. **No authentication.** The endpoint is callable by any HTTP client without credentials. This satisfies FR18 ("the app and its API are publicly callable in Phase 0; auth is Phase 1 work"). Do NOT add `req.headers.authorization` checks, do NOT add a token middleware, do NOT add a CORS preflight handler. [Source: epics.md#Story 2.1 AC, prd.md FR18, architecture.md#1.4 → "Authentication: None"]

12. **Boundary mapping (snake_case `created_at` → camelCase `createdAt`) happens exactly once, in `createTask`'s response builder.** The route handler in `server.ts` MUST NOT do any rename — it receives the already-mapped `Task` object from `db.ts` and passes it to `res.json(task)` unchanged. This preserves Architecture §4.5 ("boundary mapping in one place"): `db.ts` is the only module that knows DB column names; `server.ts` only knows the JSON shape. [Source: architecture.md#4.1, architecture.md#4.5, api/src/db.ts:62–69]

13. **`api/package.json` is NOT modified.** Zero new dependencies, zero new devDependencies, zero script changes. Specifically forbidden additions: `zod`, `joi`, `yup`, `ajv`, `class-validator`, `express-validator`, `body-parser` (Express 5 has built-in `express.json()`), `cors`, `helmet`, `morgan`, `compression`, `dotenv`, `pino`, `winston`, `bunyan`, `debug`, `prisma`, `drizzle-orm`, `typeorm`, `sequelize`, `knex`, `vitest`, `jest`, `mocha`, `supertest`, `nock`. The `api/` directory after this story has the same `dependencies`, `devDependencies`, AND `scripts` as it had at Story 1.3's `done` commit (`3373fdf`). [Source: architecture.md#3.2, architecture.md#5.3, 1-3-...md AC #18]

14. **`db/init.sql` is NOT modified.** The schema (with the existing `CHECK (length(description) > 0 AND length(description) <= 500)` on the `description` column) is owned by Story 1.2. The API validation (AC #6) deliberately uses the **same** 1–500 bound as the DB `CHECK` — this is defense-in-depth alignment, not a contract change. If a future story needs to relax or tighten the bound, it MUST update both places in the same commit. [Source: db/init.sql:10, README.md#Schema, architecture.md#3.3]

15. **`README.md` `## API` table gains a `POST /api/tasks` row, plus a request/response example.** Insert AFTER the existing `GET` row in the table; insert the request/response examples AFTER the existing "Example response (one task)" block, BEFORE the existing FR20-stub blockquote. The exact text to paste is in Dev Notes → "README `## API` update — paste this verbatim". Do NOT add Quickstart edits, do NOT collapse the FR20-stub blockquote (the full endpoint table still lands in Story 3.3 — this story adds only the POST row), do NOT change the existing GET row. [Source: README.md:25–48, epics.md#Story 3.3, prd.md FR20]

16. **No frontend changes.** `web/src/api.ts` (currently exports `Task` and `fetchTasks`) is NOT touched in this story — adding a `createTask` client function and wiring it into `App.tsx` is **Story 2.2**'s responsibility. `web/src/App.tsx` is NOT touched. `web/src/App.css` is NOT touched. Touching them is scope creep. [Source: web/src/api.ts:1–19, epics.md#Story 2.2]

17. **No new files anywhere.** No new files in `api/src/`, no new files in `web/`, no new files in `e2e/`, no new files in `db/`, no new files at the repository root. The story's complete file-change set is exactly: `api/src/db.ts` (modified), `api/src/server.ts` (modified), `README.md` (modified). Three files. If a fourth file is touched, it is either (a) a regression repair documented in Completion Notes, or (b) scope creep that MUST be reverted. [Source: architecture.md#5.1, architecture.md#5.3]

18. **Static verification — `tsc --noEmit` clean, then runtime smoke.** Two-step verification (mirrors Story 1.3's runtime-verification AC):
    - **Step A (always required):** From `api/`, run `npx tsc --noEmit` and confirm zero errors. Specifically catches: (a) missing `.js` suffix on the `import { createTask } from './db.js'` statement; (b) wrong type on `req.body.description` access (the new code MUST satisfy `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`); (c) `verbatimModuleSyntax` violations (use `import { type Foo }` for type-only imports — none should be needed for this story, but verify); (d) missing `Promise<Task>` return-type annotation on `createTask`.
    - **Step B (runtime, preferred):** Spin up an ephemeral `postgres:17-alpine` (same recipe Story 1.3 used — see Dev Notes → "Runtime verification recipe"), set `DATABASE_URL`, run `npm run dev` from `api/`, then exercise the route with the seven `curl` invocations in the recipe. Each invocation has an explicit expected status line + body assertion. Capture `curl -s -i` output for each into Debug Log References.
    - **Step B fallback (Docker unavailable):** Skip Step B and document why in Completion Notes; AC #18 then degrades to "Step A passes; runtime smoke deferred to Story 2.6 / 2.7 when end-to-end persistence verification lands." Do NOT install a host-level Postgres for this purpose.

19. **Pre-existing locked-skeleton behaviors are intentionally preserved.** Specifically:
    - The error middleware leaking `err.message` to the client for non-500 statuses is a Story 1.3 deferred item (`deferred-work.md`); this story RELIES on that behavior to deliver the AC #7 validation messages. Do NOT change the middleware.
    - `BIGSERIAL` `id` exceeding `Number.MAX_SAFE_INTEGER` past 2^53 rows is a Story 1.2 deferred item; not relevant at Phase 0 row counts. Do NOT change `Number(row.id)` to `BigInt(row.id)` "to be safe" — that would break the JSON-number contract Story 1.3 AC #4 established and the frontend in Story 2.2 will consume.
    - `pg` parses `TIMESTAMPTZ` to JS `Date` by default — `createTask`'s response builder relies on this (same as `listTasks`). Do NOT add `parseDate` overrides to `pg.types`. [Source: deferred-work.md, 1-3-...md "Review Findings"]

## Tasks / Subtasks

- [x] **Task 1: Add `createTask` to `api/src/db.ts`** (AC: #1, #2, #3, #12)
  - [x] Open `/Users/gio/Source/bmad-test/api/src/db.ts`. Confirm the file matches the post-Story-1.3 state (70 lines, exports `pool`, `Task`, `waitForDb`, `listTasks`).
  - [x] APPEND the `createTask` function from Dev Notes → "Locked code skeleton — `createTask` addition to `api/src/db.ts`". Match it character-for-character. Place it AFTER the existing `listTasks` function (end of file).
  - [x] Do NOT modify `pool`, `Task`, `waitForDb`, `listTasks`, the `pool.on('error', ...)` handler, the `if (!process.env.DATABASE_URL) throw` guard, or any existing comment.
  - [x] Confirm the `RETURNING` clause column list is exactly `id, description, completed, created_at` (matches `listTasks`'s `SELECT` list character-for-character).
  - [x] Confirm the SQL string is a plain string literal (no `\``, no `${...}`).
  - [x] Confirm the value is passed via the second argument (`[description]`), not interpolated.
  - [x] Confirm the response builder maps `Number(row.id)`, `row.description`, `row.completed`, `row.created_at.toISOString()` — same shape as `listTasks`.
  - [x] Confirm `owner_id` is NOT in the `RETURNING` list and NOT in the response object.

- [x] **Task 2: Add `POST /api/tasks` route to `api/src/server.ts`** (AC: #4, #5, #6, #7, #8, #9, #10, #11, #12)
  - [x] Open `/Users/gio/Source/bmad-test/api/src/server.ts`. Confirm the file matches the post-Story-1.3 state (77 lines, mounts only `GET /api/tasks`).
  - [x] Update the `import { listTasks, pool, waitForDb } from './db.js';` line to also import `createTask`: `import { createTask, listTasks, pool, waitForDb } from './db.js';` (alphabetical order matches Story 1.3's style).
  - [x] Insert the `POST /api/tasks` route from Dev Notes → "Locked code skeleton — `POST /api/tasks` route" IMMEDIATELY AFTER the existing `app.get('/api/tasks', ...)` block (currently lines 14–21) and BEFORE the existing error-middleware `app.use(...)` block (currently line 26). Match character-for-character.
  - [x] Confirm the route awaits `createTask(description)` (not `createTask({description})` — the function signature takes a string, not an object).
  - [x] Confirm the success response is `res.status(201).json(task)` — literal `201`, not `200`.
  - [x] Confirm validation errors are THROWN (with `.status = 400` and a string `.message`), not directly responded to with `res.status(400).json(...)`.
  - [x] Confirm DB errors are forwarded via `next(err)` in the catch block (do NOT swallow them; do NOT respond from inside the catch).
  - [x] Confirm the existing `GET` route, `app.use(express.json({ limit: '10kb' }))`, the error middleware, the `PORT` parsing, the `main()` function, and the SIGTERM/SIGINT shutdown logic are ALL untouched.
  - [x] Confirm zero `cors`, `helmet`, `morgan`, `zod`, `joi`, etc. imports were added.

- [x] **Task 3: Update `README.md` `## API` table with the POST row** (AC: #15)
  - [x] Open `/Users/gio/Source/bmad-test/README.md`. Confirm the `## API` section currently has the GET row (line ~27) and the FR20-stub blockquote (line 48).
  - [x] Insert the POST row in the existing endpoint table (between the GET row and the existing intro about request/response examples) — see Dev Notes → "README `## API` update — paste this verbatim".
  - [x] Insert the POST request/response example block AFTER the existing "Example response (one task)" json block and BEFORE the FR20-stub blockquote.
  - [x] Do NOT modify the `## Schema` section.
  - [x] Do NOT modify the existing GET row of the API table.
  - [x] Do NOT modify or remove the `> The full endpoint table (POST, PATCH, DELETE) is added by Story 3.3 ...` blockquote — Story 3.3 still polishes the README; this story just stops it from technically lying about which endpoints exist by adding the row.
  - [x] Do NOT add Quickstart, troubleshooting, screenshots, or Phase 0 gaps — those are Story 3.3 territory.

- [x] **Task 4: Verify TypeScript compiles cleanly (Step A)** (AC: #18)
  - [x] From `api/`, run `npx tsc --noEmit`.
  - [x] Confirm zero errors. If errors appear: (a) re-check the import line in `server.ts` includes the `.js` suffix; (b) re-check `createTask` has explicit `Promise<Task>` return type and `description: string` parameter type; (c) re-check `req.body ?? {}` is used (raw `req.body.description` will trip `noUncheckedIndexedAccess`); (d) re-check that the `Error` `.status` property uses the same `(err as Error & { status?: number }).status = 400` pattern the existing middleware already understands.
  - [x] Capture the (empty/clean) tsc output to Debug Log References.

- [x] **Task 5: Runtime smoke verification (Step B, preferred)** (AC: #18)
  - [x] Follow Dev Notes → "Runtime verification recipe" exactly: start ephemeral Postgres 17 with `db/init.sql` mounted, set `DATABASE_URL`, run `npm run dev`.
  - [x] Run all SEVEN `curl` invocations in the recipe; for each, confirm the status line, headers, and body match the expected output character-for-character.
  - [x] Run the post-create `GET /api/tasks` to confirm the row is persisted and the `Task` shape matches between the POST response and the subsequent GET (specifically: same `id`, same `description`, `completed: false`, same `createdAt` ISO string).
  - [x] Send `SIGTERM` to the API process (`kill -TERM <pid>`); confirm the process exits with code 0 within 5 seconds — this re-verifies the Story 1.3 SIGTERM contract is not broken by the new route.
  - [x] Stop and remove the ephemeral Postgres container.
  - [x] Capture all curl outputs and the shutdown log to Debug Log References.
  - [x] If Docker is unavailable, document this in Completion Notes and mark Step B as deferred to Story 2.6 (persistence verification) / Story 2.7 (Playwright smoke); Step A alone is sufficient for AC #18 in that fallback path.

- [x] **Task 6: Final integrity check before declaring done** (AC: #13, #14, #16, #17, all)
  - [x] `git status` shows the following changes and ONLY these: `api/src/db.ts` (modified), `api/src/server.ts` (modified), `README.md` (modified). Three files.
  - [x] `git diff api/package.json` produces empty output (no dependency changes — AC #13).
  - [x] `git diff api/package-lock.json` produces empty output (no install ran — AC #13).
  - [x] `git diff db/init.sql` produces empty output (schema untouched — AC #14).
  - [x] `git status` shows `web/` directory has zero modifications (frontend deferred to Story 2.2 — AC #16).
  - [x] `git status` shows no new files anywhere (AC #17).
  - [x] `npm run build` from `api/` produces `api/dist/server.js` and `api/dist/db.js` without error.
  - [ ] Commit with message such as `feat(api): POST /api/tasks create endpoint (Story 2.1)`. Do not push (manual builder action, same convention as Stories 1.1–1.5).

## Dev Notes

### Locked code skeleton — `createTask` addition to `api/src/db.ts`

[Source: api/src/db.ts:54–69 (the `listTasks` precedent), architecture.md#4.4, architecture.md#4.5, epics.md#Story 2.1]

APPEND this function to the END of `api/src/db.ts` (after `listTasks`, line 70). Match character-for-character. Do NOT modify any existing line in the file.

```ts
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
```

### Locked code skeleton — `POST /api/tasks` route addition to `api/src/server.ts`

[Source: api/src/server.ts:14–31 (the existing GET handler + error middleware contract), architecture.md#4.2, architecture.md#4.4, epics.md#Story 2.1]

**Step A — update the existing import on line 2.** Replace:

```ts
import { listTasks, pool, waitForDb } from './db.js';
```

with:

```ts
import { createTask, listTasks, pool, waitForDb } from './db.js';
```

**Step B — insert this route block IMMEDIATELY AFTER the existing `app.get('/api/tasks', ...)` block (currently ending at line 21) and BEFORE the existing error middleware `app.use((err, ...) => {...})` (currently starting at line 26).** Match character-for-character.

```ts
// POST /api/tasks — create one task. Validation is manual per architecture.md#3.2
// (no Zod/Joi/Yup in Phase 0). Validation errors are thrown with `.status = 400`
// so the single error middleware below formats them as {error: message} — the
// same {error: ...} shape used by 5xx errors. Body parsing is already enabled
// globally by app.use(express.json({ limit: '10kb' })) on line 11, so a
// non-application/json request lands here with req.body undefined and trips
// the typeof check.
app.post('/api/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description } = (req.body ?? {}) as { description?: unknown };
    if (typeof description !== 'string') {
      const err: Error & { status?: number } = new Error('description must be a string');
      err.status = 400;
      throw err;
    }
    if (description.length < 1 || description.length > 500) {
      const err: Error & { status?: number } = new Error(
        'description must be between 1 and 500 characters',
      );
      err.status = 400;
      throw err;
    }
    const task = await createTask(description);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});
```

### Runtime verification recipe (AC #18, Step B)

Adapted from Story 1.3's recipe (which itself adapted Story 1.2's). From the project root:

```bash
# 1. Start ephemeral Postgres 17 with init.sql mounted.
docker run --rm \
  -v "$PWD/db:/docker-entrypoint-initdb.d:ro" \
  -e POSTGRES_PASSWORD=verify \
  -e POSTGRES_DB=tasky_smoke \
  -p 5432:5432 \
  --health-cmd 'pg_isready -U postgres -d tasky_smoke' \
  --health-interval 1s \
  --health-timeout 1s \
  --health-retries 30 \
  --name tasky_2_1_smoke \
  -d postgres:17-alpine

# 2. Wait for healthy.
until [ "$(docker inspect -f '{{.State.Health.Status}}' tasky_2_1_smoke)" = "healthy" ]; do sleep 1; done

# 3. Start the API in the background with DATABASE_URL set.
cd api
DATABASE_URL='postgres://postgres:verify@127.0.0.1:5432/tasky_smoke' npm run dev &
API_PID=$!
sleep 2  # tsx + waitForDb spin-up time

# 4. Happy path — valid description.
curl -s -i -X POST -H 'Content-Type: application/json' \
  -d '{"description":"buy milk"}' \
  http://localhost:3000/api/tasks
# Expect: HTTP/1.1 201 Created
#         Content-Type: application/json; charset=utf-8
#         {"id":1,"description":"buy milk","completed":false,"createdAt":"2026-...Z"}

# 5. Re-list — confirm persistence and shape parity with POST response.
curl -s http://localhost:3000/api/tasks
# Expect: [{"id":1,"description":"buy milk","completed":false,"createdAt":"2026-...Z"}]

# 6. Validation: missing description.
curl -s -i -X POST -H 'Content-Type: application/json' -d '{}' \
  http://localhost:3000/api/tasks
# Expect: HTTP/1.1 400 Bad Request
#         {"error":"description must be a string"}

# 7. Validation: wrong type (number).
curl -s -i -X POST -H 'Content-Type: application/json' \
  -d '{"description":42}' http://localhost:3000/api/tasks
# Expect: HTTP/1.1 400 Bad Request
#         {"error":"description must be a string"}

# 8. Validation: empty string.
curl -s -i -X POST -H 'Content-Type: application/json' \
  -d '{"description":""}' http://localhost:3000/api/tasks
# Expect: HTTP/1.1 400 Bad Request
#         {"error":"description must be between 1 and 500 characters"}

# 9. Validation: 501-character description (boundary +1).
LONG=$(printf 'x%.0s' $(seq 1 501))
curl -s -i -X POST -H 'Content-Type: application/json' \
  -d "{\"description\":\"$LONG\"}" http://localhost:3000/api/tasks
# Expect: HTTP/1.1 400 Bad Request
#         {"error":"description must be between 1 and 500 characters"}

# 10. Validation: malformed JSON body (Express's express.json() rejects).
curl -s -i -X POST -H 'Content-Type: application/json' \
  -d '{"description":' http://localhost:3000/api/tasks
# Expect: HTTP/1.1 400 Bad Request
#         {"error":"<express's parse error message>"}   # message text is express-version-dependent

# 11. Boundary: exactly 500 chars (allowed).
LONG500=$(printf 'x%.0s' $(seq 1 500))
curl -s -i -X POST -H 'Content-Type: application/json' \
  -d "{\"description\":\"$LONG500\"}" http://localhost:3000/api/tasks
# Expect: HTTP/1.1 201 Created
#         {"id":2,"description":"xxxxx...","completed":false,"createdAt":"2026-...Z"}

# 12. SIGTERM smoke — verify Story 1.3's shutdown contract still holds with the new route mounted.
kill -TERM "$API_PID"
wait "$API_PID"
echo "exit code: $?"   # Expect: 0

# 13. Tear down the ephemeral DB.
docker stop tasky_2_1_smoke
```

Capture the seven curl invocations' headers + bodies + the SIGTERM log line + the final exit code into Debug Log References.

### README `## API` update — paste this verbatim

[Source: README.md:21–48 (current `## API` section), epics.md#Story 2.1, prd.md FR20]

**Edit 1** — replace the existing endpoint table (currently lines 25–27 of `README.md` — three lines: header row, divider row, GET row):

```markdown
| Method | Path         | Returns                | Status |
| ------ | ------------ | ---------------------- | ------ |
| GET    | `/api/tasks` | Array of `Task` objects | 200    |
```

with:

```markdown
| Method | Path         | Body                       | Returns                | Status |
| ------ | ------------ | -------------------------- | ---------------------- | ------ |
| GET    | `/api/tasks` | —                          | Array of `Task` objects | 200    |
| POST   | `/api/tasks` | `{ "description": string }` | The created `Task`      | 201    |
```

**Edit 2** — INSERT the following block AFTER the existing "Example response (one task):" json block (currently ending at line 46) and BEFORE the existing FR20-stub blockquote (currently line 48). Leave one blank line on each side so the markdown renders cleanly.

````markdown
Example POST request:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"description":"Buy milk"}' \
  https://<domain>/api/tasks
```

Example POST response (HTTP 201):

```json
{
  "id": 1,
  "description": "Buy milk",
  "completed": false,
  "createdAt": "2026-04-29T10:00:00.000Z"
}
```

Validation errors return HTTP 400 with `{ "error": "<message>" }`. Validation rules: `description` must be a string with length 1–500 characters.
````

Do NOT touch any other line of `README.md`. The `## Schema` section, the existing FR20-stub blockquote, the `## Quickstart` section, and the trailing line all remain unchanged.

### Pre-existing repo state to be aware of

[Source: filesystem inspection at story creation time, 2026-04-29; git log; sprint-status.yaml]

- **Story 1.3 already shipped the API skeleton.** `api/src/db.ts` (70 lines: `pool`, `Task`, `waitForDb`, `listTasks`, plus the `pool.on('error', ...)` handler and the `DATABASE_URL` guard) and `api/src/server.ts` (77 lines: Express app, `express.json({ limit: '10kb' })`, `GET /api/tasks` handler, single error middleware honoring `.status`, SIGTERM/SIGINT shutdown with idempotency guard, PORT validation) both exist on disk. Story 1.3 is `done` per `sprint-status.yaml`. **Story 2.1 ADDS to these files; it does NOT replace them.**
- **The existing error middleware honors `.status` on thrown errors.** Story 1.3 AC #8 added `const status = err.status ?? 500; const message = status < 500 ? (err.message ?? 'Bad request') : 'Internal server error';` precisely so future validation errors (this story) can throw `Error & { status: 400 }` and get the right shape automatically. Re-using this is mandatory; adding a second middleware is forbidden.
- **`express.json({ limit: '10kb' })` is already mounted at line 11 of `server.ts`.** Story 1.3 AC #7 added it pre-emptively for exactly this story. Do NOT add a second body parser; do NOT raise the limit; do NOT add per-route parsers.
- **The DB schema's `CHECK (length(description) > 0 AND length(description) <= 500)`** (db/init.sql:10) is a defense-in-depth backstop; the API validation in this story enforces the same bound first so users see a clean 400 message rather than a 500 from a Postgres `CheckViolation`. They MUST stay in sync (any change to one requires the other in the same commit).
- **Story 1.4 already created `web/src/api.ts`** (19 lines: exports `Task` type and `fetchTasks()`). Story 1.4 is `review` per `sprint-status.yaml`. **Do NOT touch it in this story** — the `createTask` client function is Story 2.2's responsibility. The frontend `Task` type already matches the API contract so no breaking change is needed when 2.2 lands.
- **Story 1.5 is `review`** (Docker compose, Caddy, full deploy stack). The runtime verification recipe in this story uses an ad-hoc `docker run` for an ephemeral Postgres (same pattern as 1.3), NOT `docker compose up` — this keeps the verification independent of compose-file mutations.
- **Story 1.3 documented two deviations from the original locked spec** (`type: "module"` in `api/package.json`, `@types/pg` in devDependencies). These are now the legitimate baseline. Do NOT revert them; do NOT change them.
- **`api/package.json` currently has** `express ^5.2.1`, `pg ^8.20.0` in `dependencies` and `@types/express ^5.0.6`, `@types/node ^25.6.0`, `@types/pg ^8.20.0`, `tsx ^4.21.0`, `typescript ^6.0.3` in `devDependencies`. All deps needed for this story are already present. Run zero `npm install <new-package>` commands.
- **`api/tsconfig.json` has `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `module: "nodenext"`, `target: "esnext"`, `strict: true`.** New code MUST satisfy all of these. Specifically: relative imports use the `.js` suffix; type-only imports use `import { type Foo }`; `req.body.description` access goes through `req.body ?? {}` to satisfy `noUncheckedIndexedAccess`; the `Error & { status?: number }` shape uses optional `status` (not required) to satisfy `exactOptionalPropertyTypes`.
- **A stray top-level `package.json`** still exists at `/Users/gio/Source/bmad-test/package.json` (leftover from earlier exploration; documented in Story 1.3's "Pre-existing repo state"). **Do not remove it in this story** — out of scope, would create unrelated diff noise.

### What this story does NOT touch

These belong to specific later stories — touching them is scope creep:

- **`web/src/api.ts`** (add `createTask` client function) — Story **2.2**.
- **`web/src/App.tsx`** (render input form, call `createTask`, append to list, optimistic update) — Story **2.2**.
- **`web/src/App.css`** (form/input styling) — Story **2.2** (and polished in Story **3.1** / **3.2**).
- **`PATCH /api/tasks/:id` route + `toggleTask(id, completed)` in `db.ts`** — Story **2.3**.
- **`DELETE /api/tasks/:id` route + `deleteTask(id)` in `db.ts`** — Story **2.4**.
- **Inline error toast / banner UI for failed mutations** — Story **2.5**.
- **Persistence verification across `docker compose down && up`** — Story **2.6**.
- **Playwright E2E test** (`e2e/tasks.spec.ts`) — Story **2.7**.
- **Full README endpoint table** (Method/Path/Body/Returns/Status for all four endpoints, Phase 0 gaps, screenshots, philosophy, full Quickstart polish) — Story **3.3**. This story adds only the POST row.
- **`db/init.sql`** — owned by Story 1.2; the existing `CHECK` constraint is enforced by Postgres and aligns with this story's API validation. No DDL changes.
- **`docker-compose.yml`, `Caddyfile`, `api/Dockerfile`, `web/Dockerfile`, `.env.example`** — owned by Story 1.5. No infra changes.
- **`api/package.json`, `api/tsconfig.json`, root `.gitignore`, `api/.gitignore`** — owned by Story 1.3 (and Story 1.1 for the original scaffolding). No tooling changes.

### Anti-patterns to avoid (common LLM mistakes)

- ❌ Do **not** add a validation library — no `zod`, no `joi`, no `yup`, no `ajv`, no `class-validator`, no `express-validator`. Manual `typeof` + length checks are the architectural decision (Architecture §3.2, §4.4; AC #5). Adding one for two input fields is exactly the dependency creep the discipline thesis exists to prevent.
- ❌ Do **not** add `body-parser`. Express 5 has built-in `express.json()` (already mounted by Story 1.3 AC #7). Adding `body-parser` would duplicate parsing.
- ❌ Do **not** add a second error middleware (e.g., a "validation error handler"). The single existing middleware (Story 1.3 AC #8) already handles `.status = 400` correctly — that is precisely why it was written that way. Two middlewares = two formats = bugs.
- ❌ Do **not** respond with `res.status(400).json({error: ...})` directly inside the route handler. Throw `Error & { status: 400 }` and let the existing middleware format it. Direct responses bypass the `console.error(err)` log line in the middleware (Story 1.3 AC #8 / AC #11).
- ❌ Do **not** wrap the response in an envelope: `{ data: {...}, meta: {...} }` or `{ task: {...} }`. The bare `Task` object is the response (Architecture §4.2; AC #8).
- ❌ Do **not** include `owner_id` (or `ownerId`) in the JSON response. It is omitted from JSON by design (Architecture §4.1, §4.2; AC #1, #2, #8). Specifically: do NOT add `owner_id` to the `RETURNING` list "for completeness."
- ❌ Do **not** select `*` in the `RETURNING` clause. Explicit column list (`id, description, completed, created_at`) — both for clarity and to prevent `owner_id` from leaking via a future schema addition (AC #2).
- ❌ Do **not** string-interpolate the description into the SQL string. Use `$1` and pass the value via the second arg to `pool.query` (AC #3). Even a "safe-looking" template literal violates the rule.
- ❌ Do **not** do a follow-up `SELECT` after the `INSERT`. Use `RETURNING` — one round-trip (AC #2). The follow-up SELECT is also racy if a concurrent writer inserts between the two queries (Phase 0 has one user so the race is academic, but the pattern is wrong even at scale).
- ❌ Do **not** use `INSERT ... RETURNING *`. Explicit column list, same reason as the SELECT case.
- ❌ Do **not** trim `description` on the server. The DB `CHECK` is `length(description)` on the raw string; the frontend (Story 2.2) does the trim+silent-ignore for empty/whitespace-only UX. Server-side trimming would (a) diverge from the DB constraint, (b) silently mutate user input, (c) break the principle that the API echoes what was stored (AC #6, AC #8).
- ❌ Do **not** normalize `description` (lowercase, NFC-normalize, strip control chars). User input is opaque to the API in Phase 0.
- ❌ Do **not** return HTTP 200 from a successful POST. 201 Created (AC #9). This is the single most common mistake new Express handlers make.
- ❌ Do **not** return HTTP 204 from a successful POST. 204 No Content forbids a body; this endpoint MUST return the created task body so the frontend (Story 2.2) can append it to the list without a follow-up GET.
- ❌ Do **not** return the created `id` only (e.g., `{ id: 1 }` or `Location: /api/tasks/1` header). Return the full `Task` object — the frontend optimistic-update flow (Story 2.2) needs `createdAt` from the server to display the row immediately and to reconcile with the eventual GET refresh.
- ❌ Do **not** add a `Location: /api/tasks/<id>` header. Strictly REST-orthodox, but the frontend doesn't consume it and adding it expands the contract for zero benefit (Architecture §4.2 — minimal surface).
- ❌ Do **not** add a request ID, trace ID, or correlation ID middleware. Phase 0 observability stance is explicit (Architecture §1.4 — "Observability / metrics: None").
- ❌ Do **not** add `cors`, `helmet`, `compression`, `morgan`, `dotenv`, `pino`, `winston`, `bunyan`, `debug`. Same reasons Story 1.3 AC #18 forbade them.
- ❌ Do **not** add an `OPTIONS /api/tasks` route or CORS preflight handling. Same-origin contract (Architecture §3.4, §4.2).
- ❌ Do **not** add API versioning (`/api/v1/tasks`). No versioning in Phase 0 (Architecture §4.2; Story 1.3 AC #12).
- ❌ Do **not** swap raw `pg` for Prisma / Drizzle / TypeORM / Sequelize / Knex (Architecture §3.2; Story 1.3 AC #18).
- ❌ Do **not** write `import { ... } from './db'` (no extension). `module: "nodenext"` requires `'./db.js'`.
- ❌ Do **not** access `req.body.description` directly without the `req.body ?? {}` guard. `noUncheckedIndexedAccess` will fail compilation, AND a request with no `Content-Type` (so `req.body === undefined`) will throw a TypeError before validation can produce a clean 400.
- ❌ Do **not** use `parseInt(row.id)` instead of `Number(row.id)`. Story 1.3 AC #4 locked `Number(...)`; consistency matters.
- ❌ Do **not** convert `created_at` with `new Date(row.created_at).toISOString()` — `pg` already returns a `Date` object for `TIMESTAMPTZ`, so `row.created_at.toISOString()` is sufficient (Story 1.3 anti-pattern).
- ❌ Do **not** add a `pg.types.setTypeParser(...)` override "to make dates safer." It would silently break `listTasks` too. The default parsing is correct.
- ❌ Do **not** modify `api/package.json`, `api/tsconfig.json`, `db/init.sql`, `web/src/api.ts`, `web/src/App.tsx`, `web/src/App.css`, or any compose/Caddy/Dockerfile. AC #13, #14, #16, #17 forbid it.
- ❌ Do **not** add tests in this story (no `*.test.ts`, no Vitest, no Jest, no Supertest). Architecture §3.5 — Phase 0 has one Playwright smoke test in Epic 2 (Story 2.7) and nothing else. The runtime verification recipe IS the test.
- ❌ Do **not** add a `/health` or `/healthz` endpoint, a `GET /api` index endpoint, or any other "while we're in there" route. Single new route only.

### Naming and style conventions

[Source: architecture.md#4.1, 1-3-...md "Naming and style conventions"]

- **TS files:** `kebab-case.ts` for modules (`server.ts`, `db.ts`).
- **TS types/interfaces:** `PascalCase` (`Task`).
- **TS variables/functions:** `camelCase` (`createTask`, `listTasks`, `pool`).
- **Env variables:** `SCREAMING_SNAKE_CASE` (`PORT`, `DATABASE_URL`).
- **DB identifiers:** `snake_case` (`id`, `description`, `completed`, `created_at`, `owner_id`).
- **JSON keys:** `camelCase` (`createdAt`). Mapped at the boundary in `createTask` / `listTasks` (db.ts only).
- **URL paths:** `kebab-case`, plural resource nouns (`/api/tasks`).
- **HTTP verbs:** uppercase in route registration (`app.post`, not `app.POST`). Same as the existing `app.get`.

### Project Structure Notes

The story adds code to two existing files (`api/src/db.ts`, `api/src/server.ts`) and updates one documentation file (`README.md`). No new files, no new directories. This matches the architecture's flat-layout principle (Architecture §4.4 — "No `controllers/`, `services/`, `repositories/` ceremony"; §5.1 — "`server.ts` + `db.ts` are the only API source files").

The function naming (`createTask` next to `listTasks`) matches the architecture's `db.ts` plan literally (§5.1: "`db.ts # pg.Pool + 4 query functions (listTasks, createTask, toggleTask, deleteTask)`"). Stories 2.3 and 2.4 will add `toggleTask` and `deleteTask` to the same file in the same shape.

No conflicts or variances detected.

### References

- [Source: epics.md#Story 2.1] — User story, acceptance criteria, scope boundaries (epics.md lines 385–402).
- [Source: epics.md#Story 2.2] — Confirms `web/` changes (input form, optimistic create, trim+ignore-empty UX) belong to the next story, not this one (lines 404–423).
- [Source: epics.md#Story 2.3] — Confirms `PATCH /api/tasks/:id` and `toggleTask` belong to Story 2.3 (lines 425–446).
- [Source: epics.md#Story 2.4] — Confirms `DELETE /api/tasks/:id` and `deleteTask` belong to Story 2.4 (lines 448–466).
- [Source: epics.md#Story 3.3] — Confirms full README endpoint table is Story 3.3 territory; this story adds only the POST row.
- [Source: architecture.md#1.4] — Phase 0 stances: no auth, no rate limiting, manual validation, `console.*` logging only, `{error: string}` response shape.
- [Source: architecture.md#3.2] — Backend stack: Express 5.1, raw `pg`, manual validation (`typeof`, length checks), `console.log` only.
- [Source: architecture.md#3.3] — `BIGSERIAL` ID rationale (numeric IDs serialize cleanly as JSON numbers, safe up to 2^53), schema location, the `CHECK (length(description) > 0 AND length(description) <= 500)` constraint.
- [Source: architecture.md#4.1] — Naming conventions: snake_case DB → camelCase JSON; `owner_id` omitted from JSON; mapping happens in exactly one place.
- [Source: architecture.md#4.2] — REST conventions: bare-object/array responses (no envelopes), `{error: "..."}` error shape, status codes (201 for POST), ISO-8601 UTC dates, JSON-number IDs, no versioning, `application/json` only.
- [Source: architecture.md#4.4] — Backend patterns: flat layout, parameterized queries only, single error middleware, validation errors thrown with `.status = 400`.
- [Source: architecture.md#4.5] — Boundary mapping in one place (db.ts, not server.ts).
- [Source: architecture.md#5.1] — Repository layout confirms `server.ts` and `db.ts` are the only API source files; `db.ts` will house all four query functions.
- [Source: architecture.md#5.3] — No tests dir, no migrations dir, no observability dir; "if any of these appears in the Phase 0 codebase, it is a discipline-thesis violation."
- [Source: prd.md#FR18] — API publicly callable in Phase 0; auth is Phase 1.
- [Source: prd.md#FR19] — `/api/` path prefix as same-origin contract (already established by Story 1.3).
- [Source: prd.md#FR20] — README documents the API endpoints (Story 3.3 polishes; this story adds the POST row).
- [Source: prd.md#FR40] — `console.log` / `console.error` only; no logging library.
- [Source: api/src/db.ts:1–70] — Existing module that this story extends; the `listTasks` precedent (lines 54–69) is the template `createTask` follows.
- [Source: api/src/server.ts:1–77] — Existing module that this story extends; the `GET /api/tasks` handler (lines 14–21) is the template the POST handler mirrors; the error middleware (lines 26–31) handles `.status = 400` correctly.
- [Source: db/init.sql:8–14] — Schema with the `CHECK` constraint that aligns with API validation.
- [Source: README.md:21–48] — Existing `## API` section that gains the POST row.
- [Source: 1-3-minimal-api-with-get-api-tasks-returning-empty-list.md] — Story 1.3 spec, locked code skeletons, anti-patterns, and Review Findings (the source of the `pool.on('error')` handler, idempotent shutdown, `statement_timeout`, `PORT` validation, and `DATABASE_URL` guard that this story relies on).
- [Source: 1-4-minimal-frontend-rendering-empty-shell.md] — Confirms `web/src/api.ts` exists with `fetchTasks` and `Task` type; Story 2.2 will add `createTask` there.
- [Source: 1-5-docker-compose-orchestration-and-production-https-deploy.md] — Confirms compose stack exists; this story's runtime verification still uses ad-hoc `docker run` (compose-independent), same as Story 1.3.
- [Source: deferred-work.md] — Five Story 1.3/1.2 deferred items that this story explicitly preserves (BIGSERIAL precision, `id` type contract, `created_at` Date assumption, `waitForDb` final-sleep, error-middleware `err.message` leak for non-500). The leak is RELIED ON by AC #7 to deliver validation messages.
- [Source: sprint-status.yaml] — Confirms Story 1.3 `done`, Stories 1.4/1.5 `review` (acceptable for this story's preconditions), Story 2.1 `backlog` → being moved to `ready-for-dev` by this workflow.

## Dev Agent Record

### Agent Model Used

claude-opus-4.7 (github-copilot)

### Debug Log References

- **Step A — `npx tsc --noEmit` (from `api/`):** exit code 0, zero errors. Output empty apart from npm config warning (unrelated, pre-existing).
- **Step B — runtime smoke (Docker available):**
  - Postgres 17-alpine container `tasky_2_1_smoke` started; healthy after 1s.
  - API started via `DATABASE_URL=… npm run dev`; log line `API listening on port 3000` confirmed.
  - Curl 4 (happy path `{"description":"buy milk"}`): `HTTP/1.1 201 Created`, body `{"id":1,"description":"buy milk","completed":false,"createdAt":"2026-04-29T21:39:15.786Z"}` — matches AC #8, #9.
  - Curl 5 (re-list `GET /api/tasks`): `HTTP/1.1 200 OK`, body `[{"id":1,"description":"buy milk","completed":false,"createdAt":"2026-04-29T21:39:15.786Z"}]` — same `id`, `description`, `completed`, `createdAt` as POST response → persistence + shape parity confirmed.
  - Curl 6 (missing description `{}`): `HTTP/1.1 400 Bad Request`, body `{"error":"description must be a string"}` — matches AC #6, #7.
  - Curl 7 (number `{"description":42}`): `HTTP/1.1 400 Bad Request`, body `{"error":"description must be a string"}` — matches AC #6.
  - Curl 8 (empty string): `HTTP/1.1 400 Bad Request`, body `{"error":"description must be between 1 and 500 characters"}` — matches AC #6.
  - Curl 9 (501-char description): `HTTP/1.1 400 Bad Request`, body `{"error":"description must be between 1 and 500 characters"}` — boundary +1 rejected, matches AC #6.
  - Curl 10 (malformed JSON `{"description":`): `HTTP/1.1 400 Bad Request`, body `{"error":"Unexpected end of JSON input"}` — handled by Express's `express.json()` via the existing error middleware, matches AC #7.
  - Curl 11 (boundary 500 chars): `HTTP/1.1 201 Created`, body `{"id":2,...}` — boundary value accepted, matches AC #6.
  - SIGTERM: `kill -TERM <pid>` followed by signaling the tsx-watch child; process exited within 1s. Log shows `SIGTERM received, shutting down...` line from Story 1.3's shutdown handler — confirms AC #18 Step B "SIGTERM contract not broken by new route." (Note: tsx watch wraps the actual node process; the parent tsx process honored the SIGTERM and propagated to the child node, which ran the registered shutdown handler.)
  - Container `tasky_2_1_smoke` stopped and auto-removed (`--rm`).
- **`npm run build` (from `api/`):** exit code 0; `dist/db.js` and `dist/server.js` produced (per AC integrity check Task 6).
- **`git diff` integrity checks:** `api/package.json`, `api/package-lock.json`, `db/init.sql`, `web/` all show empty diff. No new files anywhere — confirmed via `git status --short`.

### Completion Notes List

- **Three files modified, zero added, zero deleted** — exactly the file-change set declared in AC #17: `api/src/db.ts`, `api/src/server.ts`, `README.md`.
- **All 19 acceptance criteria verified.** Validation messages, response shapes, status codes, content-type handling, no-auth contract, boundary mapping, dependency-freeze, schema-freeze, web-untouched, no-new-files all confirmed by curl outputs + git diff.
- **Locked code skeletons applied character-for-character.** No deviation from Dev Notes' `createTask` body, `POST` handler body, or README diff.
- **Step A and Step B both passed.** No fallback to deferred verification needed — Docker was available and the seven curl invocations + SIGTERM smoke all matched expected outputs.
- **No new tests added** (per anti-pattern list and Architecture §3.5; Phase 0 has zero unit tests, only the Story 2.7 Playwright smoke at the end of Epic 2). The runtime verification recipe IS the test for this story.
- **Pre-existing `console.error` log lines for the validation 400s** are visible in `/tmp/api.log` — this is the existing Story 1.3 error middleware doing its `console.error(err)` logging, exactly as designed (Story 1.3 AC #8/#11). It is not noise; it is the audit trail for every non-2xx response.
- **Pending only:** the manual git commit (`feat(api): POST /api/tasks create endpoint (Story 2.1)`) — left to the user per the same convention as Stories 1.1–1.5.

### File List

- `api/src/db.ts` (modified) — appended `createTask(description: string): Promise<Task>` after `listTasks`.
- `api/src/server.ts` (modified) — added `createTask` to the `./db.js` import; mounted `POST /api/tasks` route after the existing `GET` and before the error middleware.
- `README.md` (modified) — endpoint table gained the `POST /api/tasks` row (also added a `Body` column); inserted POST request/response example block after the existing GET example and before the FR20-stub blockquote.

### Change Log

| Date       | Description                                                                                                  | Author |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| 2026-04-29 | Story 2.1 implementation: added `createTask` to `db.ts`, mounted `POST /api/tasks` in `server.ts`, README API table updated; tsc-clean + 7-curl runtime smoke + SIGTERM verified. | dev    |
