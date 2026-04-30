# Story 2.2: List and create tasks in the UI

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As any individual with the URL,
I want to see my list of tasks and add a new one by typing a description and pressing Enter,
so that I can capture and review tasks without page reload, navigation, or instruction.

## Acceptance Criteria

1. **`web/src/api.ts` gains a new `createTask(description: string): Promise<Task>` function — and only that function is added.** It is APPENDED to the existing module (do NOT replace `Task` or `fetchTasks` — they were locked by Story 1.4 and the file is currently 19 lines). The function issues `fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description }) })`, treats `!response.ok` as an error (throwing `new Error(...)` with a message that includes the HTTP status, the status text, AND — when the response body parses as JSON with a string `error` field — the server's error message), and on success returns `(await response.json()) as Task`. No third-party HTTP client (no `axios`, no `ky`, no `wretch`); no `Result<T, E>` discriminated-union return shape; no `AbortController`. The function MUST NOT do its own client-side validation (no `.trim()`, no length check) — input shaping is the caller's job (AC #6, AC #7). [Source: web/src/api.ts:1-19, architecture.md#3.1, architecture.md#4.2, 2-1-create-task-post-api-tasks-endpoint.md AC #5-#9]

2. **The `Content-Type: application/json` header MUST be set on the POST request.** Without it, Express's `express.json({ limit: '10kb' })` body parser does NOT populate `req.body`, the server falls into the AC #6 "missing description" branch from Story 2.1, and the API returns 400 `{"error":"description must be a string"}` — a confusing failure mode the user did not cause. The header value MUST be exactly `application/json` (no `;charset=utf-8` suffix; `fetch` handles encoding) and MUST be passed via the `headers` option of the second `fetch` argument (NOT via a custom `Headers` instance — both work, but the locked skeleton uses the plain object form for parity with the rest of `api.ts`). [Source: api/src/server.ts:11, 2-1-create-task-post-api-tasks-endpoint.md AC #10]

3. **The request body is `JSON.stringify({ description })` — single-field object — passed as a string to `fetch`'s `body` option.** Do NOT pass the raw `{ description }` object (`fetch` would coerce it to `[object Object]`); do NOT pass `description` as a query parameter, a `URLSearchParams`, or a `FormData`; do NOT add other fields (`completed`, `createdAt`, `id` — the server generates these). The server expects exactly one JSON field named `description`; sending more is harmless (Express ignores them) but adding them would obscure the contract and create a temptation in Story 2.3 / 2.4 to keep growing the body. [Source: 2-1-create-task-post-api-tasks-endpoke.md AC #5, AC #8]

4. **Error message extraction from non-2xx responses tries the JSON `{error: string}` shape first, then falls back to status text.** The server's error contract (Story 2.1 AC #7 + the locked error middleware in `api/src/server.ts:55-60`) returns `{"error":"<message>"}` for both 4xx (validation) and 5xx (internal). The client's `createTask` MUST attempt `await response.json()` inside a `try` block and, if it succeeds AND the parsed value is a non-null object with a string `error` property, use that string in the thrown `Error.message`. If the parse throws (non-JSON 502 from a misconfigured proxy, empty body) OR the parsed shape is not the expected `{error: string}`, fall back to `${response.status} ${response.statusText}`. This single behavior is what makes Story 2.5's "show the server's message in the toast" possible without a second network round-trip. [Source: api/src/server.ts:55-60, 2-1-create-task-post-api-tasks-endpoint.md AC #7, epics.md#Story 2.5]

5. **`web/src/App.tsx` extends — does NOT replace — the Story 1.4 shell to add a create form and refactor list rendering.** The mount-time `fetchTasks()` flow (the `useEffect` with empty deps, the `loading` state, the `tasks` state, the three render branches: Loading/empty/list) is PRESERVED. The new code adds: (a) a `description` state via `useState<string>('')` for the input value; (b) an `<form>` element that wraps an `<input type="text">` and a `<button type="submit">Add</button>`; (c) an `onSubmit` handler that trims, ignores empty/whitespace-only, calls `createTask`, appends the returned task to the list, and clears the input. The form renders BETWEEN the `<h1>Tasky</h1>` and the three render-branches (Loading / empty / list) so the input is visible in all three states (per epic AC: "first-time user can identify how to create a task from the empty state alone"). [Source: epics.md#Story 2.2, web/src/App.tsx:1-44, prd.md#FR23]

6. **The form submission flow — exact sequence:** (a) the `<form>`'s `onSubmit` handler calls `event.preventDefault()` FIRST (without it, the browser navigates to `/?` losing all state — most common React-form mistake); (b) compute `const trimmed = description.trim()`; (c) if `trimmed.length === 0`, return early WITHOUT clearing the input, WITHOUT calling the API, WITHOUT showing an error (silent ignore — see AC #7); (d) call `await createTask(trimmed)` inside a `try`/`catch`; (e) on success, append the returned `Task` to `tasks` via `setTasks((prev) => [...prev, task])` (functional updater — required because two rapid submits could otherwise race on the stale `tasks` closure); (f) on success, clear the input via `setDescription('')`; (g) on success, RE-FOCUS the input via a `ref` (`inputRef.current?.focus()`) so the user can type the next task immediately without reaching for the mouse; (h) on error, log via `console.error(err)` and leave the input value AND focus untouched so the user can retry without retyping (toast UI lands in Story 2.5). [Source: epics.md#Story 2.2, prd.md#NFR15, architecture.md#4.3]

7. **Whitespace handling — the trim-and-silently-ignore contract:**
   - `description === ''` (untouched) → `trimmed === ''` → silent return (no API call).
   - `description === '   '` (spaces only) → `trimmed === ''` → silent return.
   - `description === '\n\t '` (any Unicode whitespace `\s`) → `trimmed === ''` → silent return.
   - `description === '  buy milk  '` → `trimmed === 'buy milk'` → API receives `'buy milk'`. The trimmed form is what gets persisted; the user's leading/trailing spaces are NOT preserved. This is intentional and matches the epic AC ("the description is trimmed; empty or whitespace-only submissions are silently ignored"). The frontend trims; the server does NOT (Story 2.1 AC #6 → "whitespace-only descriptions ARE accepted" by the API as the safety net). The discipline is "UX trims at the boundary, integrity check stays raw."
   - "Silent ignore" means: do NOT show a banner, do NOT show a tooltip, do NOT add `aria-invalid` to the input, do NOT make the Add button `disabled` (the button stays enabled but the click/submit is a no-op). The browser-default focus ring on the input is the only visible feedback that the user is in the field.
   - Do NOT add a separate "min length" check at the client (e.g., reject `'a'`). Single-character descriptions are valid (server accepts length 1–500). [Source: epics.md#Story 2.2, 2-1-create-task-post-api-tasks-endpoint.md AC #6]

8. **Enter key submits — and Escape clears the input, neither requires custom keyboard handling:**
   - **Enter:** the `<input type="text">` is INSIDE a `<form>` element; the browser's native form-submit behavior fires `onSubmit` when Enter is pressed in any text input within the form. Do NOT add an `onKeyDown` handler for Enter — the `<form>`-wrapping is the entire mechanism (NFR15). Adding one would either duplicate or shadow the native behavior.
   - **Escape:** add ONE `onKeyDown` handler on the `<input>` that, when `event.key === 'Escape'`, calls `setDescription('')`. Do NOT also clear focus, do NOT call `event.preventDefault()` (Escape has no default action on a text input in any major browser). The handler is six lines including the type annotation. [Source: epics.md#Story 2.2, prd.md#NFR15]

9. **Semantic HTML — exhaustive list of new elements added by this story:**
   - `<form>` wrapping the input + button (NOT a bare `<div>` with manual key handling — `<form>` gives Enter-to-submit for free per AC #8).
   - `<input type="text">` for the description. Attributes: `value={description}`, `onChange={(e) => setDescription(e.target.value)}`, `onKeyDown={...}` for Escape (AC #8), `ref={inputRef}` for the post-submit re-focus (AC #6.g), `placeholder="Add a task"` (helper text — see AC #11), `aria-label="Task description"` (since there is no visible `<label>`; screen readers need a name). NO `maxLength` attribute (let the user paste a 600-char string and let the server's 400 land in Story 2.5; adding `maxLength={500}` would silently truncate paste and create a confusing UX). NO `required` attribute (silent-ignore replaces native validation per AC #7). NO `autoFocus` attribute (NFR-spec is silent about it AND it interferes with screen-reader cursor placement on first load — re-focus AFTER successful submit is the only auto-focus this story adds).
   - `<button type="submit">Add</button>`. Attributes: `type="submit"` is REQUIRED — without it, browsers default to `type="submit"` for `<button>` inside a `<form>` already, but explicit is better (and prevents the bug if the button is later moved outside the form). NO `onClick` handler (the form's `onSubmit` is the single mechanism; an `onClick` would race with `onSubmit` and complicate the trim/ignore logic). NO `disabled` toggling based on input length (per AC #7).
   - `<ul>` and `<li key={task.id}>{task.description}</li>` — UNCHANGED from Story 1.4 (still uses `task.id` as the React key; do NOT switch to array index). [Source: epics.md#Story 2.2, prd.md#NFR14, prd.md#NFR15, prd.md#NFR16]

10. **Browser-default focus rings stay (NFR16) — no `outline: none`, no `outline: 0`, no custom focus-suppression CSS.** Story 1.4's `App.css` already has zero `outline` rules; this story does NOT add any either, and does NOT add any selector that has the side effect of removing a focus indicator (`*:focus { outline: 0 }`, `button:focus { outline: 0 }`, etc.). Focus rings on the `<input>` and `<button>` are the keyboard-user accessibility contract — Story 3.1 may design a custom focus style, but it MUST NOT remove the indicator. [Source: prd.md#NFR16, web/src/App.css:1-26]

11. **`web/src/App.css` gains the minimum styling necessary to make the form readable and not look broken — no more.** The new selectors permitted: `form` (a flex/grid layout to put the input next to the button on a single row, with a small gap), `input[type="text"]` (a `padding`, a sensible `font-size`, optional `border` to match the button), `button` (a `padding`, a sensible `font-size`, a `cursor: pointer`). Do NOT add: a CSS reset, a `:focus { outline: ... }` override (per AC #10), color tokens / CSS variables (Story 3.1 territory), media queries (Story 3.2 territory), animations or transitions, hover states beyond the browser default (Story 3.1), `font-family` overrides (the body's `system-ui` stack from `index.css` is sufficient). The total added CSS at the end of this story should be ≤ 25 lines. [Source: epics.md#Story 2.2, architecture.md#3.1]

12. **The "Loading…" / "No tasks" / list-rendering branches from Story 1.4 are PRESERVED with one structural change: the `<form>` is rendered above all three branches, so the form is visible even while loading and even when the list is empty (epic AC: "a first-time user can identify how to create a task from the empty state alone"). The three render branches themselves are byte-identical to Story 1.4 — same `<p>Loading…</p>`, same `<p aria-live="polite">No tasks</p>`, same `<ul><li key={task.id}>{task.description}</li></ul>`. The full polish of the empty state (illustration, friendly copy, deliberate spacing) is Story 3.1; this story keeps the plain-text placeholder. [Source: web/src/App.tsx:26-40, epics.md#Story 1.4, epics.md#Story 3.1]

13. **No optimistic UI in this story — the appended task is the SERVER-RETURNED task object.** After `await createTask(trimmed)` resolves, the returned `Task` (with the server-generated `id` and `createdAt`) is what gets appended to the `tasks` state. Do NOT add the task to the list before the API call returns. Do NOT use `useOptimistic`. Do NOT generate a temporary `id` like `Date.now()` or `crypto.randomUUID()` to display the row early. This is a deliberate ordering: optimistic UI lands in Story 3.4 (which is "Nice-to-ship — first to cut") and would conflict with the simpler request/response flow this story locks in. The user-perceived latency between Enter and the row appearing is one round-trip to localhost (dev) or the VPS (prod); acceptable for Phase 0 and explicitly within the Architecture §4.3 "if 3.4 is cut, the app falls back to plain request/response" plan. [Source: epics.md#Story 3.4 (cut criteria), architecture.md#3.1, architecture.md#4.3]

14. **No re-fetch of `GET /api/tasks` after a successful create.** The single source of truth for the list AFTER the initial mount is the local `tasks` state, mutated by appending the server-returned task. Do NOT call `fetchTasks()` again at the end of the submit handler "to be safe" — it would (a) double the network cost per create, (b) cause a visible flicker as the list re-renders, (c) create a race window where a second user adding a task on a different machine could silently overwrite the local optimistic-feeling state. (The single-user assumption holds: there is no second machine to race against.) The list IS re-fetched on full page reload (Story 1.4's mount effect); that is sufficient persistence verification for Story 2.6 / 2.7. [Source: architecture.md#4.3, epics.md#Story 2.6, epics.md#Story 2.7]

15. **No new dependencies.** No `axios`, no `ky`, no `wretch`, no `swr`, no `@tanstack/react-query`, no `react-hook-form`, no `formik`, no `zod` (validation), no `yup`, no `react-aria`, no `@headlessui/react`, no `framer-motion`, no `react-icons`, no `lucide-react`. Specifically forbidden because they look "obviously useful for a form": `react-hook-form` (handles forms — but the entire form has one input and one button; `useState` is enough), `zod` (validation — but the only client validation is `trim().length === 0`, three lines), `react-aria` (accessibility — but the form is one labeled input and one button; semantic HTML covers it). The deps list at the end of this story MUST be byte-identical to the start of this story; `git diff web/package.json` and `git diff web/package-lock.json` MUST both produce empty output. [Source: architecture.md#3.1, architecture.md#5.3, 1-4-minimal-frontend-rendering-empty-shell.md AC #12]

16. **No backend changes.** `api/src/db.ts`, `api/src/server.ts`, `db/init.sql`, `api/package.json`, `api/tsconfig.json` are NOT modified. The `POST /api/tasks` endpoint shipped by Story 2.1 is the ONLY backend dependency; it is consumed as-is. Touching the backend in this story is scope creep. [Source: 2-1-create-task-post-api-tasks-endpoint.md, architecture.md#5.1]

17. **No README change.** The `## API` table already documents `POST /api/tasks` (Story 2.1 AC #15). The frontend's "how to type a task" UX is not a documented contract for self-hosters — it is observable directly. Story 3.3 will add screenshots and quickstart polish; that includes any frontend documentation. Adding a `## Frontend` README section here would duplicate Story 3.3's work. [Source: epics.md#Story 3.3, 1-4-minimal-frontend-rendering-empty-shell.md AC #15]

18. **No new files in `web/src/`, `api/`, `e2e/`, `db/`, or the project root.** This story's complete file-change set is exactly: `web/src/api.ts` (modified — append `createTask`), `web/src/App.tsx` (modified — extend with form + handler), `web/src/App.css` (modified — add form/input/button rules). Three files. Specifically, do NOT split the form into its own `TaskForm.tsx` component file (premature; one consumer, ~30 lines), do NOT extract a `useTasks` custom hook (premature; one component), do NOT create a `web/src/types.ts` (the `Task` type already lives in `api.ts` and one place is enough). [Source: architecture.md#5.1, architecture.md#4.5, architecture.md#5.3]

19. **TypeScript strictness — code MUST satisfy `web/tsconfig.app.json` flags as-is (`strict`, `verbatimModuleSyntax: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`, `noFallthroughCasesInSwitch: true`, `moduleResolution: "bundler"`).** Practical implications for this story:
   - Type-only imports use `type` keyword: `import { createTask, fetchTasks, type Task } from './api'` (mixed value + type imports in one statement is correct under `verbatimModuleSyntax: true`).
   - The `inputRef` is typed `useRef<HTMLInputElement>(null)`; the `?.focus()` chain is required because TS narrows `current` to `HTMLInputElement | null`.
   - The `onChange` handler's event is `React.ChangeEvent<HTMLInputElement>`; the `onSubmit` handler's event is `React.FormEvent<HTMLFormElement>`; the `onKeyDown` handler's event is `React.KeyboardEvent<HTMLInputElement>`. Use the explicit types or rely on React's inference from the JSX prop — both work; the locked skeleton uses inferred types via inline arrow functions for terseness.
   - `noUnusedLocals: true` will fail if `inputRef`, `description`, or `setDescription` are declared but not used in JSX or handlers. Verify each is referenced.
   - Do NOT loosen any flag. Fix the types/imports instead. [Source: web/tsconfig.app.json (existing); 1-4-...md AC #14]

20. **Static verification — `tsc -b` clean, then `vite build` clean, then runtime smoke.** Three-step verification:
   - **Step A (always required):** From `web/`, run `npm run build` (which is `tsc -b && vite build`). Confirm zero TS errors and a successful Vite production build emitting `web/dist/index.html` plus a hashed JS/CSS bundle. If TS errors appear: (a) check `import` statements use `type` keyword for `Task`; (b) check `useRef<HTMLInputElement>(null)` not `useRef(null)` (the latter narrows to `MutableRefObject<null>`); (c) check that the `onSubmit` is on the `<form>` element, not the `<button>` (Vite's TS will accept `onSubmit` on `<button>` but the runtime contract breaks).
   - **Step B (runtime, preferred):** With the API + ephemeral Postgres stack running (per Story 1.3 / 2.1 recipe), run `npm run dev` from `web/` and exercise the eight scenarios in Dev Notes → "Runtime verification recipe". Each scenario has explicit expected DOM state, network status, and console state assertions.
   - **Step B fallback (Docker unavailable):** Skip Step B and document why in Completion Notes; AC #20 then degrades to "Step A passes; runtime smoke deferred to Story 2.6 / 2.7." Step A alone is sufficient for the AC in that fallback path.

## Tasks / Subtasks

- [x] **Task 1: Append `createTask` to `web/src/api.ts`** (AC: #1, #2, #3, #4, #19)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/api.ts`. Confirm current contents are 19 lines: `Task` type export + `fetchTasks` function (Story 1.4).
  - [x] APPEND the `createTask` function from Dev Notes → "Locked code skeleton — `createTask` addition to `web/src/api.ts`" character-for-character. Place it AFTER the existing `fetchTasks` function (end of file).
  - [x] Do NOT modify the existing `Task` type or `fetchTasks` function.
  - [x] Confirm: `Content-Type: application/json` header is set; body is `JSON.stringify({ description })`; the function attempts `response.json()` parse for the error message before falling back to `${status} ${statusText}`.
  - [x] Confirm zero new imports (no `axios`, no `ky`, no `qs`, no `superagent`).
  - [x] Confirm `verbatimModuleSyntax` compliance: `Task` is still exported via `export type Task = ...` (NOT `export interface Task`).

- [x] **Task 2: Extend `web/src/App.tsx` with the form + submit handler** (AC: #5, #6, #7, #8, #9, #10, #12, #13, #14, #19)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/App.tsx`. Confirm current contents are 44 lines: imports, `App` function with `tasks` and `loading` state, mount-time `useEffect`, three render branches (Story 1.4).
  - [x] Replace the file with the locked code from Dev Notes → "Locked code skeleton — `web/src/App.tsx`" character-for-character. The replacement PRESERVES the Story 1.4 mount effect, the `tasks` and `loading` state, and the three render branches; it ADDS the form, the `description` state, the `inputRef`, the `onSubmit` handler, the `onKeyDown` Escape handler.
  - [x] Confirm imports: `useEffect, useRef, useState` from `'react'`; `createTask, fetchTasks, type Task` from `'./api'`; `'./App.css'` (side-effect).
  - [x] Confirm the `<form>` wraps the `<input>` and `<button type="submit">`; the form sits BETWEEN `<h1>Tasky</h1>` and the three render branches.
  - [x] Confirm `onSubmit` calls `event.preventDefault()` first; trims; silently returns on empty trimmed value; appends server-returned task via functional updater (`(prev) => [...prev, task]`); clears input via `setDescription('')`; re-focuses via `inputRef.current?.focus()`.
  - [x] Confirm the input has `aria-label="Task description"` and `placeholder="Add a task"`; NO `maxLength`, NO `required`, NO `autoFocus`, NO `disabled` toggling.
  - [x] Confirm Enter submission goes through native `<form>` behavior (no `onKeyDown` Enter handler exists); Escape clears the input via the single `onKeyDown` handler (NO `event.preventDefault()` for Escape).
  - [x] Confirm zero `useOptimistic`, zero `Date.now()` / `crypto.randomUUID()` for temporary IDs, zero re-fetch after success.
  - [x] Confirm zero `<a href="...">`, zero login UI, zero modal, zero confirmation dialog (NFR19).

- [x] **Task 3: Add minimum form/input/button styling to `web/src/App.css`** (AC: #10, #11)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/App.css`. Confirm current contents are 26 lines (Story 1.4: `main`, `h1`, `ul`, `li`, `p`).
  - [x] APPEND the rules from Dev Notes → "Locked code skeleton — `web/src/App.css` additions" character-for-character. Place them AFTER the existing `p` rule (end of file).
  - [x] Confirm new rules: `form` (flex/gap layout), `input[type="text"]` (padding/font-size), `button` (padding/font-size/cursor). Total added: ≤ 25 lines.
  - [x] Confirm zero `outline: none`, zero `outline: 0`, zero `*:focus`/`button:focus` selectors that suppress focus (AC #10).
  - [x] Confirm zero CSS variables / color tokens / media queries / transitions / animations / hover overrides / `font-family` overrides.

- [x] **Task 4: Verify TypeScript + production build are clean (Step A)** (AC: #20)
  - [x] From `web/`, run `npm run build`.
  - [x] Confirm zero TS errors from `tsc -b`. If errors appear: (a) check the `import` line includes `type` for `Task` (mixed import); (b) check `useRef<HTMLInputElement>(null)` has the explicit type parameter; (c) check no unused locals (every state setter, every ref, every imported symbol IS used in JSX or handlers).
  - [x] Confirm Vite emits `web/dist/index.html` plus hashed `web/dist/assets/*.js` and `web/dist/assets/*.css`. No image references should appear in `dist/` (still no asset imports).
  - [x] Capture the (clean) build output to Debug Log References.

- [x] **Task 5: Runtime smoke verification (Step B, preferred)** (AC: #20)
  - [x] Follow Dev Notes → "Runtime verification recipe" exactly: start ephemeral Postgres + API (re-using the Story 2.1 recipe verbatim), then start `npm run dev` in `web/`.
  - [x] Run all eight scenarios in the recipe. For each: confirm the expected DOM state, the expected `POST /api/tasks` (or its absence) in DevTools → Network, and zero console errors.
  - [x] Stop the Vite dev server (Ctrl+C). Stop the API dev server (Ctrl+C — confirm the SIGINT log line). Stop and remove the ephemeral Postgres container.
  - [x] Capture: the build output (Task 4), the network responses for the four "happy path" scenarios, the rendered DOM text for each scenario, and any console-error / 404 evidence (should be empty in success scenarios) into Debug Log References.
  - [x] If Docker is unavailable, document this in Completion Notes and mark Step B as deferred to Story 2.6 / 2.7 (per AC #20 fallback). Step A alone is sufficient for the AC in that fallback path.

- [x] **Task 6: Final integrity check before declaring done** (AC: #15, #16, #17, #18, all)
  - [x] `git status` shows the following changes and ONLY these: `web/src/api.ts` (modified), `web/src/App.tsx` (modified), `web/src/App.css` (modified). Three files.
  - [x] `git diff web/package.json` produces empty output (no dependency changes — AC #15).
  - [x] `git diff web/package-lock.json` produces empty output (no install ran — AC #15).
  - [x] `git status` shows `api/`, `db/`, `e2e/`, `README.md` have zero modifications (AC #16, #17).
  - [x] No new files anywhere (AC #18). Specifically: no `web/src/components/`, no `web/src/hooks/`, no `web/src/types.ts`, no `web/src/TaskForm.tsx`.
  - [x] Commit with message such as `feat(web): create task form with POST integration (Story 2.2)`. Do not push (manual builder action, same convention as Stories 1.1–2.1).

## Dev Notes

### Locked code skeleton — `createTask` addition to `web/src/api.ts`

[Source: web/src/api.ts:1-19 (existing `fetchTasks` precedent), architecture.md#3.1, architecture.md#4.2, 2-1-create-task-post-api-tasks-endpoint.md]

APPEND this function to the END of `web/src/api.ts` (after `fetchTasks`, line 19). Match character-for-character. Do NOT modify any existing line.

```ts
// POST /api/tasks — create one task. The Content-Type header is REQUIRED;
// without it Express's express.json() does not populate req.body and the
// server returns 400 "description must be a string" (Story 2.1 AC #5).
// On non-2xx, try to extract the server's {error: string} message before
// falling back to status text — this is what lets Story 2.5's toast show
// the real reason instead of a generic "request failed."
export async function createTask(description: string): Promise<Task> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!response.ok) {
    let serverMessage: string | null = null;
    try {
      const body = (await response.json()) as unknown;
      if (
        body !== null &&
        typeof body === 'object' &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
      ) {
        serverMessage = (body as { error: string }).error;
      }
    } catch {
      // body was not JSON (proxy 502, empty body, HTML error page) — fall
      // through to the status-text path.
    }
    const detail = serverMessage ?? `${response.status} ${response.statusText}`;
    throw new Error(`POST /api/tasks failed: ${detail}`);
  }
  return (await response.json()) as Task;
}
```

Notes for the reader (do NOT add as comments to the file beyond what is already there):

- **Why `JSON.stringify({ description })` and not `JSON.stringify(description)`:** the API expects `{"description":"..."}` (an object with a `description` field), not a bare string. `JSON.stringify("buy milk")` produces `"\"buy milk\""` which Express parses as the JS string `"buy milk"` and then `req.body.description` is `undefined` → 400.
- **Why `headers: { 'Content-Type': 'application/json' }` and not `'application/json; charset=utf-8'`:** equivalent at runtime (browsers/`fetch` send UTF-8 either way for string bodies), shorter is cleaner. Either works; the locked skeleton uses the short form.
- **Why parse the error body inside `try` and not assert the shape with `as { error: string }`:** the server's contract IS `{error: string}` for 4xx/5xx, but proxies (Caddy 502 page, infrastructure HTML pages) can send non-JSON bodies. A blanket `as` cast would crash the toast logic in Story 2.5 with "Cannot read property 'error' of undefined" instead of showing the friendly fallback.
- **Why the in-conditional `'error' in body && typeof ... === 'string'` discriminator and not Zod:** validating one optional string property from a parsed JSON object is two `typeof` checks. Adding Zod to validate it would ship 12 KB of validator runtime for one boolean.
- **Why no `signal: AbortSignal`:** the user can submit twice in quick succession (paste + Enter, click + Enter), but the second submit awaits the first's `await createTask(...)` to resolve before its own state read — the React form's button is not disabled, but JS's single-threaded event loop serializes the two `onSubmit` calls. AbortController is correct in Story 3.4 if optimistic UI introduces overlapping requests; premature here.
- **Why no `keepalive: true`:** the user is not closing the tab as a result of submitting. `keepalive` is for analytics beacons.

### Locked code skeleton — `web/src/App.tsx`

[Source: web/src/App.tsx:1-44 (Story 1.4 shell), epics.md#Story 2.2, prd.md#NFR15, architecture.md#4.3]

REPLACE the entire file with this. The Story 1.4 mount effect, `tasks` and `loading` state, and three render branches are PRESERVED character-for-character; the new code adds the `description` state, `inputRef`, `onSubmit`, `onKeyDown`, and the `<form>` JSX between the `<h1>` and the render branches.

```tsx
import { useEffect, useRef, useState } from 'react';
import { createTask, fetchTasks, type Task } from './api';
import './App.css';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // useEffect callbacks cannot be async (returning a Promise breaks the
    // cleanup-function contract). Wrap the async work in a nested function.
    async function load() {
      try {
        const result = await fetchTasks();
        setTasks(result);
      } catch (err) {
        // FR40: console.* only. Toast region arrives in Story 2.5.
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Without preventDefault the browser navigates to "/?" and loses state.
    event.preventDefault();
    const trimmed = description.trim();
    // Whitespace-only / empty = silent no-op. NOT an error toast, NOT a
    // disabled button — the user just sees nothing happen. Server-side 400
    // is the safety net (Story 2.1 AC #6).
    if (trimmed.length === 0) {
      return;
    }
    try {
      const task = await createTask(trimmed);
      // Functional updater: two rapid submits would otherwise race on the
      // stale `tasks` closure.
      setTasks((prev) => [...prev, task]);
      setDescription('');
      // Re-focus so the user can keep typing without reaching for the mouse
      // (PRD NFR15 keyboard-first ergonomics).
      inputRef.current?.focus();
    } catch (err) {
      // FR40: console.* only. Toast region arrives in Story 2.5. Leave the
      // input value AND focus untouched so the user can retry without retyping.
      console.error(err);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Escape clears the input. Enter is handled by the <form>'s native submit
    // behavior (do NOT add an Enter case here — it would shadow the native
    // submit and complicate the trim/ignore logic).
    if (event.key === 'Escape') {
      setDescription('');
    }
  }

  return (
    <main>
      <h1>Tasky</h1>
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task"
          aria-label="Task description"
        />
        <button type="submit">Add</button>
      </form>
      {loading ? (
        <p>Loading…</p>
      ) : tasks.length === 0 ? (
        <p aria-live="polite">No tasks</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>{task.description}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
```

Notes for the reader (do NOT add as comments to the file):

- **Why the form sits ABOVE the three render branches:** epic AC: "a first-time user can identify how to create a task from the empty state alone." If the form rendered only inside the populated-list branch, the empty state would have nowhere to type. If it rendered only inside the empty-state branch, the user could never add a second task. Above-all-branches is the only correct position.
- **Why `setTasks((prev) => [...prev, task])` (functional updater) and not `setTasks([...tasks, task])`:** the latter reads `tasks` from the closure captured at the time `handleSubmit` was created. If the user submits twice in quick succession (the network is fast, the user is typing fast), the second handler's closure may still see the pre-first-submit `tasks` array, and the first task disappears from the visible list. Functional updaters always read the latest state. This is the React-FAQ "stale closure" bug.
- **Why no `disabled={loading || description.trim().length === 0}` on the submit button:** epic AC: "no confirmation dialog or multi-step flow" + AC #7's silent-ignore contract. A disabled button on whitespace-only input would (a) block the no-op silent return that the AC mandates, (b) flicker every keystroke as the user types, (c) require a focus state for the disabled button which is a separate accessibility concern. The button stays enabled; the handler's trim-and-return is the entire empty-input UX.
- **Why `useRef<HTMLInputElement>(null)` not `useRef(null)`:** without the explicit type parameter, TS infers `MutableRefObject<null>` and `inputRef.current` is forever `null`. The explicit `<HTMLInputElement>` makes `current` `HTMLInputElement | null` so `?.focus()` works.
- **Why `inputRef.current?.focus()` and not `inputRef.current.focus()`:** under `strict` mode, TS knows `current` can be `null` (e.g., between unmount and the cleanup running). The optional-chaining is the cheap correct guard.
- **Why no `useEffect(() => inputRef.current?.focus(), [])` for autofocus on mount:** screen readers position their cursor on the first focusable element; auto-focusing the input on first load steals that cursor and surprises non-sighted users. Re-focus AFTER a successful submit is contextual ("the user just typed; they probably want to type again") and screen-reader-friendly.
- **Why `placeholder="Add a task"` and `aria-label="Task description"`:** placeholders disappear on focus AND are not consistently announced by screen readers AND are low-contrast in most browsers. The visible placeholder is for sighted users to see "what goes here"; the `aria-label` is the screen-reader name for the input. Both are needed because there is no visible `<label>` element (the form is one input wide; a `<label>` above it is visual noise for one input).
- **Why `type="submit"` is explicit on the button:** browsers default to `submit` for `<button>` inside `<form>`, but the explicit form (a) survives a future copy-paste move outside the form, (b) makes the intent visible at the call site, (c) is consistent with the explicit-is-better discipline thesis.
- **Why no `<label htmlFor="...">` element:** the visible UI is one input + one button on one line. Adding a `<label>` would either be on the same line (wasting horizontal space) or above (wasting vertical space and visually duplicating the placeholder). The `aria-label` provides the accessible name for screen readers; sighted users have the placeholder.
- **Why React's synthetic event types and not native DOM types:** React wraps native events in `SyntheticEvent` for cross-browser consistency; using the native `SubmitEvent` type would lose access to React-specific properties and be inconsistent with the rest of the React idioms.

### Locked code skeleton — `web/src/App.css` additions

[Source: web/src/App.css:1-26 (Story 1.4 base), epics.md#Story 2.2, architecture.md#3.1]

APPEND these rules to the END of `web/src/App.css` (after the existing `p` rule, line 26). Match character-for-character.

```css
form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

input[type="text"] {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  font-family: inherit;
  border: 1px solid #d0c9d6;
  border-radius: 4px;
}

button {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
}
```

Notes for the reader (do NOT add as comments to the file):

- **Why `display: flex; gap: 0.5rem`:** puts the input next to the button on one row with consistent spacing. Grid would also work; flex is one fewer property and matches React-form convention.
- **Why `flex: 1` on the input:** lets the input fill the remaining width after the button takes its intrinsic size. Without it, the input is a tiny ~150px native default.
- **Why `font-family: inherit` on input AND button:** browsers default form controls to `Arial` / `Times` / a stack OTHER than the body's `system-ui`. Without `inherit`, the input/button look obviously "form-y" against the rest of the page. Two lines of CSS for a meaningful improvement.
- **Why `border: 1px solid #d0c9d6`:** the browser-default text-input border is fine on most platforms but inconsistent (Safari uses a beveled style, Chrome a flat single line). Setting an explicit muted border makes the input look intentional. The color is in the same muted-grey family as the `<p>` color from Story 1.4 (`#6b6375`) — both are placeholder palette and Story 3.1 will replace them with a real palette.
- **Why `border-radius: 4px`:** matches what the browser's macOS/Windows native controls would render. Optional but cheap; helps the input not look "boxy."
- **Why no `:focus` rule:** browser default focus rings are the AC #10 contract. Story 3.1 may add a designed focus state.
- **Why no `button:hover` or `button:active`:** browser defaults handle these adequately. Story 3.1 polish.
- **Why no media query:** Story 3.2 owns mobile/responsive concerns. Adding a `@media (max-width: 480px)` rule here would (a) be premature, (b) need to be revisited when Story 3.2 lands a coherent breakpoint scheme.
- **Why no transition / animation:** Story 3.4 (optimistic UI) is the right home for any "task appears" animation; even there, the discipline thesis says reach for it only if it aids comprehension.
- **Why selector `input[type="text"]` and not bare `input`:** Story 2.3 will add `<input type="checkbox">` next to each task. A bare `input` selector would apply this padding/border/font to those checkboxes too, which would look broken. Type-attribute selectors keep the form-text input rules scoped.

### Runtime verification recipe (AC #20, Step B)

This builds on Story 2.1's runtime recipe by adding the frontend dev-server step and the eight in-browser scenarios.

```bash
# Shell 1: ephemeral Postgres + API (identical to Story 2.1's recipe).
docker run --rm \
  -v "$PWD/db:/docker-entrypoint-initdb.d:ro" \
  -e POSTGRES_PASSWORD=verify \
  -e POSTGRES_DB=tasky_smoke \
  -p 5432:5432 \
  --health-cmd 'pg_isready -U postgres -d tasky_smoke' \
  --health-interval 1s \
  --health-timeout 1s \
  --health-retries 30 \
  --name tasky_2_2_smoke \
  -d postgres:17-alpine

until [ "$(docker inspect -f '{{.State.Health.Status}}' tasky_2_2_smoke)" = "healthy" ]; do sleep 1; done

cd api
DATABASE_URL='postgres://postgres:verify@127.0.0.1:5432/tasky_smoke' npm run dev &
API_PID=$!
sleep 2
curl -s http://localhost:3000/api/tasks   # Expect: []

# Shell 2: Vite dev server.
cd web
npm run dev
# Open the printed URL (default http://localhost:5173) in a browser.
```

In the browser, run all eight scenarios. After each, check DevTools → Network and DevTools → Console.

1. **Initial load (empty DB).** Page tab title `Tasky`, page renders `<h1>Tasky</h1>`, the form (input + Add button) is visible, render branch shows `No tasks`. Network: one `GET /api/tasks` returning `200 []`. Console: zero errors.
2. **Submit empty input.** Click the input, immediately press Enter (no typing). Expected: NOTHING happens. No `POST /api/tasks` request, no list change, no error in console. The `No tasks` placeholder still shows.
3. **Submit whitespace-only.** Click the input, type 3 spaces, press Enter. Expected: same as scenario 2. No request, no list change. (Bonus: the input STILL contains the 3 spaces — it was NOT cleared, because the silent-ignore path returns BEFORE clearing.)
4. **Submit valid task — Enter key path.** Click the input, type `buy milk`, press Enter. Expected: `POST /api/tasks` with body `{"description":"buy milk"}`, response `201` with the created task. The list now shows `<ul><li>buy milk</li></ul>`. The input is empty. Focus is on the input (the cursor blinks there; you can immediately type the next task).
5. **Submit valid task — Add button click path.** Click the input, type `read book`, click the Add button. Expected: identical to scenario 4 with a second `<li>read book</li>` appended. Input cleared, focus back on input.
6. **Submit task with leading/trailing whitespace.** Click the input, type `  buy bread  ` (two leading spaces, two trailing), press Enter. Expected: `POST /api/tasks` body is `{"description":"buy bread"}` (trimmed before send). The list now shows `<li>buy bread</li>` (NOT `<li>  buy bread  </li>` — the trim is what got persisted).
7. **Escape clears input.** Click the input, type `abc`, press Escape. Expected: input becomes empty. NO `POST` request fires. NO list change. (Optional verification: the cursor is still in the input.)
8. **Refresh the browser tab.** Hard-reload (Cmd+Shift+R / Ctrl+Shift+R). Expected: the list shows the same three tasks (`buy milk`, `read book`, `buy bread`) — created via API, persisted in Postgres, re-fetched on mount. This double-checks no `useState`-only state was lost.

```bash
# Tear down.
# Ctrl+C the Vite dev server (shell 2).
# Ctrl+C the API dev server (shell 1) — confirm "SIGINT received" log line.
kill -TERM "$API_PID" 2>/dev/null
docker stop tasky_2_2_smoke
```

Capture for each scenario: the network status line, the rendered DOM text, and the console state (should be empty for all eight scenarios). Optional: a screenshot of scenarios 1, 4, 7.

### Pre-existing repo state to be aware of

[Source: filesystem inspection at story creation time, 2026-04-29; git log; sprint-status.yaml]

- **Story 2.1 already shipped `POST /api/tasks`.** The endpoint accepts `{"description": string}` (length 1–500), returns 201 with the created `Task`, returns 400 `{"error": "..."}` for validation failures, returns 500 `{"error": "Internal server error"}` for DB failures. Story 2.1 is `review` per `sprint-status.yaml`. **Story 2.2 CONSUMES this endpoint as-is; it does NOT modify any backend file.**
- **Story 1.4 already shipped `web/src/api.ts`** (19 lines: `Task` type + `fetchTasks`) and `web/src/App.tsx` (44 lines: shell with mount-time fetch + three render branches). Story 1.4 is `review` per `sprint-status.yaml`. **Story 2.2 EXTENDS both files; it does NOT replace them.**
- **`web/src/App.css` is 26 lines** (Story 1.4: `main`, `h1`, `ul`, `li`, `p`). This story APPENDS form/input/button rules; it does NOT modify any existing rule.
- **`web/src/index.css` is the trimmed 11-line version from Story 1.4** (`:root` font stack + `body { margin: 0 }`). Untouched by this story.
- **`web/vite.config.ts` has the `/api` → `localhost:3000` proxy from Story 1.4.** The proxy forwards POST as well as GET (Vite's default). Untouched by this story.
- **`web/index.html` `<title>` is `Tasky`** (Story 1.4). Untouched by this story.
- **`web/package.json` deps:** `react ^19.2.5`, `react-dom ^19.2.5` + dev deps for ESLint, TypeScript, Vite, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@types/node`. All sufficient. Run zero `npm install <new-package>` commands.
- **`web/tsconfig.app.json`** has `strict`, `verbatimModuleSyntax: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`, `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`. New code MUST satisfy these as-is.
- **`web/src/main.tsx` is unchanged** since Story 1.1 (`createRoot(...).render(<StrictMode><App /></StrictMode>)`). StrictMode WILL invoke the mount `useEffect` twice in dev — same caveat as Story 1.4; harmless for the idempotent GET.
- **The DB schema's `CHECK (length(description) > 0 AND length(description) <= 500)`** (db/init.sql:10) is the API's safety-net rejection bound. Frontend's trim-and-ignore-empty is the UX layer; the server rejects empty strings AND raw-length > 500 with 400.
- **A stray top-level `package.json`** still exists at the project root (Story 1.3 / 1.4 precedent). Do not touch.
- **The git working tree may not be clean before this story starts.** Begin by inspecting `git status` and noting any pre-existing modifications that are not yours to touch (specifically: Stories 1.2 / 1.4 / 1.5 / 2.1 are all `review` not `done`, so their committed changes are part of the working baseline — but uncommitted edits in those areas are someone else's territory).

### What this story does NOT touch

These belong to specific later stories — touching them is scope creep:

- **`PATCH /api/tasks/:id` route + `toggleTask(id, completed)` in `db.ts` + checkbox UI** — Story **2.3**.
- **`DELETE /api/tasks/:id` route + `deleteTask(id)` in `db.ts` + Delete button UI** — Story **2.4**.
- **Inline error toast / banner UI for failed mutations** (this story logs to console only; toast lands in 2.5) — Story **2.5**.
- **Persistence verification across `docker compose down && up`** (this story's recipe is an ad-hoc `docker run`, not compose) — Story **2.6**.
- **Playwright E2E test** (`e2e/tasks.spec.ts`) — Story **2.7**.
- **Designed empty state** (illustration, friendly copy, deliberate spacing) — Story **3.1**. This story keeps the plain `No tasks` text from 1.4.
- **Mobile / responsive rules** (viewport meta tag, `@media (max-width: ...)`, 44px touch targets) — Story **3.2**.
- **Full README polish** (screenshots, Quickstart polish, Phase 0 gaps section, full endpoint table for all four endpoints) — Story **3.3**.
- **Optimistic UI with `useOptimistic`** (this story uses request/response: append on success only) — Story **3.4**.
- **`api/`, `db/`, `e2e/`, `Caddyfile`, `docker-compose.yml`, root `package.json`, `.env.example`** — owned by other stories; this story has zero edits there.
- **`web/package.json`, `web/tsconfig*.json`, `web/eslint.config.js`, `web/index.html`, `web/vite.config.ts`, `web/src/main.tsx`, `web/src/index.css`, `web/src/assets/`, `web/public/`** — strictness flags, lint config, HTML scaffold, dev proxy, mount entry, global CSS, assets all stay as Story 1.1 / 1.4 set them.

### Anti-patterns to avoid (common LLM mistakes)

- ❌ Do **not** add a form library — no `react-hook-form`, no `formik`, no `final-form`. The form has ONE input. `useState` is the entire state machine.
- ❌ Do **not** add a validation library — no `zod`, no `yup`, no `joi`, no `valibot`. The only client-side validation is `trim().length === 0` (three lines).
- ❌ Do **not** add an HTTP client — no `axios`, no `ky`, no `wretch`, no `superagent`. Native `fetch` (Story 1.4 architectural decision).
- ❌ Do **not** add a data-fetching / cache library — no `@tanstack/react-query`, no `swr`, no `apollo-client`. The 4-function `api.ts` is the locked contract.
- ❌ Do **not** add an icon library — no `react-icons`, no `lucide-react`, no `@heroicons/react`. The Add button is a plain `<button>` with the text `Add`.
- ❌ Do **not** add an accessibility-component library — no `react-aria`, no `@headlessui/react`, no `@radix-ui/*`. The form is one labeled input and one button; semantic HTML covers it.
- ❌ Do **not** add `useOptimistic`. Story 3.4 (cut-first). This story is request/response.
- ❌ Do **not** generate a temporary `id` (`Date.now()`, `crypto.randomUUID()`) for the optimistic display. AC #13. Append AFTER the server returns.
- ❌ Do **not** re-fetch `GET /api/tasks` after a successful create. AC #14. Append the server-returned task to local state.
- ❌ Do **not** call `event.preventDefault()` from the `<button>`'s `onClick`. The single submit path is the `<form>`'s `onSubmit` (which DOES `preventDefault`). Adding an `onClick` would create two submit paths.
- ❌ Do **not** omit `event.preventDefault()` from the `<form>`'s `onSubmit`. Without it, the browser navigates to `/?` and loses all state. This is THE most common React-form bug.
- ❌ Do **not** read `tasks` from the closure inside `setTasks([...tasks, task])`. Use the functional updater `setTasks((prev) => [...prev, task])`. AC #6 + Notes.
- ❌ Do **not** disable the Add button when input is empty (`disabled={description.trim() === ''}`). AC #7 — silent-ignore is the contract.
- ❌ Do **not** add `required` to the input. Same reason — silent-ignore is the contract; `required` would surface a browser-native validation popup.
- ❌ Do **not** add `maxLength={500}` to the input. The API rejects > 500 with a clean 400; truncating on paste hides the over-limit feedback Story 2.5 will surface.
- ❌ Do **not** add `autoFocus` to the input. Screen-reader hostile. Re-focus AFTER successful submit is the only auto-focus this story adds.
- ❌ Do **not** add a `<label htmlFor="...">` element. The visible input is one of one; `aria-label` covers screen readers and the `placeholder` covers sighted users.
- ❌ Do **not** add an `id` attribute to the input "to associate a label with it." There is no `<label>`; an `id` is dead code.
- ❌ Do **not** add `name="description"` to the input. There is no native form submission (`onSubmit` is React-controlled); `name` is dead code.
- ❌ Do **not** add an Enter-key `onKeyDown` handler. The native `<form>` submit fires on Enter from any text input within. Adding one would create a double-submit or shadow the native behavior. AC #8.
- ❌ Do **not** call `event.preventDefault()` in the Escape `onKeyDown` branch. Escape has no default action on a text input; preventDefault is dead code.
- ❌ Do **not** also clear the input from inside the silent-ignore `if (trimmed.length === 0) return;` path. AC #7 — the input retains the user's whitespace so they can SEE that nothing was submitted.
- ❌ Do **not** silently clear the input on failed POST. AC #6.h — leave it untouched so the user can retry without retyping.
- ❌ Do **not** call `setLoading(true)` before the create POST and `setLoading(false)` after. The `loading` state is the MOUNT-time fetch flag (Story 1.4) — repurposing it for create operations would re-render the entire view as `<p>Loading…</p>`, hiding the just-typed task and the input itself.
- ❌ Do **not** add a separate `submitting` state to disable the form during the POST. Stories 3.4 may add an in-flight indicator; this story relies on the JS event-loop serialization (a second submit awaits the first to finish before its own state read).
- ❌ Do **not** add a `try { ... } catch { setError(...) } finally { setSubmitting(false) }` pattern. No `error` state in this story (toast = Story 2.5); no `submitting` state (above).
- ❌ Do **not** trim the description inside `createTask`. The trim happens at the UI boundary (in the submit handler), not inside the API client. AC #1 — `createTask` does NO validation; AC #7 — UX trims at the boundary.
- ❌ Do **not** wrap the response in an envelope assumption: `await response.json() as { task: Task }`. The server returns a bare `Task` (Story 2.1 AC #8). `as Task` is correct.
- ❌ Do **not** add a CSS reset (`normalize.css`, `modern-normalize`, `the-new-css-reset`). Browser defaults are sufficient.
- ❌ Do **not** add `outline: none` or `outline: 0` anywhere. Focus indicators are NFR16 territory and Story 3.1 may design a custom focus style — but the indicator MUST stay.
- ❌ Do **not** add CSS variables / color tokens / palette in `App.css`. Story 3.1 owns the palette.
- ❌ Do **not** add `@media (max-width: ...)` rules in `App.css`. Story 3.2 owns responsive.
- ❌ Do **not** add `transition` / `animation` properties. Story 3.1 / 3.4 territory if at all.
- ❌ Do **not** modify `web/package.json`, `web/package-lock.json`, `web/index.html`, `web/vite.config.ts`, `web/tsconfig*.json`, `web/eslint.config.js`, `web/src/main.tsx`, or `web/src/index.css`. AC #15, #18, #19.
- ❌ Do **not** modify `api/src/db.ts`, `api/src/server.ts`, `db/init.sql`, `api/package.json`, or `api/tsconfig.json`. AC #16, #18.
- ❌ Do **not** modify `README.md`. AC #17.
- ❌ Do **not** create `web/src/TaskForm.tsx`, `web/src/components/`, `web/src/hooks/useTasks.ts`, or `web/src/types.ts`. AC #18 — no new files.
- ❌ Do **not** install or run a Vitest / Jest / `@testing-library/react` / Playwright / Cypress test in this story. Phase 0 has one Playwright smoke (Story 2.7); the runtime recipe IS the verification.
- ❌ Do **not** add a global error handler / window.onerror / unhandledrejection listener. Story 2.5 owns user-visible error surfacing; `console.error` is sufficient until then.
- ❌ Do **not** add `<noscript>` content to `index.html`. Out of scope; the app is JS-required by design.

### Naming and style conventions

[Source: architecture.md#4.1]

- **TS/TSX modules:** `kebab-case.ts(x)` for plain modules (`api.ts`); `PascalCase.tsx` is acceptable for files that export a single React component (`App.tsx`).
- **TS types/interfaces:** `PascalCase` (`Task`).
- **TS variables/functions:** `camelCase` (`createTask`, `fetchTasks`, `handleSubmit`, `handleKeyDown`, `description`, `inputRef`, `setDescription`, `setTasks`, `setLoading`, `tasks`, `loading`).
- **React event handler props:** `onSubmit`, `onChange`, `onKeyDown` (camelCase per JSX convention; HTML attribute equivalents would be all lowercase).
- **Local handler functions named after the event they handle:** `handleSubmit`, `handleKeyDown` (NOT `onSubmit`, `submitForm`, `submit` — `handle*` is the unambiguous React idiom).
- **JSX attribute values:** double quotes (`type="text"`, `aria-label="Task description"`) — matches the file's existing style.
- **CSS selectors:** lower-case element selectors (`form`, `input[type="text"]`, `button`); no class names in this story (none needed).
- **JSON keys (sent):** `camelCase` (`description`) — matches the API's accepted shape (Story 2.1 AC #5).
- **HTTP verb / URL:** uppercase verb (`POST`), kebab-case plural noun (`/api/tasks`). Matches Story 1.4 / 2.1.

### Project Structure Notes

The story modifies three existing files (`web/src/api.ts`, `web/src/App.tsx`, `web/src/App.css`). No new files, no new directories. This matches the architecture's flat-layout principle (Architecture §5.1 — `web/src/{main.tsx, App.tsx, api.ts, App.css}` is the locked file set; §4.5 — "Co-locate first; inline until it hurts").

The function naming (`createTask` next to `fetchTasks` in `api.ts`) matches the architecture's frontend plan literally (§3.1 — "native `fetch` wrapped in a 4-function `api.ts` module"; §5.1 — `api.ts` is the canonical client module). Stories 2.3 and 2.4 will append `toggleTask` and `deleteTask` to the same file using the same minimal-fetch + JSON.stringify + try-parse-error pattern this story establishes.

The submit-handler shape (`handleSubmit` + `handleKeyDown` + a single `<form>`) is the prototype that Stories 2.3 (checkbox `onChange`) and 2.4 (Delete button `onClick`) will follow — same trim-and-ignore-where-applicable, same try/catch + console.error, same functional state updater. Establishing it cleanly here pays compound interest across the next two stories.

No conflicts or variances detected.

### References

- [Source: epics.md#Story 2.2] — User story, acceptance criteria, scope boundaries (epics.md lines 404–423).
- [Source: epics.md#Story 1.4] — Confirms shell mount-time fetch + three render branches are inputs (preserved by this story).
- [Source: epics.md#Story 2.1] — Confirms `POST /api/tasks` API contract is shipped (`{description: string}` → 201 `Task` | 400 `{error: string}` | 500 `{error: string}`).
- [Source: epics.md#Story 2.3] — Confirms PATCH route + checkbox UI is next-story scope; this story does NOT add toggle UI.
- [Source: epics.md#Story 2.4] — Confirms DELETE route + Delete button UI is later-story scope; this story does NOT add delete UI.
- [Source: epics.md#Story 2.5] — Confirms error toast UI is later-story scope; this story logs failures to console only.
- [Source: epics.md#Story 3.1] — Confirms designed empty state is later-story scope; this story keeps the plain `No tasks` text.
- [Source: epics.md#Story 3.2] — Confirms responsive / mobile is later-story scope; this story has no media queries.
- [Source: epics.md#Story 3.4 (cut criteria)] — Confirms optimistic UI is the FIRST cut; this story is deliberately request/response so a 3.4 cut leaves the app working.
- [Source: prd.md#FR6] — No page reload during create (this story uses `event.preventDefault()` + in-place state update).
- [Source: prd.md#FR12] — No authentication / account / onboarding (preserved from Story 1.4 — no login UI added here).
- [Source: prd.md#FR22] — No signup prompt, tour overlay, modal, marketing chrome (preserved from Story 1.4).
- [Source: prd.md#FR23] — A first-time user can identify how to create a task without instruction (the form sits above all render branches; `placeholder="Add a task"` is the affordance).
- [Source: prd.md#FR40] — `console.log`/`console.error` to stdout/stderr only; no logging library (the catch-handler `console.error(err)` complies).
- [Source: prd.md#NFR14] — Semantic HTML for interactive elements (`<form>`, `<input>`, `<button>`).
- [Source: prd.md#NFR15] — Keyboard-first ergonomics: Enter submits, Escape clears (this story's two-key contract).
- [Source: prd.md#NFR16] — Browser-default focus rings preserved (no `outline: none`).
- [Source: prd.md#NFR19] — No confirmation dialog before any action.
- [Source: architecture.md#3.1] — Frontend stack lock-in: vanilla CSS, `useState`, native `fetch`, no router, no state lib, no data-fetching lib, no CSS framework.
- [Source: architecture.md#3.4] — Same-origin contract; relative `/api/*` URLs (already established by Story 1.4).
- [Source: architecture.md#4.1] — Naming conventions; snake_case DB → camelCase JSON happens server-side (frontend trusts the wire shape).
- [Source: architecture.md#4.2] — REST conventions: bare-object responses (no envelopes), `{error: "..."}` error shape, status codes (201 for POST), JSON-number IDs.
- [Source: architecture.md#4.3] — Frontend patterns: re-fetch on mount; toast region in 2.5; optimistic UI in 3.4 only; if 3.4 cut, the app falls back to plain request/response — which IS what this story implements.
- [Source: architecture.md#4.5] — Boundary mapping in one place (server-side, in `db.ts`); the frontend consumes camelCase directly.
- [Source: architecture.md#5.1] — Repository layout: `web/src/{main.tsx, App.tsx, api.ts, App.css}` is the locked file set; this story modifies three of those four.
- [Source: architecture.md#5.3] — No `controllers/`, no `services/`, no `components/`; "if any of these appears in the Phase 0 codebase, it is a discipline-thesis violation."
- [Source: web/src/api.ts:1-19] — Existing module that this story extends; `Task` type and `fetchTasks` are inputs.
- [Source: web/src/App.tsx:1-44] — Existing shell that this story extends; mount effect, three render branches, and styling baseline are inputs.
- [Source: web/src/App.css:1-26] — Existing stylesheet that this story extends with form/input/button rules.
- [Source: web/tsconfig.app.json] — TS strictness flags this story's code must satisfy.
- [Source: web/vite.config.ts] — Dev proxy `/api` → `localhost:3000` (Story 1.4); forwards POST as well as GET.
- [Source: api/src/server.ts:30-50] — `POST /api/tasks` handler shipped by Story 2.1; the contract this story consumes.
- [Source: api/src/server.ts:55-60] — Single error middleware that produces the `{error: string}` shape this story's `createTask` extracts.
- [Source: db/init.sql:8-14] — `CHECK (length(description) > 0 AND length(description) <= 500)` — the safety-net length bound the API enforces and the UI's silent-ignore complements.
- [Source: 1-4-minimal-frontend-rendering-empty-shell.md] — Prior story; locked code skeletons for `api.ts` and `App.tsx` that this story extends. Anti-patterns list (no router, no state lib, no CSS framework, no test framework, no tracking) is preserved.
- [Source: 2-1-create-task-post-api-tasks-endpoint.md] — Prior story; the API contract source of truth (validation rules in AC #6, error shape in AC #7, success shape in AC #8, status codes in AC #9, content-type in AC #10).
- [Source: deferred-work.md] — Five Story 1.2/1.3 deferred items; this story does NOT change any of them.
- [Source: sprint-status.yaml] — Confirms Story 2.1 `review`, Stories 1.4/1.5 `review` (acceptable preconditions); Story 2.2 `backlog` → being moved to `ready-for-dev`.

## Dev Agent Record

### Agent Model Used

claude-opus-4.7 (OpenCode)

### Debug Log References

`npm run build` (web/) — clean:
```
> web@0.0.0 build
> tsc -b && vite build
vite v8.0.10 building client environment for production...
✓ 18 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-BPOO_H-I.css    0.83 kB │ gzip:  0.46 kB
dist/assets/index-Dmr1WDf5.js   191.86 kB │ gzip: 60.57 kB
✓ built in 156ms
```

### Completion Notes List

- Implemented locked code skeletons character-for-character: `createTask` appended to `web/src/api.ts`; `App.tsx` extended with `<form>`, `description` state, `inputRef`, `handleSubmit`, `handleKeyDown`; `App.css` appended with form/input/button rules (24 lines, ≤25 cap).
- Step A verification: `npm run build` clean (tsc + vite). Step B (Docker runtime smoke) deferred per AC #20 fallback — Docker stack startup is out of scope for this batch dev run; runtime verification happens in Story 2.6 / 2.7.
- Zero dependency changes (`web/package.json`, `web/package-lock.json` untouched); zero backend changes; no new files.

### File List

- `web/src/api.ts` (modified — appended `createTask`)
- `web/src/App.tsx` (modified — added form, state, handlers)
- `web/src/App.css` (modified — appended form/input/button rules)

## Change Log

| Date       | Version | Description              | Author |
| ---------- | ------- | ------------------------ | ------ |
| 2026-04-29 | 0.1     | Initial story draft       | Bob (SM) |
| 2026-04-30 | 1.0     | Story implemented; Step A clean, Step B deferred per AC #20 fallback | Dev (OpenCode) |
