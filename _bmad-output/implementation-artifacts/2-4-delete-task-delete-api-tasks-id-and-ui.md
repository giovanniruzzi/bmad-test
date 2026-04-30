# Story 2.4: Delete task — `DELETE /api/tasks/:id` and UI

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As any individual with the URL,
I want to delete a task with a single tap,
so that I can clear completed or unwanted items without navigating to a separate screen.

## Acceptance Criteria

1. **`api/src/db.ts` gains a new `deleteTask(id: number): Promise<boolean>` function — and only that function is added.** It is APPENDED to the existing module (do NOT replace `Task`, `pool`, `waitForDb`, `listTasks`, `createTask`, or `toggleTask` — they were locked by Stories 1.2 / 1.3 / 2.1 / 2.3 and the file is currently 98 + ~30 (toggleTask from Story 2.3) lines). The function MUST issue a single parameterized SQL statement: `DELETE FROM tasks WHERE id = $1` and return `result.rowCount > 0` — i.e. `true` if a row was deleted, `false` if no row matched (the route handler converts `false` → 404). Use `await pool.query('DELETE FROM tasks WHERE id = $1', [id])` and read `result.rowCount`. NO `RETURNING` clause (we don't need the deleted row's content; only existence matters); NO second SELECT before the DELETE; NO transaction; NO `try`/`catch` inside `deleteTask` (let pg errors propagate to the route handler's `next(err)`). [Source: api/src/db.ts:79-98 (createTask pattern), architecture.md#3.2, architecture.md#4.5]

2. **`pg`'s `result.rowCount` is typed as `number | null` in the `pg` type definitions — handle the `null` defensively.** A `DELETE` always populates `rowCount` to a number in real Postgres responses, but the type system requires the null-check. Use `(result.rowCount ?? 0) > 0` as the boolean expression. Do NOT use `result.rowCount! > 0` (non-null assertion is unsafe — if pg ever returns null for some edge case, the assertion would crash with "Cannot read property of null"). Do NOT use `result.rowCount === 1` (technically correct but `> 0` is more defensive against any hypothetical future schema change that might allow ON DELETE CASCADE to delete more rows). [Source: pg type definitions; architecture.md#3.3 (raw pg, no abstraction)]

3. **`api/src/server.ts` gains a `DELETE /api/tasks/:id` route — and only that route is added.** It is APPENDED between the existing `PATCH /api/tasks/:id` handler (added by Story 2.3) and the error middleware (server.ts:55-60 in the current file; line numbers shift after Stories 2.1 / 2.3 land). The route handler MUST follow the EXACT shape of the `POST /api/tasks` handler (Story 2.1) and `PATCH /api/tasks/:id` handler (Story 2.3): `async (req, res, next) => { try { ... } catch (err) { next(err); } }`. Validation errors MUST be thrown with `.status = 400` (or `404`) so the single error middleware formats them as `{error: message}`. NO direct `res.status(4xx).json(...)` calls in the handler body. [Source: api/src/server.ts:30-50 (POST pattern), 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md AC #2]

4. **The `:id` URL parameter MUST be validated as a positive integer string — IDENTICAL chain to Story 2.3's PATCH route.** The validation chain MUST be: (a) `const idStr = req.params.id`; (b) `if (!/^[1-9][0-9]*$/.test(idStr))` throw 400 with `'id must be a positive integer'`; (c) `const id = Number(idStr)`; (d) `if (!Number.isSafeInteger(id))` throw 400 with `'id must be a positive integer'` (same message). The error message MUST be exactly `'id must be a positive integer'` — same wording as Story 2.3 so the wire contract is consistent and Story 2.5's toast logic doesn't need to special-case the verb. Do NOT extract a `validateId(req)` helper YET (this is the SECOND repetition of the chain — `parseError` extraction trigger from Story 2.3 conventions is THREE repetitions per architecture.md#5.3; if Story 3.x adds a fourth route taking `:id`, extract then). [Source: 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md AC #3, architecture.md#5.3]

5. **The DELETE route MUST NOT read or validate `req.body`.** RFC 9110 says `DELETE` requests MAY have a body but its semantics are undefined; the standard practice is to ignore it. Express's body parser `app.use(express.json({ limit: '10kb' }))` will still parse a JSON body if Content-Type is set (no harm, the parser is method-agnostic), but the handler MUST NOT inspect `req.body`. Do NOT add a "no body allowed" 400 check (over-engineered; RFC permits the body). Do NOT pass any second parameter to `deleteTask`. [Source: api/src/server.ts:11; RFC 9110 §9.3.5]

6. **404 with `{"error":"task not found"}` when `deleteTask(id)` returns `false`.** The exact body MUST be `{"error":"task not found"}` — IDENTICAL wording to Story 2.3's PATCH 404 (so toasts and curl-based smoke tests can rely on stable wording). Throw a `Error & { status?: number }` with `err.status = 404` and `err.message = 'task not found'`; the existing error middleware (server.ts) sees `status < 500` and uses `err.message` as the JSON `error` field. [Source: 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md AC #6, api/src/server.ts:55-60]

7. **204 No Content on success — NO body, NO `Content-Type` header.** Use `res.status(204).end()` (NOT `res.status(204).json(...)` — the JSON middleware would add a `Content-Type: application/json` header AND a `Content-Length` of however many bytes; both violate the 204 spec). Do NOT use `res.sendStatus(204)` — it sends the body `"No Content"` as a string, which violates the 204 spec (no body permitted) AND adds a `Content-Type: text/plain` header. Express's `res.status(204).end()` is the ONLY correct invocation. The 204 contract differs from PATCH's 200-with-body because there is no resource to return: the row is gone. [Source: epics.md#Story 2.4 AC, MDN HTTP 204; differs from 2-3 AC #7]

8. **The DB DELETE MUST be parameterized — `$1` for id.** SQL: `DELETE FROM tasks WHERE id = $1`. Do NOT string-interpolate `id` into the SQL (defense in depth — same reasoning as Story 2.3 AC #8). Do NOT add a `WHERE owner_id = ...` clause (single-user Phase 0). Do NOT use `RETURNING *` (we don't read the returned row; would waste bytes). Do NOT use `pg-format`. Do NOT use a query builder. [Source: api/src/db.ts:79-88, architecture.md#3.2, 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md AC #8]

9. **`web/src/api.ts` gains a new `deleteTask(id: number): Promise<void>` function — and only that function is added.** It is APPENDED to the existing module (do NOT replace `Task`, `fetchTasks`, `createTask`, or `toggleTask` — they were locked by Stories 1.4 / 2.2 / 2.3). The function issues `fetch(``/api/tasks/${id}``, { method: 'DELETE' })`, treats `!response.ok` as an error using the SAME json-error-extraction pattern that `createTask` and `toggleTask` use (try `response.json()`, look for `{error: string}`, fall back to `${status} ${statusText}`), and on success returns `undefined` (function return type is `Promise<void>`). NO request body, NO `Content-Type` header (the request has no body to type). NO `await response.json()` on success — the 204 response has no body, calling `.json()` would throw `SyntaxError: Unexpected end of JSON input`. [Source: web/src/api.ts (post-2.3 state), 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md AC #9, 2-2-list-and-create-tasks-in-the-ui.md AC #4]

10. **The error-extraction try/catch is now repeated for the THIRD time in `web/src/api.ts` (createTask, toggleTask, deleteTask) — and that IS the trigger to extract a helper.** Per architecture.md#5.3 ("three is the trigger; two is too soon"), this story EXTRACTS a `parseError(response: Response): Promise<string>` private helper at the top of `web/src/api.ts` (above `fetchTasks`), and `createTask`, `toggleTask`, `deleteTask` ALL call it. The helper signature: `async function parseError(response: Response): Promise<string> { ... }`; returns the extracted error message string (the caller composes the final `Error.message`). Refactor `createTask` and `toggleTask` to use the helper IN THIS STORY — do NOT defer the refactor. The function MUST be named `parseError` (not `extractError`, not `getErrorMessage` — `parseError` matches the json-parse-then-fallback semantics). NOT exported (`export` keyword absent — internal to api.ts). [Source: architecture.md#5.3; web/src/api.ts (post-2.3 state)]

11. **The `parseError` helper signature and behavior, locked:** `async function parseError(response: Response): Promise<string> { try { const body = (await response.json()) as unknown; if (body !== null && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') { return (body as { error: string }).error; } } catch { /* non-JSON body — fall through */ } return ``${response.status} ${response.statusText}``; }`. Identical logic to what 2.2 and 2.3 inline. The three callers wrap the returned string into their verb-specific Error message: `throw new Error(``POST /api/tasks failed: ${await parseError(response)}``)` etc. Do NOT change the verb-specific prefixes — they are diagnostic for the user (and for Story 2.5's toast, which uses the FULL `err.message`). [Source: 2-2-list-and-create-tasks-in-the-ui.md AC #4, 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md AC #9]

12. **`web/src/App.tsx` extends — does NOT replace — the Story 2.3 shell to add a Delete button per `<li>`.** The existing structure (mount-time `fetchTasks`, `description` state, `inputRef`, `<form>` with input + Add button, `handleSubmit`, `handleToggle`, three render branches with checkbox + span inside each `<li>`) is PRESERVED. The ONLY changes to the existing JSX are inside the `<li>` element of the list-rendering branch. After Story 2.4, that `<li>` MUST contain — IN THIS DOM ORDER — (a) the existing checkbox (unchanged from 2.3), (b) the existing description span (unchanged from 2.3), (c) a NEW `<button type="button">` with `onClick={() => handleDelete(task.id)}` and either visible text "Delete" OR `aria-label="Delete task"` for icon-only (this story uses VISIBLE TEXT — "Delete" — to keep CSS budget zero; see AC #14). NO changes to `key={task.id}`. [Source: web/src/App.tsx (post-2.3 state), epics.md#Story 2.4]

13. **The `handleDelete(id)` function MUST be defined inside the `App` component (alongside `handleSubmit` and `handleToggle`) and uses functional state updates to filter the task out.** Exact shape: `async function handleDelete(id: number): Promise<void> { try { await deleteTask(id); setTasks((prev) => prev.filter((t) => t.id !== id)); } catch (err) { console.error(err); } }`. The functional updater (`prev => prev.filter(...)`) is REQUIRED — two rapid deletes (e.g., user double-clicks Delete) would otherwise race on a stale `tasks` closure. The filter MUST happen ONLY after the API call resolves successfully (request-then-update — same pattern as `handleToggle`; NO optimistic UI). On error, `console.error(err)` and DO NOTHING ELSE — the task stays in the list because the local state was never mutated; the user can retry. (Story 2.5 wires the toast.) [Source: web/src/App.tsx (post-2.3 state), epics.md#Story 2.4, epics.md#Story 2.5]

14. **The Delete button MUST be a semantic `<button type="button">` with VISIBLE TEXT "Delete" — NOT an icon-only button, NOT a `<a href>`, NOT a `<div role="button">`.** Attributes: `type="button"` (REQUIRED — without it, browsers default to `type="submit"` for `<button>` inside a `<form>`; this button is OUTSIDE the form, so it would default to `type="submit"` for a hypothetical implicit form, but explicit is safer and prevents the bug if the JSX is ever moved). `onClick={() => handleDelete(task.id)}`. Inner text: `Delete` (string literal, no translation). NO `aria-label` (the visible text IS the accessible name; adding `aria-label="Delete task"` would OVERRIDE the visible text in screen readers — usually not what you want). NO `title="Delete"` tooltip (visual noise; the text is already visible). NO `disabled` toggling. NO confirmation dialog (per AC #18). [Source: prd.md#NFR14, prd.md#NFR15, epics.md#Story 2.4 AC, prd.md#NFR19]

15. **The Delete button is keyboard-operable via NATIVE browser behavior — Tab to focus, Enter OR Space to activate.** This is automatic for `<button>` in every major browser. Do NOT add `onKeyDown`. Do NOT add `tabIndex={0}` (default for buttons). The browser-default focus indicator on the button MUST remain visible — this story does NOT add any CSS that suppresses it. Story 2.2 already established the no-`outline:0` rule (AC #10 there); this story re-affirms by NOT adding any selector that suppresses focus on `button` (Story 2.2 added a generic `button` rule with padding/font-size/cursor but NO `outline` override — leave that as-is). [Source: prd.md#NFR15, prd.md#NFR16, web/src/App.css (post-2.3 state)]

16. **NO confirmation dialog before delete — per NFR19 — explicitly NO `window.confirm`, NO custom modal, NO two-step ("Click to delete" → "Click again to confirm").** Single click IS the action. This is the same anti-pattern bar as toggle (Story 2.3 AC #17), but doubly important here because deletion is destructive. The PRD accepts this trade-off explicitly: "out-of-scope: undo" (epics.md#Story 2.4) — the user takes responsibility for the click. (A future Story could introduce undo with a 5s grace period; this story does NOT.) [Source: prd.md#NFR19, epics.md#Story 2.4]

17. **NO optimistic UI in this story — the task is removed from the list ONLY after the server confirms (204 received).** Concretely: do NOT call `setTasks` BEFORE `await deleteTask(...)`. Do NOT use `useOptimistic` (Story 3.4 territory). Do NOT add a `pendingDelete` state per task. The user-perceived latency is one round-trip; acceptable per architecture.md#4.3. If the API call fails, the task stays in the list because the state was never mutated — no glitchy "snap back" animation. Story 3.4 may later add optimistic delete with revert-on-error. [Source: epics.md#Story 3.4, architecture.md#3.1, architecture.md#4.3]

18. **NO new files in `api/src/`, `web/src/`, `e2e/`, `db/`, or the project root.** This story's complete file-change set is exactly: `api/src/db.ts` (modified — append `deleteTask`), `api/src/server.ts` (modified — insert `DELETE /api/tasks/:id` route + extend import), `web/src/api.ts` (modified — append `deleteTask` AND extract `parseError` helper AND refactor `createTask`/`toggleTask` to use it), `web/src/App.tsx` (modified — add `handleDelete` and per-`<li>` Delete button + extend import), `web/src/App.css` (no change — see AC #19; if a new `.delete-button` selector is needed for visual separation from the description, ONE rule of ≤ 5 lines is permitted). Up to five files. Specifically, do NOT split into a `TaskItem.tsx` component, do NOT extract `useTaskMutations`, do NOT create `api/src/routes/`, do NOT create `web/src/lib/api-helpers.ts` for `parseError` — `parseError` lives at the top of `api.ts`. [Source: architecture.md#5.1, architecture.md#5.3]

19. **`web/src/App.css` change: AT MOST one new rule.** A `.delete-button` (or `button.delete`, or just `li button` if the only button inside `<li>` is the Delete button) selector adding a small `margin-left` to push the Delete button away from the description text. Total addition ≤ 5 lines, ZERO color rules, ZERO hover/focus overrides, ZERO transitions. If the layout looks acceptable WITHOUT any new rule (the existing Story 2.2 `button` rule's padding may suffice), add NOTHING — the goal is functional, not designed (Story 3.1 is design). The dev agent decides at runtime; the AC is "≤ 1 new rule, ≤ 5 added lines, zero color / focus / transition rules." [Source: epics.md#Story 3.1 (deferred design polish), architecture.md#5.3]

20. **NO new dependencies on either side.** API side: same forbidden list as Stories 2.1 / 2.3 — no `joi`, `zod`, `yup`, `ajv`, `class-validator`, `express-validator`, `celebrate`. Web side: same forbidden list as Stories 2.2 / 2.3 — no `axios`, `ky`, `@tanstack/react-query`, `swr`, `react-aria`, `@radix-ui/react-*`, `@headlessui/react`, `framer-motion`, `clsx`, `classnames`, `lodash.debounce`. The deps lists at the end of this story MUST be byte-identical to the start; `git diff api/package.json api/package-lock.json web/package.json web/package-lock.json` MUST produce empty output. [Source: architecture.md#3.1, architecture.md#3.2, architecture.md#5.3]

21. **NO README change in this story.** The `## API` table will gain GET/POST/PATCH/DELETE rows in Story 3.3 (full README rewrite). Same rationale as Stories 2.2 AC #17 and 2.3 AC #20. [Source: epics.md#Story 3.3]

22. **TypeScript strictness — code MUST satisfy BOTH `api/tsconfig.json` AND `web/tsconfig.app.json` flags as-is.** API side:
    - The `import { deleteTask, ... } from './db.js'` in server.ts MUST keep the `.js` suffix (nodenext requirement).
    - The `result.rowCount` access MUST handle `null` (`?? 0`) — see AC #2.
    - The pg query has no generic (no rows are read — `await pool.query('DELETE FROM tasks WHERE id = $1', [id])` infers `QueryResult<any>`; that's fine because we only read `rowCount`).
    Web side:
    - The import in App.tsx MUST be `import { createTask, deleteTask, fetchTasks, toggleTask, type Task } from './api'` (alphabetical insertion of value imports; `type Task` stays last).
    - The `parseError` helper MUST be `async function`, NOT exported (`export` keyword absent), placed at the top of `api.ts` ABOVE `fetchTasks`.
    - The `handleDelete` function signature MUST be `async function handleDelete(id: number): Promise<void>`.
    - Do NOT loosen any flag. [Source: api/tsconfig.json, web/tsconfig.app.json; 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md AC #21]

23. **Static + runtime verification — same pattern as Stories 2.1 / 2.2 / 2.3.** Three-step:
    - **Step A (always required):** `npm run build` from `api/` (zero TS errors), then `npm run build` from `web/` (zero TS errors, dist emitted). If errors: (a) check `.js` suffix on api-side imports; (b) check `result.rowCount ?? 0` null-safety; (c) check App.tsx import line includes `deleteTask` AND keeps `type Task`; (d) check `parseError` is at the top of `api.ts` and used by all three mutations.
    - **Step B (runtime, preferred):** Run the scenarios in Dev Notes → "Runtime verification recipe" — both `curl` (API direct) and browser (full UI flow). All scenarios must pass.
    - **Step B fallback (Docker unavailable):** Document skip in Completion Notes.

## Tasks / Subtasks

- [x] **Task 1: Append `deleteTask` to `api/src/db.ts`** (AC: #1, #2, #8, #22)
  - [x] Open `/Users/gio/Source/bmad-test/api/src/db.ts`. Confirm post-2.3 state: file contains `Task`, `pool`, `waitForDb`, `listTasks`, `createTask`, `toggleTask`.
  - [x] APPEND the `deleteTask` function from Dev Notes → "Locked code skeleton — `deleteTask` addition to `api/src/db.ts`" character-for-character. Place it AFTER the existing `toggleTask` function (end of file).
  - [x] Do NOT modify the existing `Task` type, `pool`, `waitForDb`, `listTasks`, `createTask`, or `toggleTask`.
  - [x] Confirm: parameterized SQL with `$1`; `result.rowCount ?? 0` null-safety; returns `boolean`; no `RETURNING`, no second SELECT, no transaction.
  - [x] Confirm zero new imports.

- [x] **Task 2: Add `DELETE /api/tasks/:id` route to `api/src/server.ts`** (AC: #3, #4, #5, #6, #7, #22)
  - [x] Open `/Users/gio/Source/bmad-test/api/src/server.ts`. Confirm post-2.3 state: GET, POST, PATCH handlers, error middleware, shutdown logic.
  - [x] Update the `import` statement on line 2 to add `deleteTask`: `import { createTask, deleteTask, listTasks, pool, toggleTask, waitForDb } from './db.js';` (alphabetical insertion). Keep the `.js` suffix.
  - [x] INSERT the DELETE route from Dev Notes → "Locked code skeleton — DELETE /api/tasks/:id route" BETWEEN the PATCH handler (closing `});`) and the error middleware (the `// Single error middleware...` comment). Add a blank line above and below.
  - [x] Confirm validation order: id regex → `Number.isSafeInteger` → DB call (no body validation — DELETE has no body per AC #5).
  - [x] Confirm: id-validation error message is `"id must be a positive integer"`; 404 message is `"task not found"`; success uses `res.status(204).end()` (NOT `.json(...)`, NOT `.sendStatus(...)`).
  - [x] Confirm zero `res.status(4xx).json(...)` direct calls — all error responses go through `next(err)` → middleware.

- [x] **Task 3: Refactor `web/src/api.ts` — extract `parseError` and append `deleteTask`** (AC: #9, #10, #11, #20, #22)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/api.ts`. Confirm post-2.3 state: `Task`, `fetchTasks`, `createTask`, `toggleTask` (the latter two contain inline json-error-extraction try/catch blocks).
  - [x] INSERT the `parseError` private helper from Dev Notes → "Locked code skeleton — `parseError` helper for api.ts" at the TOP of the file, AFTER the `Task` type export and BEFORE `fetchTasks`. NOT exported.
  - [x] REFACTOR `createTask` to use `parseError`: replace the inline try/catch (the entire ~12-line block that builds `let message`) with `const message = await parseError(response);` then `throw new Error(``POST /api/tasks failed: ${message}``);`. The verb-prefix string MUST stay (per AC #11).
  - [x] REFACTOR `toggleTask` to use `parseError`: same pattern — replace inline try/catch with `const message = await parseError(response);` then `throw new Error(``PATCH /api/tasks/${id} failed: ${message}``);`.
  - [x] APPEND the `deleteTask` function from Dev Notes → "Locked code skeleton — `deleteTask` addition to `web/src/api.ts`" character-for-character. Place it AFTER the existing `toggleTask` (end of file).
  - [x] Confirm: `deleteTask` issues `DELETE` method, NO `Content-Type` header, NO body; on `!response.ok` calls `parseError(response)`; on success returns `undefined` (does NOT call `response.json()`).
  - [x] Confirm zero new imports.
  - [x] Confirm: `parseError` is NOT exported (no `export` keyword on the function).

- [x] **Task 4: Wire `handleDelete` and per-`<li>` Delete button into `web/src/App.tsx`** (AC: #12, #13, #14, #15, #16, #17, #22)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/App.tsx`. Confirm post-2.3 state: contains `handleSubmit`, `handleToggle`, `<li>` with checkbox + span (Story 2.3 added these).
  - [x] Update the import line to add `deleteTask`: `import { createTask, deleteTask, fetchTasks, toggleTask, type Task } from './api';` (alphabetical insertion of value imports; `type Task` stays last).
  - [x] Add the `handleDelete` function INSIDE the `App` component, BELOW `handleToggle` (which Story 2.3 added) and ABOVE the `return (` statement. Use the locked code from Dev Notes → "Locked code skeleton — `handleDelete` addition to App.tsx".
  - [x] Modify the `<li>` content (already contains checkbox + span from Story 2.3): APPEND the `<button type="button">Delete</button>` AFTER the span. Use the locked code from Dev Notes → "Locked code skeleton — `<li>` Delete button addition".
  - [x] Confirm: button is `type="button"` (NOT `type="submit"`, NOT missing); `onClick={() => handleDelete(task.id)}`; visible text is `Delete`; NO `aria-label`, NO `title`, NO `disabled`.
  - [x] Confirm `handleDelete`'s catch block contains ONLY `console.error(err)` (no toast, no setState revert).
  - [x] Confirm zero `useOptimistic`, zero `useState` for per-task pending flags, zero `window.confirm` calls, zero `<dialog>` elements, zero confirmation prompts.

- [x] **Task 5: (Optional) Append a `.delete-button` rule to `web/src/App.css` IF the layout looks broken** (AC: #19)
  - [ ] Run `npm run dev` in `web/` and visually inspect a task row (with checkbox, description, Delete button).
  - [ ] If the Delete button is too close to the description (visually crowded), APPEND a single rule to `web/src/App.css`: `li button { margin-left: auto; }` (uses flexbox spacing if `li` is flex; falls back to plain margin otherwise) OR `li button { margin-left: 0.5rem; }`. Total ≤ 5 lines including blank line.
  - [x] If the layout looks acceptable WITHOUT the rule, ADD NOTHING. Document the choice in Completion Notes.
  - [x] Confirm zero color / hover / focus / transition rules added (AC #19).
  - [x] Confirm zero `outline: none`, zero focus suppression (per Story 2.2 / 2.3 standing rules).

- [x] **Task 6: Static + runtime verification** (AC: #23)
  - [x] **Step A — TS + build (always required):**
    - From `/Users/gio/Source/bmad-test/api/`, run `npm run build`. Expect: zero TS errors.
    - From `/Users/gio/Source/bmad-test/web/`, run `npm run build`. Expect: zero TS errors; dist emitted.
    - If errors: (a) verify `.js` suffix on api-side imports; (b) verify `result.rowCount ?? 0` null-safety; (c) verify App.tsx import line includes `deleteTask` AND keeps `type Task`; (d) verify `parseError` placement and call sites.
  - [ ] **Step B — runtime smoke (preferred, requires Docker):**
    - Run scenarios from Dev Notes → "Runtime verification recipe" in order. Each scenario has explicit expected outcomes.
    - If a scenario fails, fix the implementation; do NOT alter expected outcomes.
  - [x] **Step B fallback (Docker unavailable):** Document skip in Completion Notes.
  - [x] Confirm `git diff api/package.json api/package-lock.json web/package.json web/package-lock.json` produces ZERO output (AC #20).
  - [x] Confirm `git diff README.md` produces ZERO output (AC #21).
  - [x] Confirm `git status` shows EXACTLY four OR five modified files (AC #18): `api/src/db.ts`, `api/src/server.ts`, `web/src/api.ts`, `web/src/App.tsx`, and OPTIONALLY `web/src/App.css`. No untracked new files anywhere.

## Dev Notes

### Locked code skeleton — `deleteTask` addition to `api/src/db.ts`

Append to end of file (after `toggleTask`, which Story 2.3 added):

```ts

// Single-statement delete — no follow-up SELECT, no RETURNING (we don't read
// the deleted row's content; only existence matters). Returns true if a row
// was deleted, false if no row matched (route handler converts false → 404).
// pg's result.rowCount is typed as number | null in the type definitions even
// though real responses always populate it; defensive ?? 0 handles the type.
// Caller (server.ts route handler) is responsible for validating `id`; db.ts
// trusts its caller. SQL injection is prevented by the $1 placeholder.
export async function deleteTask(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
```

### Locked code skeleton — `DELETE /api/tasks/:id` route

INSERT into `api/src/server.ts` between the existing PATCH handler (its closing `});`) and the existing error middleware comment (`// Single error middleware...`). Add a blank line above and below.

```ts

// DELETE /api/tasks/:id — remove one task. Validates id (regex + safe-integer);
// no body validation (DELETE bodies are RFC-permitted but ignored). Returns
// 204 (no body, no Content-Type) on success, 404 on missing, 400 on bad id.
// Same .status / next(err) pattern as PATCH/POST (architecture.md#4.4).
app.delete('/api/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
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
    const deleted = await deleteTask(id);
    if (!deleted) {
      const err: Error & { status?: number } = new Error('task not found');
      err.status = 404;
      throw err;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
```

### Locked code skeleton — `parseError` helper for `web/src/api.ts`

INSERT at the top of the file, AFTER the `Task` type export and BEFORE the `fetchTasks` function:

```ts

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
```

### Refactored `createTask` (post-extraction)

The body of `createTask` MUST become (after the `parseError` helper is in place):

```ts
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
```

(The verb-prefix string `POST /api/tasks failed: ` MUST stay — Story 2.5's toast surfaces the full `err.message` to the user.)

### Refactored `toggleTask` (post-extraction)

The body of `toggleTask` MUST become:

```ts
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
```

### Locked code skeleton — `deleteTask` addition to `web/src/api.ts`

Append to end of file (after the refactored `toggleTask`):

```ts

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
```

### Locked code skeleton — `handleDelete` addition to App.tsx

Add INSIDE the `App` component, BELOW `handleToggle` (Story 2.3's handler) and ABOVE the `return (` statement:

```tsx

  async function handleDelete(id: number): Promise<void> {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      // FR40: console.* only. Toast surfacing arrives in Story 2.5.
      console.error(err);
    }
  }
```

### Locked code skeleton — `<li>` Delete button addition

Inside the list-rendering branch's `<li>` (post-2.3 state contains checkbox + span):

```tsx
            <li key={task.id}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => handleToggle(task.id, !task.completed)}
                aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
              />
              <span className={task.completed ? 'completed' : ''}>{task.description}</span>
              <button type="button" onClick={() => handleDelete(task.id)}>
                Delete
              </button>
            </li>
```

The `<button>` is APPENDED after the `<span>` — DOM order: checkbox, span, button. Indentation MUST match surrounding JSX.

### Runtime verification recipe

**Prerequisites:** API + Postgres running per Story 1.3 / 2.1 / 2.3 recipe; Vite dev server running. Two terminals.

**Setup data:**
```sh
curl -X POST -H 'Content-Type: application/json' -d '{"description":"task to keep"}' http://localhost:3000/api/tasks
curl -X POST -H 'Content-Type: application/json' -d '{"description":"task to delete via curl"}' http://localhost:3000/api/tasks
curl -X POST -H 'Content-Type: application/json' -d '{"description":"task to delete via UI"}' http://localhost:3000/api/tasks
curl http://localhost:3000/api/tasks
```
Note the three returned ids — call them `$KEEP`, `$DEL_CURL`, `$DEL_UI`.

**Scenario A — curl: DELETE success.**
```sh
curl -i -X DELETE http://localhost:3000/api/tasks/$DEL_CURL
```
Expect: `HTTP/1.1 204 No Content`; ZERO `Content-Type` header in the response (or only the default Express adds — but no `application/json`); ZERO body bytes (curl shows `* Connection #0 to host localhost left intact` immediately after the headers).

**Scenario B — curl: confirm the task is gone.**
```sh
curl http://localhost:3000/api/tasks
```
Expect: JSON array; the `$DEL_CURL` task is ABSENT; `$KEEP` and `$DEL_UI` are still present.

**Scenario C — curl: 404 on second delete of the same id.**
```sh
curl -i -X DELETE http://localhost:3000/api/tasks/$DEL_CURL
```
Expect: `HTTP/1.1 404 Not Found`; body `{"error":"task not found"}`. (The previous delete succeeded; the row is gone.)

**Scenario D — curl: 404 for a never-existed id.**
```sh
curl -i -X DELETE http://localhost:3000/api/tasks/999999
```
Expect: `HTTP/1.1 404 Not Found`; body `{"error":"task not found"}`.

**Scenario E — curl: 400 for id "0".**
```sh
curl -i -X DELETE http://localhost:3000/api/tasks/0
```
Expect: `HTTP/1.1 400 Bad Request`; body `{"error":"id must be a positive integer"}`.

**Scenario F — curl: 400 for non-integer id.**
```sh
curl -i -X DELETE http://localhost:3000/api/tasks/abc
```
Expect: `HTTP/1.1 400 Bad Request`; body `{"error":"id must be a positive integer"}`.

**Scenario G — curl: DELETE with a body is silently accepted (RFC permits, server ignores).**
```sh
curl -i -X DELETE -H 'Content-Type: application/json' -d '{"reason":"test"}' http://localhost:3000/api/tasks/$DEL_UI
```
Expect: `HTTP/1.1 204 No Content`. The body is parsed by `express.json()` but never read by the handler.

**Setup AGAIN for the UI scenarios** (because Scenario G deleted `$DEL_UI`):
```sh
curl -X POST -H 'Content-Type: application/json' -d '{"description":"task to delete via UI"}' http://localhost:3000/api/tasks
curl http://localhost:3000/api/tasks
```
Note the new id of "task to delete via UI".

**Scenario H — browser: delete a task via UI button.**
1. Open `http://localhost:5173/`. DevTools → Network → Fetch/XHR filter.
2. Each `<li>` MUST show: checkbox, description, Delete button. The Delete button MUST have visible text "Delete".
3. Click the Delete button next to "task to delete via UI".
4. Network tab MUST show a `DELETE /api/tasks/<id>` request with status 204, ZERO request body, ZERO response body.
5. The `<li>` for that task MUST disappear from the DOM (verify via DevTools Elements). The other two tasks ("task to keep" and others) MUST remain.
6. Console MUST show ZERO errors. NO confirmation dialog appeared (NFR19).

**Scenario I — browser: keyboard operability (NFR15).**
1. Refresh. Click somewhere neutral.
2. Press Tab repeatedly. Focus order MUST include each `<li>`'s checkbox AND Delete button (in DOM order).
3. With focus on a Delete button, press Enter. The DELETE round-trip MUST occur (network 204; DOM updates).
4. Refresh. Tab to a Delete button. Press Space. The same DELETE round-trip MUST occur.
5. Confirm the focus indicator (browser-default outline) is visible on the focused button.

**Scenario J — browser: persistence across reload.**
1. Add a new task via the form.
2. Delete it via the Delete button. Confirm the row disappears.
3. Hard-refresh (`Cmd-Shift-R`).
4. The deleted task MUST NOT reappear (the GET /api/tasks confirms server-side persistence of the delete).

**Scenario K — browser: 404 from server is logged but not crashing.**
1. In the browser console, run: `await fetch('/api/tasks/999999', { method: 'DELETE' }).then(r => r.status)`.
2. Expect the console to print `404`.
3. The UI is unaffected.

**Scenario L — browser: simulated server error path (handleDelete catch).**
1. Stop the API process. Leave the web dev server running.
2. In the browser, click any Delete button.
3. Expect: network failure; console shows `Error: DELETE /api/tasks/<id> failed: ...`. The task stays in the list (no `setTasks` was called — the catch block only logs).
4. Restart the API. Click the Delete button again. The task disappears.

**Scenario M — browser: refactored createTask and toggleTask still work.**
1. Add a new task via the form. Confirm it appears (createTask still works after the parseError refactor).
2. Toggle the new task's checkbox. Confirm strikethrough appears (toggleTask still works after the refactor).
3. Toggle it back. Confirm strikethrough removed.

If ALL scenarios A–M pass, AC #23 Step B is satisfied.

### Anti-patterns and forbidden additions

The following are common LLM-generated additions that look reasonable but violate the locked architecture, the Phase 0 minimalism thesis, or specific ACs. **Do NOT add ANY of these.**

**API side (db.ts / server.ts):**

1. ❌ **`SELECT 1 FROM tasks WHERE id = $1` before the DELETE** to determine 404 vs 204. The DELETE returns `rowCount === 0` for missing — same information in one round-trip.
2. ❌ **`RETURNING *` on the DELETE.** We don't read the returned row; the bytes are wasted on the wire and in pg's parsing.
3. ❌ **`RETURNING id` on the DELETE** for "confirmation". Same as #2 — `rowCount` is the confirmation.
4. ❌ **A transaction (`BEGIN`/`COMMIT`).** Single statement; pg auto-commits.
5. ❌ **A "soft delete" pattern** (`UPDATE tasks SET deleted_at = NOW() WHERE id = $1`). Out of scope; schema has no `deleted_at` column; would defeat the user's intent.
6. ❌ **`ON DELETE CASCADE` consideration.** No foreign keys point at `tasks` (single table); irrelevant.
7. ❌ **Logging the deletion** (`console.log(``deleted task ${id}``)`). FR40 logging convention is `console.error` for errors only; success-path logging is not in scope.
8. ❌ **`res.sendStatus(204)`** instead of `res.status(204).end()`. `sendStatus` adds `"No Content"` body and `text/plain` content type — violates 204 spec.
9. ❌ **`res.status(204).json({})`** or **`res.status(204).json(null)`**. Adds `Content-Type: application/json` and a non-empty body — violates 204 spec.
10. ❌ **`res.status(200).json({deleted: true})`.** Wrong contract; 204 is the spec answer.
11. ❌ **`res.status(202).end()`** (Accepted). Wrong contract; the deletion is synchronous, not queued.
12. ❌ **A separate `validateId(req)` helper** extracted from PATCH and DELETE. Two repetitions is below the extraction threshold (architecture.md#5.3 — three is the trigger).
13. ❌ **Adding `Allow: DELETE, PATCH` header** on 4xx responses. Express does not auto-handle 405 Method Not Allowed; adding manually is over-engineering for one new method on an existing path.
14. ❌ **Reading `req.body` in the DELETE handler.** Per AC #5; even if Express parses it, ignore it.
15. ❌ **Adding a 400 if the request DOES have a body.** RFC permits it; adding the check is over-engineering.

**Web side (api.ts / App.tsx / App.css):**

16. ❌ **Calling `response.json()` on the success path of `deleteTask`.** 204 has no body; `.json()` throws `SyntaxError: Unexpected end of JSON input`. Just return after the `!response.ok` check.
17. ❌ **Setting `Content-Type: application/json` header on the DELETE request.** No body to type; the header is misleading.
18. ❌ **Setting `Accept: application/json` header.** Server returns no body on success; `Accept` is meaningless.
19. ❌ **`useOptimistic` for the delete.** Story 3.4 territory.
20. ❌ **A `pendingDelete` boolean state per task.** Premature; same anti-pattern as Story 2.3 AC #17.
21. ❌ **Disabling the Delete button during in-flight DELETE.** Same as #20.
22. ❌ **A `confirm()` modal before delete.** Per AC #16 and NFR19 — single click IS the action.
23. ❌ **A custom modal "Are you sure?"** Same as #22.
24. ❌ **A two-click pattern** ("Click once to arm, click again to delete"). Same root anti-pattern. The PRD accepts the trade-off explicitly ("out-of-scope: undo").
25. ❌ **An undo banner / 5s grace period.** Out of scope; epic AC says "out-of-scope: undo."
26. ❌ **Animating the row's removal** (`transition: opacity 0.3s` then `display: none`). Story 3.1 territory.
27. ❌ **Filtering with `prev.splice(...)`** (mutation) instead of `prev.filter(...)` (immutable). React state must be replaced, not mutated.
28. ❌ **Re-fetching `GET /api/tasks` after the delete succeeds.** Same anti-pattern as 2.2 AC #14 / 2.3 AC #24.
29. ❌ **A toast / banner / `window.alert()` on delete error.** Story 2.5 wires this; this story is `console.error` only.
30. ❌ **`aria-label="Delete task"` on the button when the visible text is already "Delete".** `aria-label` overrides the visible text in the accessibility tree — confusing for screen-reader users.
31. ❌ **Using a `<a href="#">` styled as a button.** Forbidden — `<button>` is the semantic choice; `<a>` without a real href fails accessibility.
32. ❌ **Using `<div role="button">` styled as a button.** Forbidden — needs ~20 lines of code to replicate native `<button>` keyboard/focus/click behavior; `<button>` does it for free.
33. ❌ **Putting the Delete button INSIDE the `<form>`** (the create form at the top of the page). The Delete button lives inside `<li>`, OUTSIDE the form; `type="button"` prevents accidental form submission either way, but DOM placement matters for tab order.
34. ❌ **`onClick={handleDelete}` (forgetting the `task.id` argument).** Would call `handleDelete(SyntheticEvent)` — the `id` would be the React event object; the API would 400 with "id must be a positive integer." Use the arrow wrapper.
35. ❌ **Using `task.id` as a closure-captured variable WITHOUT the arrow wrapper** (`onClick={handleDelete.bind(null, task.id)}`). Works but verbose and slower (creates a new bound function per render); the arrow wrapper is the React-idiomatic pattern.
36. ❌ **A delete-all button** ("Clear completed", "Delete all"). Out of scope; not in any story; classic todo-app feature creep.
37. ❌ **A drag-to-delete gesture** (swipe left). Out of scope; mobile gesture handling is not in the PRD.
38. ❌ **A right-click context menu** with "Delete". Out of scope; desktop-only feature; not in NFRs.
39. ❌ **Extracting a `TaskItem.tsx` component.** Per AC #18; premature.
40. ❌ **Extracting `parseError` to a separate file (`web/src/lib/parse-error.ts`).** Per AC #18; lives at the top of `api.ts`.
41. ❌ **Exporting `parseError` from `api.ts`.** Per AC #10 and the locked skeleton — internal helper only.
42. ❌ **Renaming `parseError` to `extractError` / `getErrorMessage` / `responseError`.** The name is locked; consistency across stories matters.
43. ❌ **Skipping the refactor of `createTask` / `toggleTask`.** Per AC #10 — the third-repetition trigger applies NOW; deferring would re-introduce the inline try/catch in the next mutation story (e.g., a hypothetical PUT) and pile up tech debt.

**Repository-level:**

44. ❌ **Adding the DELETE row to the README's `## API` table.** Story 3.3 owns the rewrite; partial updates create incoherent docs.
45. ❌ **Adding any e2e test for delete.** Story 2.7 owns the single smoke test (create + reload + cleanup delete). The CLEANUP step USES delete, but the assertion budget for 2.7 is one create + one assertion.
46. ❌ **Adding any unit test.** Phase 0 has no unit-testing framework.
47. ❌ **Updating `deferred-work.md`.** No new architectural trade-offs introduced.
48. ❌ **Modifying `db/init.sql`, `Caddyfile`, `compose.yaml`, `web/vite.config.ts`.** Out of scope.

### Conventions reinforced by this story

- **204 No Content for delete (no body)** — RFC-correct; the row is gone, no resource to return. Differs from PATCH's 200-with-body because PATCH HAS a result resource.
- **Three-callsite extraction trigger** (architecture.md#5.3): `parseError` is extracted now because there are three mutations using it; this is the FIRST extraction in the codebase. Future stories should respect the same trigger — do NOT pre-extract.
- **Verb-prefixed error messages** (`POST /api/tasks failed: ...`, `PATCH /api/tasks/${id} failed: ...`, `DELETE /api/tasks/${id} failed: ...`): diagnostic for the user when surfaced in Story 2.5's toast.
- **`<button type="button">` outside `<form>`**: prevents accidental form submission (default `type` for `<button>` is `submit` only inside a form, but explicit is safer).
- **Visible button text > `aria-label`**: when the text is short enough to display, show it; reserve `aria-label` for icon-only buttons (which this story does NOT use).
- **`prev.filter(...)` for removal, `prev.map(...)` for replacement, `[...prev, x]` for append**: the three React state-update idioms used so far (createTask, toggleTask, deleteTask). Mnemonic: filter-out, map-replace, spread-append.

### What this story does NOT touch

The following are explicitly OUT OF SCOPE and MUST NOT be modified:

1. **`api/src/db.ts` exports OTHER than the appended `deleteTask`** — `Task`, `pool`, `waitForDb`, `listTasks`, `createTask`, `toggleTask` stay byte-identical.
2. **`api/src/server.ts` routes OTHER than the inserted DELETE** — GET, POST, PATCH, error middleware, shutdown logic stay byte-identical (except the import line, which gains `deleteTask`).
3. **`web/src/api.ts` exports OTHER than the appended `deleteTask`** — `Task`, `fetchTasks` stay byte-identical; `createTask` and `toggleTask` are REFACTORED to use `parseError` (their behavior is unchanged from the consumer's POV).
4. **`web/src/App.tsx` structure OTHER than the import line, the new `handleDelete`, and the `<li>` button addition** — `useEffect` mount, `description` state, `inputRef`, `<form>`, `handleSubmit`, `handleToggle`, the three render branches' OUTER structure, the existing checkbox + span inside `<li>` stay byte-identical.
5. **`web/src/App.css`** — modified ONLY if AC #19's runtime check finds the layout broken; otherwise byte-identical. NO color / focus / transition / hover rules in any case.
6. **`db/init.sql`** — schema is locked.
7. **`api/package.json`, `api/package-lock.json`, `web/package.json`, `web/package-lock.json`** — zero dependency changes (AC #20).
8. **`api/tsconfig.json`, `web/tsconfig.app.json`** — strictness flags stay as-is (AC #22).
9. **`README.md`** — Story 3.3 owns the rewrite (AC #21).
10. **`Caddyfile`, `compose.yaml`, `web/vite.config.ts`** — DELETE is served by the existing `/api/*` proxy.
11. **`e2e/`** — Story 2.7 territory.
12. **`_bmad-output/implementation-artifacts/deferred-work.md`** — no new trade-offs.
13. **No new files anywhere** (AC #18).

### Source citations

- `api/src/db.ts:79-98` — `createTask` pattern (the `deleteTask` template, sans RETURNING).
- `api/src/db.ts` (post-2.3 state) — `toggleTask` pattern (parameterized query convention).
- `api/src/server.ts:30-50` — POST handler pattern.
- `api/src/server.ts` (post-2.3 state) — PATCH handler pattern (id-validation chain mirrored here).
- `api/src/server.ts:55-60` — single error middleware.
- `web/src/api.ts:13-18` — `fetchTasks` pattern.
- `web/src/api.ts` (post-2.3 state) — `createTask` and `toggleTask` (refactored here to use `parseError`).
- `web/src/App.tsx` (post-2.3 state) — the file `handleDelete` integration extends.
- `_bmad-output/planning-artifacts/architecture.md#3.1` — "Same-origin contract; server is source of truth."
- `_bmad-output/planning-artifacts/architecture.md#3.2` — "Manual validation only in Phase 0."
- `_bmad-output/planning-artifacts/architecture.md#3.3` — "Single pool, raw pg."
- `_bmad-output/planning-artifacts/architecture.md#4.3` — "Optimistic UI is Story 3.4; first to cut."
- `_bmad-output/planning-artifacts/architecture.md#4.4` — "Single error middleware; .status convention."
- `_bmad-output/planning-artifacts/architecture.md#4.5` — "Boundary mapping in db.ts only."
- `_bmad-output/planning-artifacts/architecture.md#5.1` — "No router split; single server.ts."
- `_bmad-output/planning-artifacts/architecture.md#5.3` — "Phase 0 minimalism; three-repetition extraction trigger."
- `_bmad-output/planning-artifacts/epics.md#Story 2.4` — full AC list this story implements.
- `_bmad-output/planning-artifacts/epics.md#Story 2.5` — error toast (this story's `console.error` is the placeholder).
- `_bmad-output/planning-artifacts/epics.md#Story 3.4` — optimistic UI (why this story is request-then-update).
- `_bmad-output/planning-artifacts/prd.md#FR40` — `console.*` logging only.
- `_bmad-output/planning-artifacts/prd.md#NFR14` — semantic HTML.
- `_bmad-output/planning-artifacts/prd.md#NFR15` — keyboard operability.
- `_bmad-output/planning-artifacts/prd.md#NFR16` — visible focus indicators.
- `_bmad-output/planning-artifacts/prd.md#NFR19` — no confirmation dialogs.
- `_bmad-output/implementation-artifacts/2-1-create-task-post-api-tasks-endpoint.md` — POST handler patterns.
- `_bmad-output/implementation-artifacts/2-2-list-and-create-tasks-in-the-ui.md` — `createTask` (now refactored).
- `_bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md` — id-validation chain mirrored here; `toggleTask` (now refactored).
- RFC 9110 §6.3.5 (204 No Content), §9.3.5 (DELETE method).

## Dev Agent Record

### Context Reference

Story spec self-contained; no separate context file generated. All locked skeletons embedded in Dev Notes.

### Agent Model Used

claude-opus-4.7 (OpenCode, batch dev mode).

### Debug Log References

None — implementation followed locked skeletons; both `npm run build` runs passed on first attempt.

### Completion Notes List

- Implemented all six tasks per locked skeletons.
- **Approved deviation (carried from Story 2.3):** the DELETE handler signature drops the `: Request` annotation on `req` (`async (req, res: Response, next: NextFunction)`). Reason: with `noUncheckedIndexedAccess` + `verbatimModuleSyntax`, an explicit `Request` type from `express-serve-static-core` defaults `req.params` to `ParamsDictionary` (indexer `string | string[]`), so `req.params.id` types as `string | string[] | undefined` and breaks the `idStr` assignment. Dropping the annotation lets TS infer the route-pattern params (`RouteParameters<'/api/tasks/:id'>`), giving `req.params.id: string`. User pre-approved this pattern for `:id` handlers in Story 2.3.
- **AC #19 decision:** added ZERO new CSS rules. Story 2.2's generic `button` rule (padding 0.5rem 1rem, font-size 1rem) and the default `<li>` margin already produce a readable row (checkbox · text · Delete button). Story 3.1 owns design polish; this story is functional only. `web/src/App.css` is byte-identical to its post-2.3 state. Final modified-file count: 4 (not 5).
- **AC #23 Step B (runtime Docker smoke) deferred** per the story's own fallback clause — Docker not invoked in this batch-dev session. Step A (`npm run build` from both `api/` and `web/`) passed clean for both packages (api: `tsc` zero errors; web: `tsc -b && vite build` zero errors, dist emitted, 88ms).
- Verified `git diff` shows zero changes to `api/package.json`, `api/package-lock.json`, `web/package.json`, `web/package-lock.json`, `README.md` (ACs #20, #21).
- `parseError` extraction (architecture.md#5.3 third-callsite trigger) is the FIRST helper extraction in the codebase. Refactor preserved verb-prefix error messages (`POST /api/tasks failed: `, `PATCH /api/tasks/${id} failed: `, `DELETE /api/tasks/${id} failed: `) for Story 2.5's toast surfacing.

### File List

- `api/src/db.ts` (modified — appended `deleteTask` function; 12 added lines)
- `api/src/server.ts` (modified — extended `./db.js` import to add `deleteTask`; appended DELETE route handler between PATCH and error middleware)
- `web/src/api.ts` (modified — extracted private `parseError` helper at top, refactored `createTask` and `toggleTask` to use it, appended `deleteTask`)
- `web/src/App.tsx` (modified — extended `./api` import to add `deleteTask`; added `handleDelete` function below `handleToggle`; appended Delete `<button>` inside `<li>` after span)

## Change Log

| Date       | Author             | Change                 |
| ---------- | ------------------ | ---------------------- |
| 2026-04-29 | Bob (Scrum Master) | Initial story creation |
| 2026-04-30 | Amelia (Dev)       | Implementation complete; status → review. `parseError` helper extracted (first extraction in codebase). PATCH-style `: Request` annotation drop applied to DELETE handler (approved deviation). AC #19 chose zero CSS additions. AC #23 Step B deferred (no Docker); Step A clean. |
