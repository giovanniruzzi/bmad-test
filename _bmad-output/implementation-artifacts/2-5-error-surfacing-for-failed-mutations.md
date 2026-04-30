# Story 2.5: Error surfacing for failed mutations

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As any individual using the app,
I want to see a clear inline message when a create/toggle/delete request fails,
so that I am never left wondering whether my action succeeded silently and so subsequent actions are not blocked.

## Acceptance Criteria

1. **`web/src/App.tsx` extends — does NOT replace — the Story 2.4 shell to add a single shared error region.** The existing structure (mount-time `fetchTasks`, `description` state, `inputRef`, `handleSubmit`, `handleToggle`, `handleDelete`, `<form>`, three render branches with checkbox + span + Delete button inside each `<li>`) is PRESERVED. The ONLY structural addition is: (a) a new `error` state (`useState<string | null>(null)`), (b) a new `errorTimerRef` (`useRef<number | null>(null)`) for the auto-dismiss timer, (c) a new conditional `<p role="alert">` rendered between `<h1>Tasky</h1>` and `<form>...`, (d) modifications to the THREE existing handlers' catch blocks to call a new `showError(message)` helper. NO new components, NO new files, NO portal/modal/toast library. [Source: web/src/App.tsx (post-2.4 state), epics.md#Story 2.5, prd.md#FR29, prd.md#FR30]

2. **The error region is a SINGLE `<p>` element with `role="alert"` — NOT multiple toasts, NOT a stack, NOT a banner.** A single string message at a time; the latest error replaces the previous one (so a quick succession of failures shows only the most recent). The `role="alert"` ARIA role causes screen readers to announce the message immediately on appearance (FR29: "screen-reader users hear the error within ~1s"). NO `aria-live="polite"` (which would batch announcements and delay them). NO `role="status"` (lower priority than `alert`). NO `<div role="alert">` wrapping multiple paragraphs (only one paragraph at a time per AC). The element MUST render ONLY when `error !== null` — when `error` is `null`, the element MUST NOT be in the DOM (use `{error !== null && <p role="alert">{error}</p>}`, NOT `<p role="alert" style={{display: error ? 'block' : 'none'}}>{error}</p>` — the latter screen-reader-announces empty content on mount). [Source: prd.md#FR29, MDN ARIA alert role]

3. **The error region renders BETWEEN `<h1>Tasky</h1>` and the `<form>`** — NOT inside the form, NOT inside the list, NOT below the list, NOT in a fixed-position overlay. This placement keeps the message in the user's primary reading flow without obscuring the input or the task list. The DOM order is: `<h1>` → `<p role="alert">` (when error !== null) → `<form>` → render branches. [Source: web/src/App.tsx (post-2.4 state), prd.md#FR29]

4. **The error message is the FULL `err.message` string from the caught Error.** The three mutation helpers (`createTask`, `toggleTask`, `deleteTask`) build their thrown Error messages as `${VERB} /api/tasks${path} failed: ${parseError(response)}` — e.g., `POST /api/tasks failed: description must be between 1 and 500 characters`, `PATCH /api/tasks/42 failed: task not found`, `DELETE /api/tasks/42 failed: 502 Bad Gateway`. The toast displays this WHOLE string verbatim — verb prefix included — so the user knows WHICH action failed AND why. NO truncation, NO regex extraction of "just the server message", NO localization, NO i18n lookup, NO icon prefix (`⚠️ `, `❌`). The verb prefix has been carefully designed across Stories 2.1 / 2.2 / 2.3 / 2.4 to be self-explanatory (`POST` is "create", `PATCH` is "update", `DELETE` is "remove"); displaying the HTTP method is acceptable for Phase 0 (single user, technical or technical-adjacent). [Source: web/src/api.ts (post-2.4 state, parseError helper), 2-4-delete-task-delete-api-tasks-id-and-ui.md AC #11]

5. **Network-failure errors (no response received — `fetch` rejects, `TypeError: Failed to fetch`) MUST surface as a user-readable string — NOT the raw exception message.** When `fetch` itself rejects (CORS, DNS, server unreachable, network offline), the helper functions (`createTask` etc.) NEVER reach the `!response.ok` branch — the `await fetch(...)` line throws synchronously inside the helper. That thrown error has `err.message === 'Failed to fetch'` (in Chromium; "NetworkError when attempting to fetch resource" in Firefox; varies by browser). The `showError` function MUST detect this case (the error message is NOT prefixed with `POST /api/tasks failed:` etc.) and substitute the generic string `'Something went wrong'` per the epic AC. The detection rule: if `err.message.includes(' failed: ')` (the verb-prefix marker), use `err.message` as-is; otherwise, use `'Something went wrong'`. [Source: epics.md#Story 2.5 AC, prd.md#FR29]

6. **The `showError(messageOrErr: string | unknown)` helper is the SINGLE entry point for setting the error state — NOT direct `setError` calls inside catch blocks.** Defined inside the `App` component, BELOW the existing handlers, ABOVE the `return (`. The helper: (a) accepts EITHER a string OR an `unknown` (the catch-block param type per TypeScript best practice), (b) normalizes via `const message = typeof messageOrErr === 'string' ? messageOrErr : (messageOrErr instanceof Error && messageOrErr.message.includes(' failed: ') ? messageOrErr.message : 'Something went wrong')`, (c) calls `setError(message)`, (d) clears any pending auto-dismiss timer (`clearTimeout(errorTimerRef.current)`), (e) starts a new auto-dismiss timer (`window.setTimeout(() => setError(null), 3000)`) and stores its handle in `errorTimerRef.current`. This single helper is the ONLY place that touches `errorTimerRef` — handler catch blocks just call `showError(err)`. [Source: epics.md#Story 2.5 AC, prd.md#FR29, architecture.md#4.3]

7. **The auto-dismiss timeout is EXACTLY 3000 ms (3 seconds), chosen per Architecture §4.3.** Use `window.setTimeout(() => setError(null), 3000)` (the `window.` prefix is REQUIRED for TypeScript — global `setTimeout` returns `NodeJS.Timeout` in `@types/node`, but `window.setTimeout` returns `number` which matches the `useRef<number | null>(null)` type). Do NOT use 5000 (too long — blocks scanning for next error), do NOT use 1500 (too short — not enough time to read a long server message). Do NOT use a per-error duration (over-engineered). Do NOT make the duration configurable via env var or constant (premature). [Source: architecture.md#4.3, epics.md#Story 2.5 AC]

8. **The error region is dismissible via a close button — a `<button type="button" aria-label="Dismiss error">×</button>` rendered AFTER the message text.** Click handler: `() => { setError(null); if (errorTimerRef.current !== null) { window.clearTimeout(errorTimerRef.current); errorTimerRef.current = null; } }`. The button MUST be a real `<button>` (NOT a `<span onClick>` — fails accessibility), MUST have visible content (`×` Unicode character — U+00D7 MULTIPLICATION SIGN; NOT `X` letter, NOT `&times;` HTML entity which the JSX parser handles fine but `×` literal is clearer), MUST have `aria-label="Dismiss error"` (the visible `×` is not a meaningful accessible name on its own), MUST have `type="button"` (story 2.4 AC #14 reasoning). NO `onMouseEnter` / `onFocus` "pause auto-dismiss on hover" (over-engineered for Phase 0). [Source: prd.md#NFR14, prd.md#NFR15, epics.md#Story 2.5 AC]

9. **The auto-dismiss timer MUST be cleared and restarted on EVERY new error.** If the user fails three creates in quick succession, only the LATEST error is shown, and the dismiss timer is reset to a fresh 3000 ms each time. Concretely: `showError` always calls `clearTimeout(errorTimerRef.current)` BEFORE starting the new timer. NO debouncing, NO throttling, NO error queueing. The "always reset" semantic is what makes the toast non-disruptive: a long error message stays visible long enough for the next attempt's outcome to land. [Source: architecture.md#4.3, epics.md#Story 2.5 AC]

10. **The auto-dismiss timer MUST be cleaned up on component unmount.** Add a new `useEffect(() => { return () => { if (errorTimerRef.current !== null) { window.clearTimeout(errorTimerRef.current); } }; }, [])` near the other effect. WITHOUT this, a pending timer will fire after the component unmounts and React will log "Can't perform a React state update on an unmounted component" — harmless in production but noise in dev. The cleanup function MUST check for `null` before calling `clearTimeout` (calling with `null` is a no-op in browsers but a type error under strict TS). [Source: React docs — useEffect cleanup; prd.md#FR40]

11. **The three existing catch blocks (`handleSubmit`, `handleToggle`, `handleDelete`) are MODIFIED to call `showError(err)` AFTER the existing `console.error(err)`.** The full new shape: `} catch (err) { console.error(err); showError(err); }`. The `console.error` STAYS (per FR40, per Stories 2.2/2.3/2.4); `showError(err)` is APPENDED on the next line. NO removal of `console.error`, NO replacement, NO consolidation. The dev-tools log AND the user-facing toast are TWO different audiences. [Source: web/src/App.tsx (post-2.4 state), prd.md#FR40, epics.md#Story 2.5]

12. **The mount-time `fetchTasks` effect's catch block (the `useEffect` from Story 1.4) is NOT modified to call `showError`.** Rationale: the mount fetch is a READ, not a mutation; a load failure is a different UX problem (the user sees "Loading…" indefinitely until they refresh). Surfacing a load error via the same toast would be misleading (the toast is positioned and worded as a mutation-failure indicator). A future story can address load-failure UX (e.g., a "Retry" button in the loading branch); this story scope is mutation failures only. The mount-effect catch block stays as `console.error(err)` only. [Source: web/src/App.tsx:9-24 (Story 1.4 mount effect), epics.md#Story 2.5 AC ("any API MUTATION")]

13. **The failed mutation MUST NOT block subsequent user actions** (FR30). Concretely: (a) after a failed `handleSubmit`, the input is NOT cleared, focus stays in the input, the user can edit and resubmit; (b) after a failed `handleToggle`, the checkbox stays in its old state, the user can click again; (c) after a failed `handleDelete`, the task stays in the list, the Delete button is still clickable. None of the handlers set any "in-flight" state that would disable controls. The error toast appearing does NOT cover any control (it's positioned above the form, not over it). [Source: prd.md#FR30, epics.md#Story 2.5 AC, web/src/App.tsx (post-2.4 state)]

14. **The failed mutation MUST NOT leave the UI in an inconsistent state** (epic AC). The locked design from Stories 2.2/2.3/2.4 ALREADY satisfies this without re-fetch: (a) `createTask` failure: `setTasks` is never called, so the local list never gained the task; (b) `toggleTask` failure: `setTasks` is never called, so the checkbox stays in its old state; (c) `deleteTask` failure: `setTasks` is never called, so the task stays in the list. Story 2.5 does NOT need to add re-fetch logic — the request-then-update pattern is naturally consistent. Do NOT add `await fetchTasks()` calls in any catch block (would double network cost AND cause flicker AND race against parallel mutations). [Source: 2-2-list-and-create-tasks-in-the-ui.md AC #14, 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md AC #12, 2-4-delete-task-delete-api-tasks-id-and-ui.md AC #13]

15. **NO use of `window.alert()`, `window.confirm()`, `window.prompt()`, `<dialog>`, modal, or browser notification API** (epic AC + FR29 + NFR19). No `Notification.requestPermission()`. No `navigator.sendBeacon` for error tracking. No `console.log` of the error message FOR THE USER — `console.error` is for the developer per FR40. [Source: prd.md#FR29, prd.md#NFR19, prd.md#FR40]

16. **The error region's CSS gets ONE small block.** Append to `web/src/App.css`. Locked rules: `.error-toast { ... }` for the `<p>` (basic visual treatment: padding, border, background — see locked skeleton for exact values). `.error-toast button { ... }` for the close button (background: transparent, border: none, cursor: pointer). NO color-only error-state signaling (the message text + `role="alert"` already convey "this is an error"; color is reinforcement, not the only signal). The CSS uses NEUTRAL colors (a light pink background `#fee` and a darker red text `#900` is acceptable BUT the contrast ratio MUST be ≥ 4.5:1 — `#fee` background with `#900` text is 9.3:1, well above WCAG AA). NO `outline: none` or focus suppression on the close button. Total added CSS ≤ 15 lines. [Source: prd.md#NFR16, WCAG 1.4.3 contrast, architecture.md#3.1]

17. **`web/src/api.ts` is NOT modified.** The error-extraction logic (parseError + verb-prefixed Error.message) is COMPLETE from Stories 2.2/2.3/2.4. This story only consumes existing thrown errors. [Source: web/src/api.ts (post-2.4 state)]

18. **`api/src/db.ts`, `api/src/server.ts`, `db/init.sql`, the deploy artifacts (`Caddyfile`, `compose.yaml`, `web/vite.config.ts`) are NOT modified.** Frontend-only story. The server's error contract was finalized in Story 2.1 (single error middleware emitting `{error: string}`); this story consumes it. [Source: api/src/server.ts:55-60, architecture.md#4.4]

19. **NO new files in `web/src/`, `api/`, `e2e/`, `db/`, or the project root.** This story's complete file-change set is exactly: `web/src/App.tsx` (modified — add `error` state, `errorTimerRef`, `showError` helper, `useEffect` cleanup, `<p role="alert">` JSX, three catch-block additions), `web/src/App.css` (modified — append `.error-toast` block). Two files. Specifically, do NOT create `web/src/Toast.tsx`, do NOT create `web/src/hooks/useToast.ts`, do NOT create `web/src/lib/error.ts`. [Source: architecture.md#5.1, architecture.md#5.3]

20. **NO new dependencies.** Same forbidden list as Stories 2.2/2.3/2.4 — no `react-hot-toast`, no `react-toastify`, no `sonner`, no `@radix-ui/react-toast`, no `notistack`. The toast pattern in this story is ~30 lines of vanilla React; a library would be 50+ KB of dependencies for ~30 LOC of saved code — net negative for Phase 0. The deps list MUST stay byte-identical; `git diff web/package.json web/package-lock.json` MUST produce empty output. [Source: architecture.md#5.3]

21. **NO README change.** Story 3.3 owns the rewrite. [Source: epics.md#Story 3.3]

22. **TypeScript strictness — code MUST satisfy `web/tsconfig.app.json` flags as-is.** Practical implications:
    - `errorTimerRef` is typed `useRef<number | null>(null)`. The `window.setTimeout` call returns a `number` in browser TypeScript types; `setTimeout` (no `window.` prefix) returns `NodeJS.Timeout` if `@types/node` is installed (it MAY be, transitively) — use `window.setTimeout` and `window.clearTimeout` to force the browser type.
    - `error` is typed `useState<string | null>(null)` — explicit `null` initial value, `string | null` union type.
    - The catch block's `err` parameter is `unknown` (TS 4.4+ default; `web/tsconfig.app.json` has `useUnknownInCatchVariables` implicitly true under `strict: true`). The `showError` helper accepts `unknown` and narrows internally.
    - `noUnusedLocals: true` will fail if `errorTimerRef` is declared but not used in `showError` or the cleanup effect.
    - Do NOT loosen any flag. [Source: web/tsconfig.app.json (existing)]

23. **NO performance regression — no UI thread blocking longer than imperceptible** (NFR4 + epic AC). The toast logic is one `setState`, one `clearTimeout`, one `setTimeout` — sub-millisecond on any device. No synchronous network calls in the toast path; no large object construction; no DOM manipulation outside React's render cycle. [Source: prd.md#NFR4]

24. **Static + runtime verification.** Three-step:
    - **Step A (always required):** From `web/`, run `npm run build` (`tsc -b && vite build`). Confirm zero TS errors and a successful Vite build. If errors: (a) check `useRef<number | null>(null)` not `useRef(null)`; (b) check `window.setTimeout` (not bare `setTimeout`) for the number return type; (c) check `useState<string | null>(null)` explicit type; (d) check `showError` parameter type accepts `unknown`.
    - **Step B (runtime, preferred):** Exercise the scenarios in Dev Notes → "Runtime verification recipe". All scenarios must pass.
    - **Step B fallback (Docker unavailable):** Document skip in Completion Notes.

## Tasks / Subtasks

- [ ] **Task 1: Add `error` state, `errorTimerRef`, and `showError` helper to `web/src/App.tsx`** (AC: #1, #6, #7, #9, #10, #22)
  - [ ] Open `/Users/gio/Source/bmad-test/web/src/App.tsx`. Confirm post-2.4 state: contains `tasks`, `loading`, `description` state; `inputRef`; mount `useEffect`; `handleSubmit`, `handleToggle`, `handleDelete`; the `<form>` and three render branches with checkbox + span + Delete button per `<li>`.
  - [ ] Update the import line to add `useRef` if not already present (Story 2.2 added it for `inputRef`, so it should be there; confirm).
  - [ ] Inside the `App` component, BELOW the existing `tasks`/`loading`/`description` state declarations, ADD: `const [error, setError] = useState<string | null>(null);` and `const errorTimerRef = useRef<number | null>(null);` (alongside the existing `inputRef`).
  - [ ] Add the `showError` helper function INSIDE the `App` component, AFTER the existing `handleDelete` (Story 2.4) and BEFORE the `return (` statement. Use the locked code from Dev Notes → "Locked code skeleton — `showError` helper".
  - [ ] Add a SECOND `useEffect` for cleanup: `useEffect(() => { return () => { if (errorTimerRef.current !== null) { window.clearTimeout(errorTimerRef.current); } }; }, []);`. Place it AFTER the existing mount `useEffect`, BEFORE `handleSubmit`.
  - [ ] Confirm: `errorTimerRef` is referenced in `showError` AND in the cleanup effect (TS would complain otherwise per `noUnusedLocals`).
  - [ ] Confirm: `window.setTimeout` and `window.clearTimeout` are used (NOT bare `setTimeout`/`clearTimeout`) so the type is `number`.

- [ ] **Task 2: Modify the three handler catch blocks to call `showError(err)`** (AC: #11, #12)
  - [ ] In `handleSubmit`, modify the catch block from `} catch (err) { console.error(err); }` to `} catch (err) { console.error(err); showError(err); }`. Two-line catch block.
  - [ ] In `handleToggle`, same modification.
  - [ ] In `handleDelete`, same modification.
  - [ ] Do NOT modify the mount `useEffect`'s catch block (per AC #12 — load failures are not in scope).
  - [ ] Confirm `console.error(err)` STAYS in all three (per FR40); `showError(err)` is APPENDED, not replacing.

- [ ] **Task 3: Add the `<p role="alert">` toast region to JSX** (AC: #2, #3, #8, #15)
  - [ ] In the `return (` JSX, BETWEEN `<h1>Tasky</h1>` and `<form ...>`, INSERT the locked JSX from Dev Notes → "Locked code skeleton — toast JSX region". Three or four lines of JSX.
  - [ ] Confirm: the `<p>` element is wrapped in `{error !== null && ( ... )}` (conditional rendering — the element is ABSENT from the DOM when error is null per AC #2).
  - [ ] Confirm: the `<p>` has `role="alert"` AND `className="error-toast"`.
  - [ ] Confirm: the close `<button>` is `type="button"`, has visible content `×` (U+00D7), `aria-label="Dismiss error"`, and an `onClick` that clears both the error state AND the timer.
  - [ ] Confirm: zero `<dialog>`, zero modal overlay, zero `aria-live="polite"`, zero `role="status"`.

- [ ] **Task 4: Append `.error-toast` styling to `web/src/App.css`** (AC: #16)
  - [ ] Open `/Users/gio/Source/bmad-test/web/src/App.css`. Confirm post-2.4 state.
  - [ ] APPEND the rules from Dev Notes → "Locked code skeleton — `.error-toast` CSS" character-for-character. Place at end of file.
  - [ ] Confirm: contrast ratio of text color vs. background ≥ 4.5:1 (the locked colors `#900` on `#fee` give 9.3:1).
  - [ ] Confirm: zero `outline: none` / `outline: 0` / focus suppression rules.
  - [ ] Confirm: zero animation/transition rules (auto-dismiss is a state flip, not an animation — Story 3.1 may add transitions).
  - [ ] Total added: ≤ 15 lines.

- [ ] **Task 5: Static + runtime verification** (AC: #24)
  - [ ] **Step A — TS + build (always required):**
    - From `/Users/gio/Source/bmad-test/web/`, run `npm run build`. Expect: zero TS errors; dist emitted.
    - If errors: (a) verify `useRef<number | null>(null)` typing; (b) verify `window.setTimeout` not bare `setTimeout`; (c) verify `useState<string | null>(null)` typing.
  - [ ] **Step B — runtime smoke (preferred):**
    - Run scenarios from Dev Notes → "Runtime verification recipe". All scenarios must pass.
  - [ ] **Step B fallback:** Document skip in Completion Notes.
  - [ ] Confirm `git diff web/package.json web/package-lock.json` produces ZERO output (AC #20).
  - [ ] Confirm `git diff README.md` produces ZERO output (AC #21).
  - [ ] Confirm `git status` shows EXACTLY two modified files (AC #19): `web/src/App.tsx`, `web/src/App.css`. No untracked new files.

## Dev Notes

### Locked code skeleton — `showError` helper

Add INSIDE the `App` component, AFTER `handleDelete` (Story 2.4) and BEFORE the `return (` statement:

```tsx

  function showError(messageOrErr: string | unknown): void {
    let message: string;
    if (typeof messageOrErr === 'string') {
      message = messageOrErr;
    } else if (
      messageOrErr instanceof Error &&
      messageOrErr.message.includes(' failed: ')
    ) {
      message = messageOrErr.message;
    } else {
      message = 'Something went wrong';
    }
    setError(message);
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 3000);
  }
```

### Locked code skeleton — toast JSX region

Inside the `return (` JSX, BETWEEN `<h1>Tasky</h1>` and `<form>`:

```tsx
      {error !== null && (
        <p className="error-toast" role="alert">
          {error}
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => {
              setError(null);
              if (errorTimerRef.current !== null) {
                window.clearTimeout(errorTimerRef.current);
                errorTimerRef.current = null;
              }
            }}
          >
            ×
          </button>
        </p>
      )}
```

The `×` character is U+00D7 (MULTIPLICATION SIGN) — paste the literal character, NOT the HTML entity `&times;` (which would render as the literal characters `&times;` inside `{}` JSX expression context — though here it's a text node, JSX would still parse it; literal `×` is unambiguous).

### Locked code skeleton — `.error-toast` CSS

Append to end of `web/src/App.css`:

```css

.error-toast {
  background: #fee;
  color: #900;
  border: 1px solid #900;
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.error-toast button {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  padding: 0 0.25rem;
}
```

(15 lines including blank separator. Colors give 9.3:1 contrast, well above WCAG AA's 4.5:1.)

### Cleanup useEffect placement

Add this SECOND useEffect AFTER the mount fetchTasks useEffect, BEFORE `handleSubmit`:

```tsx
  useEffect(() => {
    return () => {
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
      }
    };
  }, []);
```

The empty dependency array means "run cleanup on unmount only" — exactly what we need. Do NOT add `errorTimerRef` to the deps (refs are stable references — adding them to deps is meaningless and lint-noisy).

### Catch-block modification (all three)

Before (post-2.4):
```tsx
    } catch (err) {
      console.error(err);
    }
```

After (post-2.5):
```tsx
    } catch (err) {
      console.error(err);
      showError(err);
    }
```

The exact same two-line edit applies to `handleSubmit`, `handleToggle`, `handleDelete`. Order matters: `console.error` first (developer audience), then `showError` (user audience).

### Runtime verification recipe

**Prerequisites:** API + DB running per prior stories' recipes; Vite dev server running.

**Setup data:**
```sh
curl -X POST -H 'Content-Type: application/json' -d '{"description":"existing task"}' http://localhost:3000/api/tasks
```

**Scenario A — toast appears on createTask validation failure (description too long).**
1. Open `http://localhost:5173/`.
2. In the input, paste a 600-character string (e.g., `'x'.repeat(600)` from the dev tools console, then `await navigator.clipboard.writeText(...)` and paste).
3. Press Enter.
4. Expect: a toast appears between the H1 and the form with text `POST /api/tasks failed: description must be between 1 and 500 characters`. The toast has a `×` close button on the right.
5. The new task does NOT appear in the list (createTask threw → setTasks never called).
6. The input value is NOT cleared (per AC #13 — failed mutation does not consume input).
7. Console shows the same error logged via `console.error`.
8. Wait ~3 seconds. The toast disappears automatically.

**Scenario B — toast appears on toggleTask failure (network failure).**
1. Open `http://localhost:5173/`.
2. Stop the API process (`Ctrl-C` in the API terminal). Leave the web dev server running.
3. Click any task's checkbox.
4. Expect: a toast appears with text `PATCH /api/tasks/<id> failed: 502 Bad Gateway` (or similar — exact wording depends on Vite's proxy error response).
5. The checkbox state does NOT change (per AC #14 — handler's setTasks never called).
6. Wait ~3 seconds; toast disappears.
7. Restart the API; confirm the next click succeeds and no toast appears.

**Scenario C — toast appears on deleteTask failure (server unreachable mid-flight).**
1. Open `http://localhost:5173/`.
2. Stop the API.
3. Click a task's Delete button.
4. Expect: toast `DELETE /api/tasks/<id> failed: 502 Bad Gateway` (or similar).
5. The task does NOT disappear from the list.

**Scenario D — manual dismiss via close button.**
1. Trigger any error per Scenario A.
2. Within the 3-second window, click the `×` close button on the toast.
3. Expect: toast disappears immediately.
4. The auto-dismiss timer is also cancelled (the toast does NOT reappear later).
5. Trigger another error. The new toast appears with a fresh 3-second timer.

**Scenario E — newer error replaces older error (timer reset).**
1. Trigger error 1 (e.g., 600-char paste + Enter).
2. Within 1 second of the first toast appearing, trigger a second error (e.g., another 600-char paste + Enter).
3. Expect: the toast text updates to the latest error (still the same message in this case, but verify the timer reset).
4. Wait 2 seconds. The toast is STILL visible (because the timer reset 1 second after Step 2, so it has 1 second left).
5. Wait another 1 second. The toast disappears.

**Scenario F — `role="alert"` causes screen-reader announcement.**
1. Enable a screen reader (VoiceOver on macOS: Cmd+F5; NVDA on Windows; Orca on Linux).
2. Trigger any error per Scenario A.
3. Expect: the screen reader announces the error message text within ~1 second of the toast appearing (per FR29).
4. (Skip this scenario if no screen reader is available; document the skip in Completion Notes.)

**Scenario G — failed mutation does NOT block subsequent actions (FR30).**
1. Trigger Scenario A (failed create).
2. Without dismissing the toast, type a VALID description (e.g., "buy bread") in the input and press Enter.
3. Expect: the new task appears in the list. The toast (still visible from Scenario A) is replaced by NOTHING — wait, scenario G is about the toast NOT blocking; the second create succeeds, so no NEW toast appears, the old one continues its 3-second countdown. Verify the old toast disappears on its original schedule.

**Scenario H — close button is keyboard-operable.**
1. Trigger any error.
2. Press Tab repeatedly. Focus order should reach the `×` close button (likely after the input and Add button — exact order depends on DOM order; the toast is BEFORE the form in the DOM, so tab order: × → input → Add → first checkbox → ...).
3. With focus on `×`, press Enter. The toast dismisses.
4. Verify the focus indicator (browser-default outline) is visible on the focused close button.

**Scenario I — toast does NOT cover any control.**
1. Trigger an error so the toast is visible.
2. Visually inspect: the input field, Add button, every checkbox, every Delete button are ALL visible AND interactable. The toast sits ABOVE the form (DOM order); it does not have `position: fixed` or any overlay z-index trickery (per the locked CSS).

**Scenario J — mount-fetch failure does NOT show a toast (per AC #12).**
1. Stop the API.
2. Hard-refresh the browser. The mount fetchTasks call fails.
3. Expect: console shows `Error: GET /api/tasks failed: ...`. NO toast appears (the mount-effect catch block was deliberately NOT modified).
4. The UI shows "Loading…" indefinitely (which is the known Phase 0 limitation — a future story might add a "Retry" button in the loading branch).

**Scenario K — unmount cleanup prevents stale-timer warning.**
1. In React strict mode dev (Vite default in dev), trigger an error.
2. Within the 3-second window, force a hot-reload (e.g., save a trivial whitespace edit to App.tsx).
3. Expect: NO React warning in the console about "Can't perform a React state update on an unmounted component" (because the cleanup effect cleared the timer).

If ALL scenarios A–K pass (skipping F if no screen reader available), AC #24 Step B is satisfied.

### Anti-patterns and forbidden additions

The following are common LLM-generated additions that violate the locked architecture or specific ACs. **Do NOT add ANY of these.**

1. ❌ **Multiple toasts stacked vertically.** Single toast at a time per AC #2. The latest replaces the previous.
2. ❌ **A toast "queue"** that displays errors one-after-the-other. Same anti-pattern; degrades UX (user reads stale error after the next one already happened).
3. ❌ **A toast library** (`react-hot-toast`, `react-toastify`, `sonner`, `@radix-ui/react-toast`, `notistack`). Per AC #20 — vanilla React is enough for the locked design.
4. ❌ **A `<Toast />` extracted component** (`web/src/Toast.tsx`). Per AC #19 — premature extraction.
5. ❌ **A `useToast()` custom hook.** Per AC #19 — single consumer, three call sites all in one file.
6. ❌ **`position: fixed`** on the toast (`top: 0; right: 0;` floating overlay). Per AC #16 — the toast lives in document flow, between H1 and form. Fixed positioning would obscure content on scroll, fail mobile (Story 3.2), and require z-index management.
7. ❌ **`z-index: 9999`** anywhere. No layering needed.
8. ❌ **A backdrop / overlay** behind the toast. Toast is not a modal (per AC #15 — no modals).
9. ❌ **`window.alert(error.message)`** as a "fallback" or "for critical errors". Per AC #15 and FR29 / NFR19.
10. ❌ **`Notification.requestPermission()` + `new Notification(error.message)`.** Per AC #15. Browser notifications require user permission AND fail on most desktop apps anyway.
11. ❌ **An "Error" prefix or icon** (`<span>⚠️</span>`, `<span>❌</span>`, `<strong>Error: </strong>`). Per AC #4 — the message is verbatim. The `role="alert"` ARIA semantic conveys "this is an error" to assistive tech; visual icon would be redundant.
12. ❌ **Truncation with ellipsis** ("description must be between 1 and 500 charact…"). Show the full message; the user needs all of it.
13. ❌ **Localization / i18n lookup** (`t('error.descriptionTooLong')`). Phase 0 single-language; the server's English error string is the source of truth.
14. ❌ **`aria-live="polite"`** (instead of `role="alert"`). Polite batches announcements; alert announces immediately. Per FR29.
15. ❌ **`role="status"`** (lower priority). Same anti-pattern as #14.
16. ❌ **`role="alertdialog"`** (modal alert). Implies a dialog with a focused control; not appropriate here.
17. ❌ **`tabindex="0"` on the toast `<p>`** to make it focusable. Not needed; the close button inside is focusable.
18. ❌ **Auto-focusing the close button** when the toast appears. Disrupts user's current focus (likely in the input, mid-type).
19. ❌ **`Esc` key dismiss handler** (`document.addEventListener('keydown', ...)`). Over-engineered; close button + auto-dismiss are enough. Adding `Esc` would also conflict with the `Esc` clears input behavior from Story 2.2.
20. ❌ **Pause auto-dismiss on hover/focus** (`onMouseEnter` clears timer, `onMouseLeave` restarts). Over-engineered for Phase 0.
21. ❌ **Different durations per error type** (5s for 5xx, 3s for 4xx). One duration per AC #7.
22. ❌ **A "Retry" button on the toast.** Out of scope; would require the toast to know which mutation failed and how to re-invoke it (state explosion).
23. ❌ **Logging the error to a remote service** (Sentry, Bugsnag, Datadog). FR40 — `console.*` only.
24. ❌ **`sessionStorage` / `localStorage` persistence of recent errors.** Not in scope; toast is ephemeral.
25. ❌ **`useReducer` for the error state.** One state, one timer — `useState` + `useRef` are simpler.
26. ❌ **`useCallback` wrap around `showError`.** Same reasoning as Story 2.3 AC anti-pattern #39 — closures are fine.
27. ❌ **`useMemo` for the toast JSX.** Render is sub-millisecond.
28. ❌ **`React.memo()` on the toast.** Premature optimization.
29. ❌ **Animating the toast in/out** (`opacity` transition, `transform` slide). Story 3.1 territory; auto-dismiss is a state flip in this story.
30. ❌ **Removing `console.error` from catch blocks** ("the toast replaces it"). Per AC #11 — both stay; different audiences.
31. ❌ **Re-fetching `GET /api/tasks` from the catch block** ("to recover state"). Per AC #14 — the local state is already correct because the failed mutation never mutated it.
32. ❌ **Calling `showError` from the mount `useEffect`'s catch block.** Per AC #12 — load failures are out of scope.
33. ❌ **A `useState<Error | null>`** instead of `useState<string | null>`. Storing the Error object would tempt code to read `.stack` for the user — never useful.
34. ❌ **A toast that shows on SUCCESS too** ("Task created!", "Task deleted!"). Not in scope; epic AC is about FAILURES only. Success is shown via the list updating.
35. ❌ **A toast that shows page-level state** ("Connected", "Reconnecting…"). Not in scope.
36. ❌ **Importing `setTimeout` from a polyfill** (`import { setTimeout } from 'timers'`). Browser global is sufficient; `window.setTimeout` is the correct browser type.
37. ❌ **Using `setInterval` instead of `setTimeout`.** Wrong primitive; we want one-shot dismissal.
38. ❌ **A separate `dismissError` function** alongside the close-button inline handler. The close-button handler is 5 lines; extraction is premature.
39. ❌ **Modifying `web/src/api.ts`.** Per AC #17 — frontend orchestration only.
40. ❌ **Modifying any backend file.** Per AC #18.
41. ❌ **Adding `aria-label` to the toast `<p>`** in addition to `role="alert"`. Redundant; the message text is the accessible name.
42. ❌ **A second toast region for "info" messages.** Out of scope; only error toasts.
43. ❌ **Promise-rejection unhandled handler** (`window.addEventListener('unhandledrejection', ...)`). Out of scope; the catch blocks already handle the cases this story cares about.

### Conventions reinforced by this story

- **Single-source error display**: one toast region, one `showError` helper, three callers — DRY without over-extraction.
- **`role="alert"` for immediate announcement**: ARIA semantic conveys the message's nature; visual styling is reinforcement.
- **`window.setTimeout` for browser typing**: explicit `window.` prefix avoids the `@types/node` `NodeJS.Timeout` return type that would not assign to `useRef<number | null>`.
- **Cleanup effect for refs holding handles**: any `useRef` that owns a `setTimeout`/`setInterval`/event-listener handle MUST be cleaned in a `useEffect` return.
- **`console.error` AND `showError`**: developer audience and user audience are different; keep both.
- **Request-then-update is naturally consistent**: this story confirms the pattern from Stories 2.2/2.3/2.4 needs no additional re-fetch logic to satisfy "no inconsistent state."

### What this story does NOT touch

1. **`web/src/api.ts`** — error format already finalized (AC #17).
2. **`api/src/db.ts`, `api/src/server.ts`** — backend already emits the `{error: string}` contract (AC #18).
3. **`db/init.sql`** — no schema change.
4. **`api/package.json`, `web/package.json`, `web/package-lock.json`, `api/package-lock.json`** — zero deps (AC #20).
5. **Mount `useEffect`'s catch block** — load failures out of scope (AC #12).
6. **Any handler's success path** — only catch blocks change.
7. **`README.md`** — Story 3.3 owns (AC #21).
8. **`Caddyfile`, `compose.yaml`, `web/vite.config.ts`** — out of scope.
9. **`e2e/`** — Story 2.7 territory.
10. **No new files anywhere** (AC #19).

### Source citations

- `web/src/App.tsx` (post-2.4 state) — file extended.
- `web/src/App.css` (post-2.4 state) — file extended.
- `web/src/api.ts` (post-2.4 state) — `parseError` + verb-prefixed messages produced here, consumed by `showError`.
- `api/src/server.ts:55-60` — single error middleware emitting `{error: string}` (the contract `parseError` extracts).
- `_bmad-output/planning-artifacts/architecture.md#3.1` — "Same-origin contract; vanilla React."
- `_bmad-output/planning-artifacts/architecture.md#4.3` — "3s auto-dismiss for transient feedback."
- `_bmad-output/planning-artifacts/architecture.md#4.4` — "Single error middleware; {error: string} shape."
- `_bmad-output/planning-artifacts/architecture.md#5.3` — "Phase 0 minimalism."
- `_bmad-output/planning-artifacts/epics.md#Story 2.5` — full AC list.
- `_bmad-output/planning-artifacts/epics.md#Story 3.4` — optimistic UI cut-criteria.
- `_bmad-output/planning-artifacts/prd.md#FR29` — inline error string mandate.
- `_bmad-output/planning-artifacts/prd.md#FR30` — failed mutation must not block.
- `_bmad-output/planning-artifacts/prd.md#FR40` — `console.*` logging.
- `_bmad-output/planning-artifacts/prd.md#NFR4` — no UI thread blocking.
- `_bmad-output/planning-artifacts/prd.md#NFR14` — semantic HTML for close button.
- `_bmad-output/planning-artifacts/prd.md#NFR15` — keyboard operability.
- `_bmad-output/planning-artifacts/prd.md#NFR16` — visible focus.
- `_bmad-output/planning-artifacts/prd.md#NFR19` — no modals.
- `_bmad-output/implementation-artifacts/2-2-list-and-create-tasks-in-the-ui.md` — handleSubmit catch.
- `_bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md` — handleToggle catch.
- `_bmad-output/implementation-artifacts/2-4-delete-task-delete-api-tasks-id-and-ui.md` — handleDelete catch + parseError extraction.
- WCAG 2.1 §1.4.3 (contrast minimum 4.5:1).
- MDN ARIA `role="alert"` documentation.

## Dev Agent Record

### Context Reference

(Populated by dev agent at story start.)

### Agent Model Used

(Populated by dev agent at story start.)

### Debug Log References

(Populated by dev agent during execution.)

### Completion Notes List

(Populated by dev agent at story end.)

### File List

(Populated by dev agent at story end. Expected: `web/src/App.tsx` modified, `web/src/App.css` modified.)

## Change Log

| Date       | Author             | Change                 |
| ---------- | ------------------ | ---------------------- |
| 2026-04-29 | Bob (Scrum Master) | Initial story creation |
