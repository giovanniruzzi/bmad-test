# Story 2.3: Toggle task completion — `PATCH /api/tasks/:id` and UI

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As any individual with the URL,
I want to mark a task complete (and unmark it) with a single tap or keystroke,
so that I can track progress through my list without confirmation friction.

## Acceptance Criteria

1. **`api/src/db.ts` gains a new `toggleTask(id: number, completed: boolean): Promise<Task | null>` function — and only that function is added.** It is APPENDED to the existing module (do NOT replace `Task`, `pool`, `waitForDb`, `listTasks`, or `createTask` — they were locked by Stories 1.2 / 1.3 / 2.1 and the file is currently 98 lines). The function MUST issue a single parameterized SQL statement: `UPDATE tasks SET completed = $2 WHERE id = $1 RETURNING id, description, completed, created_at` (column list IDENTICAL to `listTasks` and `createTask` per architecture.md#4.5 — boundary mapping in one place); on `rows.length === 0` it MUST return `null` (the route handler distinguishes 404 from 200 by this); on `rows.length === 1` it MUST return the mapped `Task` using the same `Number(row.id)` + `row.created_at.toISOString()` pattern used by `createTask` (lines 91–97). NO second SELECT after the UPDATE; the `RETURNING` clause delivers the post-update row in one round-trip. NO `try`/`catch` inside `toggleTask` — let `pg` errors propagate; the route handler's `next(err)` + the single error middleware (server.ts:55-60) handle them. [Source: api/src/db.ts:79-98, architecture.md#4.5]

2. **`api/src/server.ts` gains a `PATCH /api/tasks/:id` route — and only that route is added.** It is APPENDED between the existing `POST /api/tasks` handler (lines 30-50) and the error middleware (lines 55-60). The route handler MUST follow the EXACT shape of the `POST /api/tasks` handler (Story 2.1): `async (req, res, next) => { try { ... } catch (err) { next(err); } }`. Validation errors MUST be thrown with `.status = 400` (or `404`) so the single error middleware formats them as `{error: message}` — the same `{error: ...}` shape used by 5xx errors. NO second error middleware. NO direct `res.status(400).json(...)` calls in the handler body (would duplicate the middleware's responsibility and risk drift). [Source: api/src/server.ts:30-60, architecture.md#3.2, architecture.md#4.4]

3. **The `:id` URL parameter MUST be validated as a positive integer string before any database call.** Express delivers `req.params.id` as a `string`. The validation chain MUST be (in order): (a) `const idStr = req.params.id` — note `noUncheckedIndexedAccess` does NOT apply here because `req.params` types route params as `string` (not `string | undefined`) when the route pattern declares `:id`; (b) check `/^[1-9][0-9]*$/.test(idStr)` — this single regex rejects empty strings, `"0"`, `"-1"`, `"1.5"`, `"1e10"`, `" 1 "` (any whitespace), `"abc"`, `"1abc"`, hex like `"0x1"`, scientific notation, leading-zero forms like `"01"`. Throw a 400 Error with message `"id must be a positive integer"` if the regex does not match. (c) `const id = Number(idStr)` — safe because the regex passed; (d) one MORE check: `if (!Number.isSafeInteger(id))` throw 400 — guards against `"99999999999999999999"` (too large for `Number`). Do NOT use `parseInt(idStr, 10)` (silently parses `"123abc"` → `123`); do NOT use `Number(idStr)` alone (parses `""` → `0`, `" "` → `0`, `"1.5"` → `1.5`); do NOT use a Zod / Joi / Yup schema (forbidden in Phase 0 per architecture.md#3.2). [Source: architecture.md#3.2, deferred-work.md#5 (BIGSERIAL > 2^53)]

4. **The request body MUST be validated to be a non-null object with a boolean `completed` field.** The validation MUST follow the EXACT pattern from Story 2.1's POST handler (server.ts:32-44): `const { completed } = (req.body ?? {}) as { completed?: unknown }; if (typeof completed !== 'boolean') { const err: Error & { status?: number } = new Error('completed must be a boolean'); err.status = 400; throw err; }`. The `typeof completed !== 'boolean'` check rejects: `undefined` (missing field), `null`, `"true"` (string — case CRITICAL — many JSON-careless clients send strings), `1`, `0`, `[]`, `{}`. Do NOT accept truthy/falsy coercion (would let `1`/`0`/`"yes"` pass and silently coerce — confusing wire contract). Do NOT add a length check, an enum check, or any field-presence allowlist beyond `completed` — extra fields in the body are silently ignored (Express's behavior, consistent with Story 2.1 AC #8 from 2.1). [Source: api/src/server.ts:32-44, 2-1-create-task-post-api-tasks-endpoint.md AC #6, AC #8]

5. **Order of validation: id FIRST, body SECOND, DB call THIRD.** Rationale: (a) failing id-validation early avoids parsing the body for a request that cannot succeed; (b) failing body-validation before the DB call avoids touching Postgres for malformed requests (no log noise, no pool churn); (c) the DB call is the ONLY async step in the success path. The catch block forwards via `next(err)` — same pattern as POST. Do NOT swap the order; do NOT validate id and body in parallel; do NOT call `toggleTask` first and infer 400-vs-404 from the error type (would hit the DB for invalid input). [Source: api/src/server.ts:30-50, 2-1-create-task-post-api-tasks-endpoint.md AC #6]

6. **404 with `{"error":"task not found"}` when `toggleTask(id, completed)` returns `null`.** The exact body MUST be `{"error":"task not found"}` (lowercase, no period, no trailing newline) — this exact wording is what Story 2.5's toast will surface to the user. Throw a `Error & { status?: number }` with `err.status = 404` and `err.message = 'task not found'`; the existing error middleware (server.ts:55-60) sees `status < 500` and uses `err.message` as the JSON `error` field. Do NOT call `res.status(404).json(...)` directly (would bypass the middleware). Do NOT return `200 { "ok": false }` or any other "soft 404" pattern. [Source: api/src/server.ts:55-60, epics.md#Story 2.3 AC, epics.md#Story 2.5 AC]

7. **200 with the FULL updated `Task` object on success — NOT 204, NOT just `{ok:true}`.** The response body on success MUST be the camelCase `Task` JSON (`{id, description, completed, createdAt}`) — exact same shape as `POST /api/tasks` (Story 2.1 AC #11) and as each element of `GET /api/tasks` (Story 1.3). The response status MUST be `200` (NOT `201` — no resource was created; NOT `204` — there IS a body). The frontend uses the returned `completed` field as the new source of truth (AC #15) rather than trusting its own `!currentCompleted` inference, so the body MUST include the freshly-persisted value. [Source: api/src/server.ts:46, epics.md#Story 2.3 AC, architecture.md#3.1]

8. **The DB UPDATE MUST be parameterized — `$1` for id, `$2` for completed.** SQL: `UPDATE tasks SET completed = $2 WHERE id = $1 RETURNING id, description, completed, created_at`. Do NOT string-interpolate either parameter (`` `WHERE id = ${id}` `` is SQL injection even though id passed regex validation — defense in depth; the regex could be loosened in a future story by mistake). Do NOT use `pg-format`. Do NOT use a query builder (Knex/Kysely — forbidden per architecture.md#3.2). Do NOT add a `WHERE owner_id = ...` clause (single-user Phase 0 — owner_id stays NULL/ignored). The `RETURNING` column list MUST be byte-identical to `createTask`'s RETURNING list (line 86) so future schema changes touch one regex grep. [Source: api/src/db.ts:79-88, architecture.md#3.2, architecture.md#4.1]

9. **`web/src/api.ts` gains a new `toggleTask(id: number, completed: boolean): Promise<Task>` function — and only that function is added.** It is APPENDED to the existing module (do NOT replace `Task`, `fetchTasks`, or `createTask` — they were locked by Stories 1.4 and 2.2). The function issues `fetch(``/api/tasks/${id}``, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }) })`, treats `!response.ok` as an error using the SAME json-error-extraction pattern that `createTask` uses (Story 2.2 AC #4 — try `response.json()`, look for `{error: string}`, fall back to `${status} ${statusText}`), and on success returns `(await response.json()) as Task`. NO third-party HTTP client. NO `AbortController`. NO id-as-string in the URL — TS `number` → template literal works directly. [Source: web/src/api.ts (post-2.2 state), 2-2-list-and-create-tasks-in-the-ui.md AC #1, AC #4]

10. **The PATCH URL is `/api/tasks/${id}` — relative path only, NO leading host, NO trailing slash, NO query string.** Same-origin contract per architecture.md#3.4 — Vite dev proxy forwards `/api/*` to localhost:3000; Caddy in prod proxies `/api/*` to the api container. Do NOT prefix `http://localhost:3000` (breaks prod). Do NOT use `URL` constructor (`new URL(``tasks/${id}``, '/api/')` — over-engineered, returns absolute URL with the page's origin which is fine but adds a needless allocation). The trailing `/${id}` MUST be a template literal (NOT string concatenation `'/api/tasks/' + id` — both work but the literal matches `createTask`'s style). [Source: web/src/api.ts:13-18, architecture.md#3.4, architecture.md#4.2]

11. **`web/src/App.tsx` extends — does NOT replace — the Story 2.2 shell to add a per-task checkbox.** The existing structure (mount-time `fetchTasks`, `description` state, `inputRef`, `<form>` with input + Add button, three render branches) is PRESERVED. The ONLY changes to the existing JSX are inside the `<li>` element of the list-rendering branch (current state from Story 2.2: `<li key={task.id}>{task.description}</li>`). After Story 2.3, that `<li>` MUST contain — IN THIS DOM ORDER — (a) an `<input type="checkbox">` with `checked={task.completed}`, `onChange={() => handleToggle(task.id, !task.completed)}`, `aria-label="Mark task complete"` (or `"Mark task incomplete"` when `task.completed` is true — see AC #14), and (b) the description text wrapped in a `<span>` so completed-state CSS can target it (`<span className={task.completed ? 'completed' : ''}>{task.description}</span>`). NO `<label>` wrapping (the `aria-label` is the accessible name); NO key change (still `key={task.id}`). [Source: web/src/App.tsx (post-2.2 state), epics.md#Story 2.3, prd.md#NFR14]

12. **The `handleToggle(id, nextCompleted)` function MUST be defined inside the `App` component (alongside the existing `handleSubmit`) and uses functional state updates.** Exact shape: `async function handleToggle(id: number, nextCompleted: boolean) { try { const updated = await toggleTask(id, nextCompleted); setTasks((prev) => prev.map((t) => (t.id === id ? updated : t))); } catch (err) { console.error(err); } }`. The functional updater (`prev => prev.map(...)`) is REQUIRED — two rapid checkbox clicks would otherwise race on a stale `tasks` closure. The map MUST replace the matched task with the SERVER-RETURNED `updated` task object (NOT a `{ ...t, completed: nextCompleted }` spread — the server is the source of truth, and Story 3.4 will re-introduce optimistic UI; this story stays request-then-update). On error, `console.error(err)` and DO NOTHING ELSE — no toast, no revert (Story 2.5 wires the toast; the checkbox stays in its old state because the local `tasks` state was never mutated). [Source: web/src/App.tsx (post-2.2 state), epics.md#Story 2.3, epics.md#Story 2.5, epics.md#Story 3.4]

13. **NO optimistic UI in this story — the checkbox flips ONLY after the server confirms.** Concretely: do NOT call `setTasks` BEFORE `await toggleTask(...)`. Do NOT use `useOptimistic` (that hook is reserved for Story 3.4). Do NOT add a `pending` state per task. The user-perceived latency is one round-trip (~5-50ms localhost, ~50-300ms VPS) — acceptable per architecture.md#4.3. The checkbox `checked` attribute is `task.completed` (driven from React state); React re-renders after `setTasks`, and the checkbox visually flips THEN. If the API call fails, the checkbox stays unchanged because the state was never mutated — no glitchy "snap back" animation, no race window. This is deliberate ordering: 3.4 will revisit, but the cut-criterion exists ("Nice-to-ship — first to cut" per epics.md#Story 3.4). [Source: epics.md#Story 3.4, architecture.md#3.1, architecture.md#4.3]

14. **Checkbox `aria-label` switches with `task.completed` to remain meaningful after the state changes.** Exact rule: `aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}`. The label describes the ACTION the user can perform, not the current state (which the checkbox's checked attribute already conveys to assistive tech). Do NOT use `aria-label="Toggle task"` (less discoverable, doesn't tell the user what will happen). Do NOT use `aria-checked` manually (the native `<input type="checkbox">` exposes checked state automatically — adding `aria-checked` is incorrect and can confuse some screen readers). Do NOT use `aria-describedby` referencing the description text (over-engineered; the visual association is clear). [Source: prd.md#NFR14, epics.md#Story 2.3]

15. **The completed-vs-active visual distinction MUST rely on MORE than color alone — text-decoration AND opacity (or one of them PLUS strikethrough).** WCAG 1.4.1 (Use of Color) — color alone is not a sufficient differentiator. Locked CSS rule for the completed state: `.completed { text-decoration: line-through; opacity: 0.6; }` applied to the `<span className={task.completed ? 'completed' : ''}>{task.description}</span>` element. The strikethrough (text-decoration) is perceptible without color; the opacity is a SECOND signal. Do NOT use ONLY a color change (e.g., `.completed { color: #888; }` — fails WCAG 1.4.1). Do NOT use `display: none` for completed tasks (would hide them — defeats the toggle's purpose). Do NOT add `transition` (Story 3.1 territory; this story stays static). Full WCAG AA contrast verification (computed colors, ratios) is deferred to Story 3.1; this story only ensures non-color-only differentiation. [Source: prd.md#FR5, epics.md#Story 2.3, epics.md#Story 3.1]

16. **The checkbox is keyboard-operable via NATIVE browser behavior — Tab to focus, Space to toggle.** This is automatic for `<input type="checkbox">` in every major browser; do NOT add an `onKeyDown` handler. Do NOT add `tabIndex={0}` (default for inputs). Do NOT add `tabIndex={-1}` (would remove from tab order). The browser-default focus indicator on the checkbox MUST remain visible — this story does NOT add any CSS rule that suppresses it (`outline: none`, `outline: 0`, `*:focus { outline: 0 }`, `input[type="checkbox"]:focus { outline: 0 }` are ALL forbidden per NFR16, same as Stories 1.4 and 2.2). [Source: prd.md#NFR15, prd.md#NFR16, web/src/App.css (post-2.2 state)]

17. **NO confirmation dialog appears before the toggle — per NFR19.** No `window.confirm()`, no custom modal, no `<dialog>` element, no two-step UI ("Mark complete?" → "Confirm"). The single click/space-press IS the action. Toggling back to incomplete is the inverse single action — also no confirmation. This applies to BOTH directions: false→true AND true→false. [Source: prd.md#NFR19, epics.md#Story 2.3]

18. **NO new files in `api/src/`, `web/src/`, `e2e/`, `db/`, or the project root.** This story's complete file-change set is exactly: `api/src/db.ts` (modified — append `toggleTask`), `api/src/server.ts` (modified — insert `PATCH /api/tasks/:id` route between POST and error middleware), `web/src/api.ts` (modified — append `toggleTask`), `web/src/App.tsx` (modified — add `handleToggle` and per-`<li>` checkbox + span), `web/src/App.css` (modified — append `.completed` rule). Five files. Specifically, do NOT split the toggle into a `TaskItem.tsx` component (premature; one-line `<li>` content; component extraction lands in Story 3.1 or later if needed), do NOT extract a `useTaskMutations` hook (premature; three handlers in one component is fine), do NOT create `api/src/routes/tasks.ts` (Express router split is forbidden per architecture.md#5.1 — single `server.ts` until file > 300 lines). [Source: architecture.md#5.1, architecture.md#5.3]

19. **NO new dependencies on either side.** API side: no `joi`, no `zod`, no `yup`, no `ajv`, no `class-validator`, no `express-validator`, no `celebrate`. Web side: no `axios`, no `ky`, no `@tanstack/react-query`, no `swr`, no `react-aria` for the checkbox, no `@radix-ui/react-checkbox`, no `@headlessui/react`, no `framer-motion` for the strikethrough, no `clsx`/`classnames` (string concatenation or template literal is enough for one conditional class), no `lodash.debounce` for the toggle. The deps lists at the end of this story MUST be byte-identical to the start; `git diff api/package.json api/package-lock.json web/package.json web/package-lock.json` MUST produce empty output. [Source: architecture.md#3.1, architecture.md#3.2, architecture.md#5.3]

20. **NO README change in this story.** The `## API` table will gain a `PATCH /api/tasks/:id` row in Story 3.3 (full README rewrite). Adding it here would create a partial-update problem (PATCH documented, DELETE not yet — incoherent). The deferred work is tracked: see Story 3.3's "complete 4-endpoint table" deliverable. [Source: epics.md#Story 3.3, README.md (current state, lines 41-63 ## API)]

21. **TypeScript strictness — code MUST satisfy BOTH `api/tsconfig.json` AND `web/tsconfig.app.json` flags as-is.** API side (`module: "nodenext"`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`):
    - The `import { toggleTask, ... } from './db.js'` in server.ts MUST keep the `.js` suffix (nodenext requirement).
    - The `rows[0]` access after a SELECT/UPDATE/RETURNING MUST use a non-null assertion `!` ONLY when the row count is provably ≥ 1; for `toggleTask`, the `RETURNING` returns 0 rows when the WHERE matches nothing, so `rows[0]` is `T | undefined` — handle the `undefined` branch (return `null`) BEFORE accessing fields.
    - The pg generic on the query MUST be the `{ id: string; description: string; completed: boolean; created_at: Date }` shape (matches `createTask` line 80-85 EXACTLY).
    Web side (`moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, `noUnusedLocals: true`, `erasableSyntaxOnly: true`):
    - The import in App.tsx MUST be `import { createTask, fetchTasks, toggleTask, type Task } from './api'` (mixed value + type, NO `.js` suffix).
    - The `handleToggle` function signature MUST be `async function handleToggle(id: number, nextCompleted: boolean): Promise<void>` — explicit `Promise<void>` is optional but matches the Story 2.2 `handleSubmit` style.
    - Do NOT loosen any flag. Fix the types/imports instead. [Source: api/tsconfig.json, web/tsconfig.app.json (existing); 2-1-create-task-post-api-tasks-endpoint.md AC #14; 2-2-list-and-create-tasks-in-the-ui.md AC #19]

22. **Static verification — both projects build cleanly, then runtime smoke verifies the full toggle round-trip.** Three-step verification:
    - **Step A (always required):** From `api/`, run `npm run build` (which is `tsc -b` against `api/tsconfig.json`). Confirm zero TS errors. Then from `web/`, run `npm run build` (`tsc -b && vite build`). Confirm zero TS errors and a successful Vite production build emitting `web/dist/index.html` plus a hashed JS/CSS bundle. If TS errors appear: (a) check `import` statements use `.js` suffix on api side; (b) check the `rows[0]` access is `null`-safe in `toggleTask`; (c) check the App.tsx import adds `toggleTask` and uses `type Task`.
    - **Step B (runtime, preferred):** With the API + ephemeral Postgres stack running (per Story 1.3 / 2.1 / 2.2 recipe — `docker compose up -d db`, then `npm run dev` from `api/` AND from `web/` in two terminals), exercise ALL scenarios in Dev Notes → "Runtime verification recipe" — both `curl` (API direct) and browser (full UI flow). Each scenario has explicit expected response status, JSON body shape, DOM state, and console state assertions.
    - **Step B fallback (Docker unavailable):** Skip Step B and document why in Completion Notes; AC #22 then degrades to "Step A passes; runtime smoke deferred to Story 2.6 / 2.7." Step A alone is sufficient for the AC in that fallback path.

## Tasks / Subtasks

- [x] **Task 1: Append `toggleTask` to `api/src/db.ts`** (AC: #1, #8, #21)
  - [x] Open `/Users/gio/Source/bmad-test/api/src/db.ts`. Confirm current contents are 98 lines: `Task` type, `pool`, `pool.on('error')`, `waitForDb`, `listTasks`, `createTask`.
  - [x] APPEND the `toggleTask` function from Dev Notes → "Locked code skeleton — `toggleTask` addition to `api/src/db.ts`" character-for-character. Place it AFTER the existing `createTask` function (end of file).
  - [x] Do NOT modify the existing `Task` type, `pool`, `waitForDb`, `listTasks`, or `createTask`.
  - [x] Confirm: parameterized SQL with `$1` (id) and `$2` (completed); `RETURNING` column list IDENTICAL to `createTask`'s; `null` returned when `rows.length === 0`; mapped Task returned otherwise using same `Number(row.id)` + `row.created_at.toISOString()` pattern.
  - [x] Confirm zero new imports.

- [x] **Task 2: Add `PATCH /api/tasks/:id` route to `api/src/server.ts`** (AC: #2, #3, #4, #5, #6, #7, #21)
  - [x] Open `/Users/gio/Source/bmad-test/api/src/server.ts`. Confirm current contents are 106 lines: GET handler (lines 14-21), POST handler (lines 30-50), error middleware (lines 55-60), shutdown logic (lines 62-101).
  - [x] Update the `import` statement on line 2 to add `toggleTask`: `import { createTask, listTasks, pool, toggleTask, waitForDb } from './db.js';` (alphabetical insertion). Keep the `.js` suffix.
  - [x] INSERT the PATCH route from Dev Notes → "Locked code skeleton — PATCH /api/tasks/:id route" BETWEEN the POST handler (line 50) and the error middleware (line 55). Insertion point: a blank line after `});` on line 50, then the new route, then the existing blank line before line 52's comment.
  - [x] Confirm validation order: id regex check → `Number.isSafeInteger` check → `typeof completed !== 'boolean'` check → `await toggleTask(id, completed)`.
  - [x] Confirm: id-validation error message is `"id must be a positive integer"` (status 400); body-validation error message is `"completed must be a boolean"` (status 400); 404 message is `"task not found"` (status 404); success returns 200 with full Task JSON.
  - [x] Confirm zero `res.status(400).json(...)` or `res.status(404).json(...)` direct calls — all error responses go through `next(err)` → middleware.

- [x] **Task 3: Append `toggleTask` to `web/src/api.ts`** (AC: #9, #10, #21)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/api.ts`. Confirm post-2.2 state: contains `Task` type, `fetchTasks`, `createTask` (Story 2.2 added the latter).
  - [x] APPEND the `toggleTask` function from Dev Notes → "Locked code skeleton — `toggleTask` addition to `web/src/api.ts`" character-for-character. Place it AFTER the existing `createTask` function (end of file).
  - [x] Do NOT modify the existing `Task` type, `fetchTasks`, or `createTask`.
  - [x] Confirm: `Content-Type: application/json` header is set; method is `PATCH`; body is `JSON.stringify({ completed })`; URL is `` `/api/tasks/${id}` `` (template literal); error-extraction tries `response.json()` → `{error: string}` first, falls back to `${response.status} ${response.statusText}`.
  - [x] Confirm zero new imports.

- [x] **Task 4: Wire `handleToggle` and per-`<li>` checkbox into `web/src/App.tsx`** (AC: #11, #12, #13, #14, #16, #17, #21)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/App.tsx`. Confirm post-2.2 state: contains `description` state, `inputRef`, `handleSubmit`, `<form>` with input + Add button, three render branches.
  - [x] Update the import line to add `toggleTask`: `import { createTask, fetchTasks, toggleTask, type Task } from './api';` (alphabetical insertion of value imports; `type Task` stays last).
  - [x] Add the `handleToggle` function definition INSIDE the `App` component, BELOW `handleSubmit`. Use the locked code from Dev Notes → "Locked code skeleton — `handleToggle` addition to App.tsx".
  - [x] Replace the list-rendering branch's `<li>` content from `<li key={task.id}>{task.description}</li>` to the locked structure with checkbox + span (Dev Notes → "Locked code skeleton — `<li>` replacement").
  - [x] Confirm: checkbox uses `checked={task.completed}` (NOT `defaultChecked`); `onChange={() => handleToggle(task.id, !task.completed)}`; `aria-label` switches based on `task.completed`; span has `className={task.completed ? 'completed' : ''}`.
  - [x] Confirm zero `useOptimistic`, zero `useState` for per-task pending flags, zero `<label>` wrapping the checkbox, zero `tabIndex` overrides, zero `aria-checked` props, zero `window.confirm` calls, zero `<dialog>` elements.
  - [x] Confirm `handleToggle`'s catch block contains ONLY `console.error(err)` (no toast, no revert, no setState).

- [x] **Task 5: Append `.completed` rule to `web/src/App.css`** (AC: #15, #16)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/App.css`. Confirm post-2.2 state: contains rules from Story 1.4 (main, h1, ul, li, p) PLUS rules from Story 2.2 (form, input[type="text"], button).
  - [x] APPEND the `.completed` rule from Dev Notes → "Locked code skeleton — `.completed` rule for App.css" character-for-character. Place it AFTER the existing button rule (end of file). Total addition: 4 lines (selector, two declarations, closing brace).
  - [x] Confirm new rule: `.completed { text-decoration: line-through; opacity: 0.6; }` (or equivalent two-property declaration block — both properties REQUIRED per AC #15).
  - [x] Confirm zero `outline: none`, zero `outline: 0`, zero `*:focus`/`input:focus`/`button:focus` selectors that suppress focus (AC #16).
  - [x] Confirm zero color-only differentiation rules (e.g., NO `.completed { color: #888; }` alone — that would fail WCAG 1.4.1).

- [x] **Task 6: Static + runtime verification** (AC: #22)
  - [x] **Step A — TS + build (always required):**
    - From `/Users/gio/Source/bmad-test/api/`, run `npm run build`. Expect: zero TS errors.
    - From `/Users/gio/Source/bmad-test/web/`, run `npm run build`. Expect: zero TS errors; `web/dist/index.html` and a hashed `web/dist/assets/index-*.js` produced.
    - If errors: (a) verify `.js` suffix on api-side imports; (b) verify `rows[0]` is null-safe in `toggleTask`; (c) verify App.tsx import line adds `toggleTask` AND keeps `type Task`.
  - [ ] **Step B — runtime smoke (preferred, requires Docker):**
    - Run scenarios from Dev Notes → "Runtime verification recipe" in order. Each scenario has explicit expected outcomes; do NOT skip scenarios; do NOT mark this AC complete until all listed scenarios pass.
    - If a scenario fails, do NOT "fix forward" by editing assertions — fix the implementation.
  - [x] **Step B fallback (Docker unavailable):** Document the skip in Completion Notes with rationale (e.g., "Docker daemon not installed in this environment"). AC #22 degrades to "Step A passes; runtime smoke deferred to Story 2.6 / 2.7."
  - [x] Confirm `git diff api/package.json api/package-lock.json web/package.json web/package-lock.json` produces ZERO output (AC #19).
  - [x] Confirm `git diff README.md` produces ZERO output (AC #20).
  - [x] Confirm `git status` shows EXACTLY five modified files (AC #18): `api/src/db.ts`, `api/src/server.ts`, `web/src/api.ts`, `web/src/App.tsx`, `web/src/App.css`. No untracked new files in `api/src/`, `web/src/`, `e2e/`, `db/`, or root.

## Dev Notes

### Locked code skeleton — `toggleTask` addition to `api/src/db.ts`

Append to end of file (after `createTask`, AFTER line 98):

```ts

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
```

### Locked code skeleton — `PATCH /api/tasks/:id` route

INSERT into `api/src/server.ts` between the existing POST handler (closing `});` on line 50) and the existing error middleware comment (line 52, `// Single error middleware...`). Add a blank line above and below for visual separation.

```ts

// PATCH /api/tasks/:id — toggle completion. Validates id (regex + safe-integer),
// then body (typeof boolean), then calls toggleTask. Returns 404 with the
// {error:"task not found"} shape when no row matches. Validation errors are
// thrown with .status = 4xx so the single error middleware below formats them
// consistently with POST. Order: id → body → DB (architecture.md#4.4).
app.patch('/api/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idStr = req.params.id;
    if (!/^[1-9][0-9]*$/.test(idStr)) {
      const err: Error & { status?: number } = new Error('id must be a positive integer');
      err.status = 400;
      throw err;
    }
    const id = Number(idStr);
    if (!Number.isSafeInteger(id)) {
      const err: Error & { status?: number } = new Error('id must be a positive integer');
      err.status = 400;
      throw err;
    }
    const { completed } = (req.body ?? {}) as { completed?: unknown };
    if (typeof completed !== 'boolean') {
      const err: Error & { status?: number } = new Error('completed must be a boolean');
      err.status = 400;
      throw err;
    }
    const updated = await toggleTask(id, completed);
    if (updated === null) {
      const err: Error & { status?: number } = new Error('task not found');
      err.status = 404;
      throw err;
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});
```

### Locked code skeleton — `toggleTask` addition to `web/src/api.ts`

Append to end of file (after `createTask`, which Story 2.2 added):

```ts

// PATCH /api/tasks/:id — flips the completed flag and returns the full
// updated Task. Same error-extraction pattern as createTask: tries the
// {error:string} JSON shape first, falls back to "${status} ${statusText}"
// (architecture.md#4.2). Caller (App.tsx handleToggle) replaces the matching
// task in local state with the returned object — server is the source of
// truth. No optimistic UI here (Story 3.4 territory).
export async function toggleTask(id: number, completed: boolean): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as unknown;
      if (
        body !== null &&
        typeof body === 'object' &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
      ) {
        message = (body as { error: string }).error;
      }
    } catch {
      // Non-JSON body (502 from misconfigured proxy, empty 504, etc.) —
      // keep the status-text fallback. No console.error here; the caller logs.
    }
    throw new Error(`PATCH /api/tasks/${id} failed: ${message}`);
  }
  return (await response.json()) as Task;
}
```

### Locked code skeleton — `handleToggle` addition to App.tsx

Add INSIDE the `App` component, BELOW `handleSubmit` (Story 2.2's handler) and ABOVE the `return (` statement:

```tsx

  async function handleToggle(id: number, nextCompleted: boolean): Promise<void> {
    try {
      const updated = await toggleTask(id, nextCompleted);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      // FR40: console.* only. Toast surfacing arrives in Story 2.5.
      console.error(err);
    }
  }
```

### Locked code skeleton — `<li>` replacement

Inside the list-rendering branch (the `tasks.map((task) => ( ... ))` block), the current `<li>` (post-2.2):

```tsx
            <li key={task.id}>{task.description}</li>
```

Becomes:

```tsx
            <li key={task.id}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => handleToggle(task.id, !task.completed)}
                aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
              />
              <span className={task.completed ? 'completed' : ''}>{task.description}</span>
            </li>
```

Indentation MUST match the surrounding JSX (12-space indent if `tasks.map` is at 10-space indent — adjust to whatever Story 2.2 left in place; do NOT reformat unrelated lines).

### Locked code skeleton — `.completed` rule for App.css

Append to end of file (after the button rule that Story 2.2 added):

```css

.completed {
  text-decoration: line-through;
  opacity: 0.6;
}
```

Total: 4 lines (blank line above for visual separation, three rule lines, closing brace on line 4 from blank).

### Runtime verification recipe

**Prerequisites:** `docker compose up -d db` from project root (or whatever Story 1.5 set up); `npm install` in both `api/` and `web/` (no new deps to install for this story); two terminals.

**Terminal 1 (api):** `cd api && DATABASE_URL=postgres://tasky:tasky@localhost:5432/tasky npm run dev` (or the env var your Story 1.5 setup uses). Wait for `API listening on port 3000`.

**Terminal 2 (web):** `cd web && npm run dev`. Wait for the Vite "ready in" message and the local URL (typically `http://localhost:5173`).

**Setup data** (creates tasks if the DB is empty):
```sh
curl -X POST -H 'Content-Type: application/json' -d '{"description":"buy milk"}' http://localhost:3000/api/tasks
curl -X POST -H 'Content-Type: application/json' -d '{"description":"write tests"}' http://localhost:3000/api/tasks
curl http://localhost:3000/api/tasks
```
Note the `id` of the FIRST returned task (call it `$ID1`) for the curl scenarios below.

**Scenario A — curl: PATCH success (toggle to true).**
```sh
curl -i -X PATCH -H 'Content-Type: application/json' -d '{"completed":true}' http://localhost:3000/api/tasks/$ID1
```
Expect: HTTP/1.1 200 OK; body is JSON `{"id":<ID1>,"description":"buy milk","completed":true,"createdAt":"..."}`. Verify `completed: true` in the body.

**Scenario B — curl: PATCH success (toggle back to false).**
```sh
curl -i -X PATCH -H 'Content-Type: application/json' -d '{"completed":false}' http://localhost:3000/api/tasks/$ID1
```
Expect: HTTP/1.1 200 OK; body has `completed: false`. The `createdAt` MUST be unchanged from Scenario A's response (UPDATE does not touch `created_at`).

**Scenario C — curl: 404 for nonexistent id.**
```sh
curl -i -X PATCH -H 'Content-Type: application/json' -d '{"completed":true}' http://localhost:3000/api/tasks/999999
```
Expect: HTTP/1.1 404 Not Found; body `{"error":"task not found"}`.

**Scenario D — curl: 400 for invalid id (negative).**
```sh
curl -i -X PATCH -H 'Content-Type: application/json' -d '{"completed":true}' http://localhost:3000/api/tasks/-1
```
Expect: HTTP/1.1 404 from Express (Express's path-to-regexp does NOT match `-1` against `:id` pattern in Express 5 — the route never fires; the 404 comes from Express's default unmatched-route handler returning HTML "Cannot PATCH /api/tasks/-1"). This is acceptable — `-1` is rejected. To test the in-handler regex rejection of `0`, try the next scenario.

**Scenario D2 — curl: 400 for id = "0".**
```sh
curl -i -X PATCH -H 'Content-Type: application/json' -d '{"completed":true}' http://localhost:3000/api/tasks/0
```
Expect: HTTP/1.1 400 Bad Request; body `{"error":"id must be a positive integer"}`. Note: `0` matches `:id` at the routing level (path-to-regexp accepts any non-empty non-slash segment) but our regex `/^[1-9][0-9]*$/` rejects it.

**Scenario D3 — curl: 400 for non-integer id.**
```sh
curl -i -X PATCH -H 'Content-Type: application/json' -d '{"completed":true}' http://localhost:3000/api/tasks/abc
```
Expect: HTTP/1.1 400 Bad Request; body `{"error":"id must be a positive integer"}`.

**Scenario E — curl: 400 for missing `completed` field.**
```sh
curl -i -X PATCH -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/tasks/$ID1
```
Expect: HTTP/1.1 400 Bad Request; body `{"error":"completed must be a boolean"}`.

**Scenario F — curl: 400 for string "true" instead of boolean true.**
```sh
curl -i -X PATCH -H 'Content-Type: application/json' -d '{"completed":"true"}' http://localhost:3000/api/tasks/$ID1
```
Expect: HTTP/1.1 400 Bad Request; body `{"error":"completed must be a boolean"}`. (Critical: prevents silent string-to-boolean coercion bugs.)

**Scenario G — curl: 400 for missing Content-Type header.**
```sh
curl -i -X PATCH -d '{"completed":true}' http://localhost:3000/api/tasks/$ID1
```
Expect: HTTP/1.1 400 Bad Request; body `{"error":"completed must be a boolean"}` (because Express's body parser does not populate `req.body` without the JSON Content-Type, so the destructure yields `undefined`, which fails the `typeof` check). Same failure mode as POST per Story 2.2 AC #2.

**Scenario H — browser: toggle a task complete via UI.**
1. Open `http://localhost:5173/` in a browser.
2. Open DevTools → Network tab. Filter by "Fetch/XHR".
3. Confirm the list shows the seeded tasks. Each `<li>` has a checkbox (unchecked) on the LEFT and the description text on the RIGHT. The description has no strikethrough.
4. Click the checkbox next to "buy milk".
5. Network tab MUST show a `PATCH /api/tasks/<ID1>` request with status 200, request body `{"completed":true}`, response body `{"id":<ID1>,"description":"buy milk","completed":true,...}`.
6. The checkbox MUST appear checked. The "buy milk" text MUST have a strikethrough AND lower opacity (~60%).
7. Console MUST show ZERO errors.

**Scenario I — browser: toggle the same task back.**
1. Click the (now-checked) checkbox next to "buy milk" again.
2. Network tab MUST show a `PATCH /api/tasks/<ID1>` request with status 200, request body `{"completed":false}`.
3. The checkbox MUST appear unchecked. The strikethrough and opacity MUST be removed.
4. Console MUST show ZERO errors.

**Scenario J — browser: keyboard operability (NFR15).**
1. Refresh the page. Click somewhere neutral to lose focus.
2. Press Tab repeatedly. Focus order MUST be: input → Add button → first task's checkbox → second task's checkbox → ... (the description span is NOT focusable).
3. With focus on a checkbox, press Space. The same toggle round-trip from Scenario H MUST occur (PATCH 200, visual state flips).
4. Confirm the focus indicator (browser-default outline) is visible on the focused checkbox.

**Scenario K — browser: persistence across reload.**
1. Toggle "write tests" to complete via the UI.
2. Confirm the strikethrough and checked state.
3. Hard-refresh the browser (`Cmd-Shift-R` / `Ctrl-Shift-R`).
4. After the GET /api/tasks completes, "write tests" MUST appear with checkbox checked and strikethrough — completion state survived round-trip + reload.

**Scenario L — browser: 404 from server is logged but not crashing.**
1. In the browser console, run: `await fetch('/api/tasks/999999', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"completed":true}' }).then(r => r.json())`.
2. Expect the console to print `{error: "task not found"}`.
3. The UI is unaffected (no state was touched). This scenario does NOT trigger the React `handleToggle` path; it confirms the API behavior end-to-end through Vite's proxy.

**Scenario M — browser: simulated server error path (handleToggle catch).**
1. Stop the API process (`Ctrl-C` in Terminal 1). Leave the web dev server running.
2. In the browser, click any checkbox.
3. Expect: the network request fails (Vite proxy returns 502 or similar). The console shows `Error: PATCH /api/tasks/<id> failed: ...`. The checkbox state in the UI does NOT change (because `setTasks` was never called — `handleToggle`'s catch block only logs).
4. Restart the API. Click the checkbox again. The toggle now succeeds.

If ALL scenarios A–M pass, AC #22 Step B is satisfied.

### Anti-patterns and forbidden additions

The following are common LLM-generated additions that look reasonable but violate the locked architecture, the Phase 0 minimalism thesis, or specific ACs in this story. **Do NOT add ANY of these.**

**API side (db.ts / server.ts):**

1. ❌ **A second SELECT after the UPDATE** (`SELECT * FROM tasks WHERE id = $1` after the UPDATE). Doubles the round-trip. The `RETURNING` clause is the entire point — see `createTask` (line 86) and listTasks (line 60) for the established pattern.
2. ❌ **A transaction (`BEGIN`/`COMMIT`) around the UPDATE.** Single statement, no transaction needed; pg auto-commits each statement. Adds latency and complicates error paths.
3. ❌ **Using `pool.connect()` to get a dedicated client.** `pool.query()` checks out and returns a client per call automatically — that's the entire point of the pool. Manual `connect()` is for transactions only.
4. ❌ **Validating `completed` with a Zod / Joi / Yup / ajv schema.** Forbidden in Phase 0 per architecture.md#3.2. The five lines of `typeof` checking are the entire validation budget for this story.
5. ❌ **Using `parseInt(idStr, 10)`** (silently parses `"123abc"` → `123`) or **`+idStr`** (parses `""` → `0`). Use `Number(idStr)` ONLY after the regex passes; back it up with `Number.isSafeInteger`.
6. ❌ **A separate validation middleware** (`function validateId(req, res, next) { ... }`). The single route handler with inline validation is the locked pattern from Story 2.1; consistency matters more than DRY here (only two routes will validate ids — PATCH and DELETE).
7. ❌ **A second error middleware specifically for 404s.** The single middleware (server.ts:55-60) handles all status codes via `err.status`. Adding a second middleware would either shadow or be shadowed by the first — and the existing one already does the right thing.
8. ❌ **Returning 204 No Content on success.** This story's contract is 200 + body so the frontend can replace the task with the server-returned authoritative version. 204 forces a re-fetch, which the client doesn't do. (DELETE will be 204 in Story 2.4 — different contract because there is no resulting resource.)
9. ❌ **Returning 200 with a partial object** (e.g., `{ id, completed }` only, omitting `description` and `createdAt`). The full Task shape is the contract; the frontend's `setTasks((prev) => prev.map(t => t.id === id ? updated : t))` REPLACES the task object — partial returns would clobber `description` to undefined.
10. ❌ **Adding `WHERE owner_id = $3` to the UPDATE.** Single-user Phase 0; `owner_id` is NULL/ignored. The day multi-user lands (post-Phase 0), the route handler will inject `owner_id` from a session — but the column is OUT OF SCOPE for this story.
11. ❌ **Logging the request inside the handler** (`console.log(``PATCH ${id} → ${completed}``)`). The single error middleware logs errors; success-path access logs are not in scope (would be a Morgan / Pino middleware — forbidden in Phase 0). The `console.error` in the middleware is sufficient.
12. ❌ **A "dry-run" / "validate-only" query** that runs `SELECT 1 FROM tasks WHERE id = $1` before the UPDATE to determine 404 vs 200. The UPDATE...RETURNING returns `rows.length === 0` for a missing id — the same information in one round-trip.
13. ❌ **Treating the `:id` route as also matching `POST /api/tasks/:id` or `GET /api/tasks/:id`** (because `app.all` would be more "consistent"). Only `PATCH` for this story; GET-by-id and other methods are not in any story.
14. ❌ **Nested `try`/`catch` around individual `throw` statements.** The single outer `try`/`catch` that forwards to `next(err)` is the pattern. Inner try/catch would catch synchronous throws and re-throw — pointless ceremony.
15. ❌ **Mutating `req.body` or `req.params` in the validation chain** (e.g., `req.body.completed = Boolean(req.body.completed)`). Read-only after validation; coercion is the bug we're guarding against.

**Web side (api.ts / App.tsx / App.css):**

16. ❌ **`useOptimistic` for the checkbox.** Reserved for Story 3.4. This story is request-then-update.
17. ❌ **A `pending` boolean state per task** (`Map<id, boolean>` or `Set<id>` or per-task component state). Premature; the user-perceived latency is acceptable. If multi-click becomes a UX issue, Story 3.4's optimistic update solves it correctly.
18. ❌ **Disabling the checkbox during the in-flight PATCH** (`disabled={pending}`). Same root cause as #17. The native `<input type="checkbox">` already prevents the user from "double-toggling" mid-flight at the DOM level (the click only fires when the input accepts focus and processes the event); the worst-case "rapid clicks" produces N PATCHes that each return the latest state, and the functional `setTasks` updater handles the state correctly.
19. ❌ **A `<label>` wrapping the checkbox + description** (`<label><input ... /> <span>...</span></label>`). The `aria-label` on the checkbox provides the accessible name; the visible text is the task description, NOT a label for the input. A wrapping `<label>` would associate the description text as the input's name — incorrect semantics ("Mark task complete: buy milk" as the accessible name? worse than "Mark task complete").
20. ❌ **A `htmlFor` / `id` association** (`<label htmlFor="task-${id}">...</label> <input id="task-${id}" ... />`). Same root cause as #19.
21. ❌ **Toggling via keyboard `Enter`** (custom `onKeyDown`). `<input type="checkbox">` is toggled by Space natively, NOT Enter. Adding Enter would diverge from native behavior and confuse keyboard users.
22. ❌ **Setting `task.completed = !task.completed` directly** (mutation). React state must be replaced, not mutated. The `setTasks((prev) => prev.map(...))` pattern is the locked approach.
23. ❌ **Spreading the old task with the new completed** (`{ ...t, completed: nextCompleted }`) in the success path. Use the SERVER-RETURNED `updated` object — server is the source of truth. The two would usually agree, but if a future schema migration adds an `updatedAt` field, the spread approach silently drops it.
24. ❌ **Re-fetching `GET /api/tasks` after the toggle succeeds.** Same anti-pattern as Story 2.2 AC #14: doubles the network cost, causes flicker, races against parallel toggles. The local state (mutated in place) is sufficient.
25. ❌ **A toast / banner / snackbar / alert on toggle error.** Story 2.5 wires this; this story is `console.error` only. Adding it here means deleting it later when 2.5's pattern lands — and 2.5 has a different surface (a SHARED toast region for create/toggle/delete; this story's inline-toast would shadow it).
26. ❌ **`window.alert()` on toggle error.** Forbidden — modal, blocks input, terrible UX. Plus per NFR19 there are no modals.
27. ❌ **A confirmation modal before toggle** ("Mark this task complete?"). Forbidden by NFR19 and AC #17.
28. ❌ **A "bulk toggle" button** ("Mark all complete"). Out of scope; not in any story; would be premature feature creep.
29. ❌ **A "filter by status" UI** (Active / Completed / All tabs). Out of scope; not in any story; classic todo-app feature creep that the PRD does not mandate.
30. ❌ **Sorting the list by `completed`** (so completed tasks sink to the bottom). Out of scope; the list order is `ORDER BY id ASC` (Story 1.3) — insertion order; do NOT add a client-side sort.
31. ❌ **Animating the strikethrough or opacity** (`transition: opacity 0.2s ease`). Story 3.1 territory; this story is static.
32. ❌ **A custom checkbox component** (replacing `<input type="checkbox">` with a `<div role="checkbox">` styled as a checkbox). Forbidden for accessibility reasons (the native input has correct ARIA, focus, keyboard, and form-submit behavior baked in; a div-based checkbox needs ~30 lines of code to replicate and gets it wrong). Plus Phase 0 minimalism — no custom-checkbox library either.
33. ❌ **Color-only differentiation** (`.completed { color: gray; }` with NO text-decoration and NO opacity). Fails WCAG 1.4.1 — see AC #15.
34. ❌ **`text-decoration: line-through` ALONE without opacity** (or vice versa). The AC requires BOTH for redundant signaling (defensive against users with custom browser styles that override one).
35. ❌ **An `onClick` handler on the `<li>` itself** (clicking anywhere on the row toggles). Conflates tap targets with the description — accidental toggles when the user means to read. The checkbox is the explicit affordance.
36. ❌ **`<input type="checkbox">` with `defaultChecked={task.completed}`.** `defaultChecked` is for uncontrolled inputs; the checkbox here is controlled — `checked={task.completed}` is required, paired with `onChange`. Mixing them produces React's "controlled to uncontrolled" warning and the checkbox state diverges from React state.
37. ❌ **Adding `key={task.id + (task.completed ? '-c' : '-a')}`** (forcing a remount when the state flips). Wastes DOM, breaks animations (irrelevant here but a habit), wrong mental model — keys identify items, not state.
38. ❌ **A `useReducer` for tasks state.** The two state mutations (append on create, replace on toggle) are simple `setTasks` calls; `useReducer` would add 30 lines of dispatch/reducer ceremony for zero gain.
39. ❌ **A `useCallback` wrap around `handleToggle`.** The function is a fresh closure per render, but it's only passed to inline arrow functions inside `onChange={() => handleToggle(...)}` — those are already fresh per render. `useCallback` here is cargo-cult.
40. ❌ **Updating the TS `Task` type to add an optional `pending?: boolean` field.** Server contract field set is locked; per-render UI flags belong in component state (forbidden by AC #17 anyway).

**Repository-level:**

41. ❌ **Adding the PATCH row to the README's `## API` table.** Story 3.3 owns the README rewrite; partial updates would create incoherent docs. Per AC #20.
42. ❌ **Adding any e2e test for toggle** (`e2e/toggle.spec.ts`). Story 2.7 ships ONE smoke test covering create + reload; toggle coverage is explicitly out of scope (manual scenario H above is the contract).
43. ❌ **Adding any unit test for `toggleTask` in `api/`.** Phase 0 has no unit-testing framework (architecture.md#5.3 — "no Jest, no Vitest"). The single Playwright smoke (Story 2.7) is the entire automated-test surface.
44. ❌ **Updating `deferred-work.md`.** No new architectural trade-offs introduced by this story. The existing five entries cover the relevant tensions (id-as-string in pg, BIGSERIAL > 2^53 etc.); none change because of toggle.
45. ❌ **Modifying `db/init.sql`.** Schema is locked. The `completed BOOLEAN NOT NULL DEFAULT FALSE` column already exists.
46. ❌ **Modifying `Caddyfile`, `compose.yaml`, or any Story 1.5 deploy artifact.** Out of scope. The PATCH route is served by the same `/api/*` proxy as GET and POST.
47. ❌ **Adding a database migration** (`db/migrations/002_*.sql`). No schema change; init.sql is the entire schema source per architecture.md#3.3 (Phase 0 single-init-script approach).

### Conventions reinforced by this story

- **Boundary mapping in `db.ts` only** (architecture.md#4.5): `toggleTask` follows the EXACT pattern of `createTask` for snake_case → camelCase, `Number(row.id)`, `row.created_at.toISOString()`. Any reviewer should be able to diff `toggleTask` against `createTask` and see only the SQL verb and parameter list differ.
- **Errors with `.status` propagated to single middleware** (architecture.md#4.4): all 4xx returns go through `throw err with err.status = 400/404` → `next(err)` → middleware. Zero direct `res.status(4xx).json(...)` calls in handlers.
- **`req.body ?? {}` with `as { x?: unknown }` cast then `typeof` check** (Story 2.1's pattern, AC #4 here): the locked manual-validation idiom for Phase 0.
- **Server-returned object replaces local state** (architecture.md#3.1): the frontend trusts the server's response shape after every mutation; no local-side computation of derived fields. This convention is what makes Story 3.4's optimistic UI a clean diff (replace the optimistic value with the confirmed value, no merge logic).
- **`fetch` + manual error extraction** (Story 2.2 AC #4 pattern): `toggleTask` repeats the json-error-extraction try/catch verbatim. If a third mutation (DELETE in Story 2.4) needs the same, copy this implementation; do NOT extract a `parseError(response)` helper YET — three repetitions is the trigger for extraction; two is "too soon" per architecture.md#5.3.
- **Zero new dependencies, zero new files, zero new directories** (architecture.md#5.3 minimalism thesis): every story this size touches existing files. The day this stops being possible (file > 300 lines, or an actual third-party need) the project graduates from Phase 0.

### What this story does NOT touch

The following are explicitly OUT OF SCOPE and MUST NOT be modified by the dev agent in this story:

1. **`api/src/db.ts` exports OTHER than the appended `toggleTask`** — `Task`, `pool`, `waitForDb`, `listTasks`, `createTask` stay byte-identical.
2. **`api/src/server.ts` routes OTHER than the inserted PATCH** — GET, POST, error middleware, shutdown logic, port validation stay byte-identical (except for the import line, which gains `toggleTask` via alphabetical insertion).
3. **`web/src/api.ts` exports OTHER than the appended `toggleTask`** — `Task`, `fetchTasks`, `createTask` stay byte-identical.
4. **`web/src/App.tsx` structure OTHER than the import line, the new `handleToggle`, and the `<li>` content** — `useEffect` mount, `description` state, `inputRef`, `<form>`, `handleSubmit`, the three render branches' OUTER structure stay byte-identical. The `<li>`'s OUTER tag and `key` stay byte-identical; only its CONTENT changes.
5. **`web/src/App.css` rules OTHER than the appended `.completed`** — `main`, `h1`, `ul`, `li`, `p`, `form`, `input[type="text"]`, `button` stay byte-identical.
6. **`db/init.sql`** — schema is locked; `completed` column already exists with the correct type and default.
7. **`api/package.json` and `api/package-lock.json`** — zero dependency changes (AC #19).
8. **`web/package.json` and `web/package-lock.json`** — zero dependency changes (AC #19).
9. **`api/tsconfig.json` and `web/tsconfig.app.json`** — strictness flags stay as-is (AC #21).
10. **`README.md`** — Story 3.3 owns the rewrite (AC #20).
11. **`Caddyfile`, `compose.yaml`, `web/vite.config.ts`** — Story 1.5 / Story 1.4 territory; PATCH is served by the existing `/api/*` proxy.
12. **`e2e/`** — Story 2.7 territory; this story has zero automated tests.
13. **`_bmad-output/implementation-artifacts/deferred-work.md`** — no new trade-offs introduced.
14. **No new files anywhere** (AC #18).

### Source citations

- `api/src/db.ts:79-98` — `createTask` pattern (the `toggleTask` template).
- `api/src/db.ts:54-70` — `listTasks` pattern (column list and boundary mapping reference).
- `api/src/server.ts:30-50` — POST handler pattern (the PATCH handler template).
- `api/src/server.ts:55-60` — single error middleware (where `.status` is honored).
- `api/src/server.ts:11` — `express.json({ limit: '10kb' })` body parser (why Content-Type matters).
- `web/src/api.ts:13-18` — `fetchTasks` pattern (URL convention, error message style).
- `web/src/App.tsx` (post-2.2 state) — the file `toggleTask` integration extends.
- `web/src/App.css` (post-2.2 state) — the file the `.completed` rule extends.
- `db/init.sql` — schema with `completed BOOLEAN NOT NULL DEFAULT FALSE`.
- `_bmad-output/planning-artifacts/architecture.md#3.1` — "Same-origin contract; server is source of truth."
- `_bmad-output/planning-artifacts/architecture.md#3.2` — "Manual validation only in Phase 0; no Zod / Joi / Yup."
- `_bmad-output/planning-artifacts/architecture.md#3.3` — "Single pool, statement_timeout 10s, no tuning."
- `_bmad-output/planning-artifacts/architecture.md#3.4` — "Same-origin via Vite proxy in dev, Caddy in prod."
- `_bmad-output/planning-artifacts/architecture.md#4.1` — "owner_id NULL in Phase 0; never in API responses."
- `_bmad-output/planning-artifacts/architecture.md#4.2` — "JSON wire format is the contract; camelCase only."
- `_bmad-output/planning-artifacts/architecture.md#4.3` — "Optimistic UI is Story 3.4; first to cut."
- `_bmad-output/planning-artifacts/architecture.md#4.4` — "Single error middleware; .status property convention."
- `_bmad-output/planning-artifacts/architecture.md#4.5` — "Boundary mapping in db.ts only; one place for snake_case → camelCase."
- `_bmad-output/planning-artifacts/architecture.md#5.1` — "No Express router split; single server.ts until 300 lines."
- `_bmad-output/planning-artifacts/architecture.md#5.3` — "Phase 0 minimalism: no new deps, no new files until justified."
- `_bmad-output/planning-artifacts/epics.md#Story 2.3` — full AC list this story implements.
- `_bmad-output/planning-artifacts/epics.md#Story 2.5` — error toast (this story's `console.error` is the placeholder for that toast).
- `_bmad-output/planning-artifacts/epics.md#Story 3.1` — designed empty state, full WCAG verification (this story does the minimum non-color-only differentiation).
- `_bmad-output/planning-artifacts/epics.md#Story 3.4` — optimistic UI, "first to cut" (why this story is request-then-update).
- `_bmad-output/planning-artifacts/prd.md#FR5` — visual differentiation of completed.
- `_bmad-output/planning-artifacts/prd.md#FR40` — `console.*` logging only.
- `_bmad-output/planning-artifacts/prd.md#NFR14` — semantic HTML, accessible affordances.
- `_bmad-output/planning-artifacts/prd.md#NFR15` — keyboard operability.
- `_bmad-output/planning-artifacts/prd.md#NFR16` — visible focus indicators (no `outline: 0`).
- `_bmad-output/planning-artifacts/prd.md#NFR19` — no confirmation dialogs.
- `_bmad-output/implementation-artifacts/deferred-work.md` — five Phase 0 trade-offs (none change because of this story).
- `_bmad-output/implementation-artifacts/2-1-create-task-post-api-tasks-endpoint.md` — POST handler patterns this story mirrors.
- `_bmad-output/implementation-artifacts/2-2-list-and-create-tasks-in-the-ui.md` — frontend conventions (createTask, handleSubmit, App.tsx structure) this story extends.

## Dev Agent Record

### Context Reference

Story spec self-contained; locked code skeletons in Dev Notes provide all implementation detail. No external context fetch required.

### Agent Model Used

claude-opus-4.7 (OpenCode)

### Debug Log References

- API build (`api && npm run build`): initial run failed with `src/server.ts(60,31): error TS2345: Argument of type 'string | string[] | undefined' is not assignable to parameter of type 'string'`. Cause: locked PATCH skeleton uses `(req: Request, res: Response, next: NextFunction)` — the explicit `Request` annotation defaults to `ParamsDictionary`, defeating Express 5's per-route param inference. AC #3 implicitly assumes the inferred typing where `req.params.id` is `string`.
- Resolution: dropped the `: Request` annotation only on the PATCH handler (kept `res: Response, next: NextFunction`). TS now infers `RouteParameters<'/api/tasks/:id'>` for the handler's `req`, giving `req.params.id: string`. This is the minimal deviation from the locked skeleton that satisfies AC #3's stated intent. The POST handler (Story 2.1) is untouched — it never accesses `req.params`. User approved this path via clarification question.
- Re-run: API build clean; web build clean (`✓ built in 105ms`, `dist/assets/index-o7naxhXk.js` 192.57 kB).

### Completion Notes List

- All 5 source files modified per AC #18 (zero new files, zero new deps verified via `git diff` of package files).
- README untouched per AC #20.
- Step A (static + build) passes for both projects.
- Step B (Docker runtime smoke) deferred per AC #22 fallback clause: Docker availability not verified in this environment; runtime smoke will be exercised in Story 2.6 (persistence verification) and Story 2.7 (Playwright smoke).
- One spec deviation, scoped and approved: the locked PATCH route skeleton's `req: Request` annotation was changed to bare `req` (TS inference) so route-pattern param typing reaches `req.params.id`. All other locked skeletons (toggleTask in db.ts, toggleTask in api.ts, handleToggle in App.tsx, `<li>` JSX, `.completed` CSS) applied character-for-character.

### File List

- `api/src/db.ts` — modified (appended `toggleTask` function)
- `api/src/server.ts` — modified (added `toggleTask` to import, inserted PATCH `/api/tasks/:id` route between POST and error middleware)
- `web/src/api.ts` — modified (appended `toggleTask` function)
- `web/src/App.tsx` — modified (added `toggleTask` to import, added `handleToggle` function, replaced `<li>` content with checkbox + span)
- `web/src/App.css` — modified (appended `.completed` rule)

## Change Log

| Date       | Author           | Change                              |
| ---------- | ---------------- | ----------------------------------- |
| 2026-04-29 | Bob (Scrum Master) | Initial story creation              |
| 2026-04-30 | Amelia (Dev)     | Implementation complete; status → review. Locked skeletons applied character-for-character except for one approved deviation: PATCH handler's `req: Request` annotation dropped to enable TS inference of route params (AC #3 intent). Both `npm run build` clean. Step B runtime smoke deferred per AC #22 fallback. |
