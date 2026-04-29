# Story 1.4: Minimal frontend rendering empty shell

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a first-time visitor to the deployed URL,
I want the page to load and render a Tasky shell with no signup prompt, tour overlay, or welcome modal,
so that the no-auth, no-onboarding posture is established at the UI level before any features exist.

## Acceptance Criteria

1. **`web/src/api.ts` is created and exports `fetchTasks(): Promise<Task[]>` plus a `Task` type matching the API JSON contract.** The `Task` type is `{ id: number; description: string; completed: boolean; createdAt: string }` — identical shape to `api/src/db.ts`'s `Task` (camelCase, `id` as JS number, `createdAt` as ISO-8601 UTC string). `fetchTasks` issues `fetch('/api/tasks')` (relative URL, same-origin contract — see AC #8), checks `response.ok` and throws on non-2xx, and returns `await response.json() as Task[]`. No third-party HTTP client (no `axios`, no `ky`, no `wretch`); native `fetch` is built into every browser the app targets. This is the canonical client module for the API; later stories (2.1 / 2.2 / 2.3 / 2.4) will add `createTask`, `toggleTask`, `deleteTask` to this same file. [Source: architecture.md#3.1, architecture.md#4.1, architecture.md#4.2]

2. **`web/src/App.tsx` is replaced wholesale with a minimal Tasky shell — the existing Vite-template demo content (counter, logos, docs/social sections, hero image) is removed entirely.** The new `App.tsx` exports a default `App` component that renders semantic HTML at the structural level: `<main>` as the root, `<h1>Tasky</h1>` as the title, and a list area implemented as `<ul>` (or a placeholder `<p>` while the list is empty — see AC #4). No counter, no logos, no marketing sections, no `<a href="https://...">` external links to React/Vite/Discord/X/Bluesky/GitHub. No `import` of `./assets/react.svg`, `./assets/vite.svg`, or `./assets/hero.png`. No reference to `/icons.svg#...`. The only side-effect imports are `./App.css` (for the trimmed styles per AC #6) and `./api` (for `fetchTasks` / `Task`). [Source: epics.md#Story 1.4, architecture.md#3.1, architecture.md#4.3]

3. **`App.tsx` calls `fetchTasks()` exactly once on mount via `useEffect(() => { ... }, [])`.** The component holds the fetched array in `useState<Task[]>([])` and a loading flag in `useState<boolean>(true)`. The effect calls `fetchTasks()`, sets state on resolve, sets the loading flag to `false` in a `finally` block, and logs any error via `console.error(err)` (FR40 — `console.*` only, no toast yet — the toast region arrives in Story 2.5). The `useEffect` dependency array MUST be the empty literal `[]` (mount-only), and the inner async work MUST be wrapped in a nested `async function load() { ... }` and invoked, since `useEffect` callbacks themselves cannot be `async` (returning a Promise breaks the cleanup-function contract). React 19 + StrictMode will invoke the effect twice in development — this is expected and harmless for an idempotent GET; do NOT add a "ran already" guard ref. [Source: architecture.md#3.1, architecture.md#4.3, prd.md#FR40]

4. **The render contract is exactly three visual states, in this order of precedence:** (a) while `loading === true`, render the literal text `Loading…` (with a real ellipsis character `…`, U+2026, NOT three ASCII dots) inside a `<p>` element — this is the FR-NFR1 "shell loads in under one second" placeholder; (b) when `loading === false` and `tasks.length === 0`, render the literal text `No tasks` inside a `<p>` element with `aria-live="polite"` so screen readers announce the result of the fetch; (c) when `loading === false` and `tasks.length > 0`, render a `<ul>` with one `<li key={task.id}>{task.description}</li>` per task. The list-item rendering MUST use `task.id` as the React key (NOT array index — array-index keys break React reconciliation when items are added/removed in later stories). The designed empty state (illustration, helper copy, CTA polish) is explicitly DEFERRED to Story 3.1; this story ships only the plain-text placeholder. [Source: epics.md#Story 1.4 ("plain placeholder text"), prd.md#NFR1, architecture.md#4.3]

5. **No signup form, login button, modal dialog, tour overlay, cookie banner, marketing CTA, or welcome screen appears anywhere in the rendered UI on first load (FR22).** No authentication credential, account UI, password input, OAuth button, or session concept exists in the frontend code (FR12). No reference to `localStorage`, `sessionStorage`, `document.cookie`, or any auth-related package (`react-oauth`, `auth0-react`, `@clerk/clerk-react`, `next-auth`, `firebase/auth`, etc.). The shell is anonymous-by-design: a first-time visitor sees Tasky's title and the data state, nothing else. [Source: epics.md#Story 1.4, prd.md#FR12, prd.md#FR22]

6. **`web/src/App.css` is replaced with a minimal stylesheet — the existing Vite-demo styles (`.counter`, `.hero`, `#center`, `#next-steps`, `#docs`, `#spacer`, `.ticks`, etc.) are removed entirely.** The new `App.css` contains only what the new `App.tsx` actually uses: a `main` selector for centered, max-width content (e.g., `max-width: 640px; margin: 0 auto; padding: 2rem 1rem;`), and trivial `h1`/`p`/`ul`/`li` rules sufficient to prevent the page from looking unstyled. Do NOT use `outline: none` or `outline: 0` anywhere — focus rings are an accessibility requirement and Story 2.x interactive elements depend on the browser default. Do NOT add a CSS reset library (`normalize.css`, `modern-normalize`); the Vite template's `web/src/index.css` `:root` font setup is sufficient. [Source: architecture.md#3.1, architecture.md#4.3]

7. **`web/src/index.css` is trimmed to only the minimal global rules the new shell needs.** The existing file (111 lines) is heavy with Vite-demo theming (`--accent`, `--code-bg`, `--social-bg`, custom `--shadow`, dark-mode overrides for `#social .button-icon`, a fixed `1126px` `#root` width, etc.). The new `index.css` keeps: `body { margin: 0; }`, a `:root` block setting a single sans-serif font stack (`system-ui, -apple-system, Segoe UI, Roboto, sans-serif`) and `color-scheme: light dark;` so the browser's default dark-mode background applies, and nothing else. Do NOT preserve the `--accent: #aa3bff` purple, the `1126px` `#root` width, the `code` styling, or the dark-mode `--social-bg` overrides — they are demo cruft. Heading and paragraph defaults can rely on the browser stylesheet at this stage; bespoke typography is Story 3.1's territory. [Source: architecture.md#3.1, architecture.md#4.3]

8. **Same-origin contract: the frontend MUST call `/api/*` as a relative URL with no host or port hardcoded (FR19).** Forbidden: `fetch('http://localhost:3000/api/tasks')`, `fetch('https://tasky.example.com/api/tasks')`, any `import.meta.env.VITE_API_URL`-style indirection, any `const API_BASE = ...` constant. The only acceptable form is the literal string `'/api/tasks'`. To make `npm run dev` work against a separately-running API on port 3000 without CORS, `web/vite.config.ts` MUST add a Vite dev-server proxy (see AC #9). In production (Story 1.5), Caddy serves `web/dist/` and proxies `/api/*` to the API container, so the same relative URL works without a proxy. [Source: epics.md#Story 1.4, prd.md#FR19, architecture.md#3.4, architecture.md#4.2]

9. **`web/vite.config.ts` adds a dev-server proxy: `server.proxy: { '/api': 'http://localhost:3000' }`.** This is the ONLY mechanism by which `npm run dev` can reach the API process on port 3000 without CORS, since AC #8 forbids absolute URLs in the frontend code. The proxy ONLY affects Vite's dev server (`npm run dev` / port 5173); the production build (`npm run build` → `web/dist/`) emits no proxy config — Caddy handles same-origin routing in Story 1.5. Do NOT enable `changeOrigin: true` (unnecessary for `localhost`-to-`localhost`); do NOT add a `rewrite` (the API routes are already at `/api/*`); do NOT add additional proxy entries. The minimal proxy entry is the only edit to `vite.config.ts` in this story. [Source: architecture.md#3.4, architecture.md#4.2; user decision 2026-04-29: add proxy in Story 1.4 to avoid blocking dev iteration on Stories 2.x while Caddy is still pending]

10. **`web/index.html` `<title>` is updated from the Vite-template default `web` to `Tasky`.** This is the only edit to `index.html` in this story. Do NOT change the `<meta charset>`, `<meta viewport>`, the `<link rel="icon">` (the `favicon.svg` in `web/public/` is generic enough; bespoke favicon is Story 3.1 polish), or the `<script type="module" src="/src/main.tsx">` line. Do NOT add `<meta name="description">`, OpenGraph tags, or theme-color — those are Story 3.1 / Story 3.3 polish. [Source: epics.md#Story 1.4 ("title 'Tasky'"), inferred minimal scope]

11. **`web/src/main.tsx` is NOT modified.** Story 1.1's scaffold is correct as-is: `createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)`. StrictMode MUST stay (it is the React 19 default and surfaces the double-effect-invocation behavior referenced in AC #3 — disabling it would mask correctness bugs that show up in production). The `import './index.css'` line stays (still required after AC #7 trim). [Source: architecture.md#3.1, prd.md#FR14]

12. **No new dependencies.** No `axios`, `ky`, `wretch`, `swr`, `@tanstack/react-query`, `react-router`, `react-router-dom`, `redux`, `@reduxjs/toolkit`, `zustand`, `jotai`, `recoil`, `mobx`, `tailwindcss`, `@mui/material`, `@chakra-ui/react`, `@radix-ui/*`, `shadcn-ui`, `clsx`, `class-variance-authority`, `framer-motion`, `react-icons`, `vitest`, `@testing-library/react`, `playwright`, `cypress`, or any other package gets added to `web/package.json` `dependencies` or `devDependencies`. The deps list at the end of this story MUST be byte-identical to the start of this story. The only edits to `web/package.json` permitted: NONE. (Vite's dev-server proxy uses Vite's built-in functionality — no new package required.) [Source: architecture.md#3.1, architecture.md#5.3]

13. **`web/src/assets/` is left in place but unreferenced.** The Vite-template assets (`react.svg`, `vite.svg`, `hero.png`) MUST NOT be imported by `App.tsx` (per AC #2). They are NOT deleted in this story — same precedent as Story 1.3 leaving the stray top-level `package.json` alone (out of scope = no diff noise). A future cleanup story (or Story 3.1 polish) may delete them; this story does not. Likewise, `web/public/icons.svg` (the Vite-demo icon sprite referenced via `<use href="/icons.svg#...">`) is left alone but unreferenced. `web/public/favicon.svg` stays (still referenced by `index.html`). [Source: user decision 2026-04-29: cleanup precedent matches Story 1.3]

14. **TypeScript strictness — code MUST satisfy the existing `web/tsconfig.app.json` flags as-is.** Relevant flags currently set: `strict`, `verbatimModuleSyntax: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`, `noFallthroughCasesInSwitch: true`, `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`. Practical implications for THIS story: (a) type-only imports MUST use the `type` keyword (`import { type Task } from './api'` if importing the type only — but in `App.tsx` you import both `fetchTasks` (value) and `Task` (type), so use `import { fetchTasks, type Task } from './api'`); (b) relative imports do NOT need `.js` suffixes here (this is `moduleResolution: "bundler"`, not `"nodenext"` like the API — `import './api'` and `import './App.css'` both work); (c) every declared variable MUST be used (the loading flag, the tasks array, every imported symbol). Do NOT loosen any flag to "make errors go away" — fix the imports/types instead. [Source: web/tsconfig.app.json (existing); contrast with API at architecture.md#5.3]

15. **`README.md` is NOT modified by this story.** The frontend gets no README section in Story 1.4 — the only README-touching planning artifact for the frontend is Story 3.3 (Distribution-ready README), which lands the full Quickstart + Frontend section together. Adding a stub `## Frontend` section here would (a) duplicate work that 3.3 owns, (b) require maintenance when 3.3 rewrites it, (c) be inconsistent with Story 1.3's `## API` stub which was explicitly required by epic AC; Story 1.4's epic AC says nothing about README. [Source: epics.md#Story 1.4 (no README requirement); contrast with epics.md#Story 1.3 (FR20 stub explicitly required)]

16. **Static verification — `tsc -b` clean, then `vite build` clean, then runtime smoke.** Three-step verification:
    - **Step A (always required):** From `web/`, run `npm run build` (which is `tsc -b && vite build`). Confirm zero TS errors and a successful Vite production build emitting `web/dist/index.html` plus a hashed JS/CSS bundle. This proves the strict-mode TS code compiles and the bundler is happy with the imports.
    - **Step B (runtime, preferred):** With an API process from Story 1.3 running on `localhost:3000` against an ephemeral Postgres (use the runtime recipe from Story 1.3 Dev Notes), run `npm run dev` from `web/` and open the printed URL (default `http://localhost:5173`) in a browser. Assert visually: page title is `Tasky`, page renders `<h1>Tasky</h1>`, the network tab shows exactly one `GET /api/tasks` request returning `200 [` (the proxy forwarded to `:3000`), the placeholder text reads `No tasks` (against an empty DB), and there are zero console errors and zero unfetched 404s in the network tab. Then `INSERT INTO tasks (description) VALUES ('smoke');` directly into the ephemeral DB, hard-reload the browser, and assert the page now shows `<ul><li>smoke</li></ul>`.
    - **Step B fallback (Docker/API unavailable):** If the API stack cannot be brought up, skip Step B and document why in Completion Notes; AC #16 then degrades to "Step A passes; runtime smoke is deferred to Story 1.5 when the full Compose stack lands."
    - Capture the build output, the network-tab `GET /api/tasks` status, and the rendered page text into Debug Log References. A screenshot is OPTIONAL but useful.

## Tasks / Subtasks

- [x] **Task 1: Create `web/src/api.ts`** (AC: #1, #14)
  - [x] Create `/Users/gio/Source/bmad-test/web/src/api.ts` (does not currently exist).
  - [x] Paste the locked code from Dev Notes → "Locked code skeleton — `web/src/api.ts`" character-for-character.
  - [x] Confirm the file: declares `export type Task = { id: number; description: string; completed: boolean; createdAt: string }`; declares `export async function fetchTasks(): Promise<Task[]>` calling `fetch('/api/tasks')`; throws on `!response.ok` with a useful message including the status; returns `await response.json() as Task[]`.
  - [x] Confirm zero `import` statements other than (none — `fetch` is a global). Confirm no `axios`, no `ky`, no `wretch`, no constant `API_BASE`, no absolute URL anywhere.
  - [x] Confirm `verbatimModuleSyntax` compliance: `Task` is exported via `export type Task = ...` (NOT `export interface Task`).

- [x] **Task 2: Replace `web/src/App.tsx` with the new shell** (AC: #2, #3, #4, #5, #14)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/App.tsx` (currently the 122-line Vite demo).
  - [x] Replace the entire file contents with the locked code from Dev Notes → "Locked code skeleton — `web/src/App.tsx`".
  - [x] Confirm the file: imports only `useEffect`, `useState` from `'react'`, `fetchTasks` and `type Task` from `'./api'`, and `./App.css` (side-effect import, no name); does NOT import any image, SVG, or asset; renders `<main>` containing `<h1>Tasky</h1>` and one of three render branches per AC #4; uses `task.id` (not array index) as the `<li>` key.
  - [x] Confirm the `useEffect` dependency array is the empty literal `[]`; the async work is wrapped in a nested `async function load()`; the loading flag flips to `false` in a `finally` block; errors are reported via `console.error(err)`.
  - [x] Confirm zero `<a href="...">`, zero `<button>`, zero `<form>`, zero `<input>`, zero modal-related markup. Zero references to `react.svg`, `vite.svg`, `hero.png`, `/icons.svg`.

- [x] **Task 3: Replace `web/src/App.css` with the minimal stylesheet** (AC: #6)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/App.css` (currently 184 lines of Vite-demo styling).
  - [x] Replace the entire file contents with the locked code from Dev Notes → "Locked code skeleton — `web/src/App.css`".
  - [x] Confirm: zero `.counter`, `.hero`, `.framework`, `.vite`, `#center`, `#next-steps`, `#docs`, `#social`, `#spacer`, `.ticks`, `.icon`, `.logo`, `.button-icon` selectors. Zero `outline: none`, zero `outline: 0`. No `@import` of any external stylesheet.

- [x] **Task 4: Trim `web/src/index.css`** (AC: #7)
  - [x] Open `/Users/gio/Source/bmad-test/web/src/index.css` (currently 111 lines of Vite-demo `:root` theming, dark-mode overrides, `#root` width constraint, code styling).
  - [x] Replace the entire file contents with the locked code from Dev Notes → "Locked code skeleton — `web/src/index.css`".
  - [x] Confirm: only `body` and `:root` rules remain. No `--accent`, `--code-bg`, `--social-bg`, `--shadow` variables. No `1126px` `#root` width. No `code` selector. No `@media (prefers-color-scheme: dark)` overrides for `#social .button-icon` (those selectors no longer exist anyway).

- [x] **Task 5: Add Vite dev-server proxy in `web/vite.config.ts`** (AC: #8, #9)
  - [x] Open `/Users/gio/Source/bmad-test/web/vite.config.ts` (currently 7 lines, just `defineConfig({ plugins: [react()] })`).
  - [x] Replace with the locked code from Dev Notes → "Locked code skeleton — `web/vite.config.ts`".
  - [x] Confirm: only `plugins` and `server.proxy` keys are present in the config object; the proxy entry is `'/api': 'http://localhost:3000'` exactly (no `changeOrigin`, no `rewrite`, no array-of-targets).

- [x] **Task 6: Update `web/index.html` `<title>`** (AC: #10)
  - [x] Open `/Users/gio/Source/bmad-test/web/index.html` (currently `<title>web</title>`).
  - [x] Change line 7 to `<title>Tasky</title>`. Touch nothing else.
  - [x] Confirm via `git diff web/index.html` that the diff is exactly one line changed.

- [x] **Task 7: Confirm `web/src/main.tsx` is unchanged** (AC: #11)
  - [x] Run `git diff web/src/main.tsx` and confirm zero output. If a stray edit happened, revert it.

- [x] **Task 8: Verify build is clean (Step A)** (AC: #16)
  - [x] From `web/`, run `npm run build`.
  - [x] Confirm zero TS errors from `tsc -b`. If TS errors appear: (a) check that all type-only imports use the `type` keyword (`import { type Task } from './api'`); (b) check that every declared variable is used (`noUnusedLocals` is on); (c) check that the `Task` type is exported via `export type Task` (not `export interface`).
  - [x] Confirm Vite emits `web/dist/index.html` plus hashed `web/dist/assets/*.js` and `web/dist/assets/*.css`. No image references should appear in `dist/` (since the demo SVGs are no longer imported).
  - [x] Capture the (clean) build output to Debug Log References.

- [x] **Task 9: Runtime smoke verification (Step B, preferred)** (AC: #16)
  - [x] In one shell: spin up the ephemeral Postgres + API stack per Story 1.3 Dev Notes → "Runtime verification recipe" (steps 1–3 only — start Postgres, wait healthy, `npm run dev` the API). Confirm `curl -s http://localhost:3000/api/tasks` returns `[]`.
  - [x] In a second shell: from `web/`, run `npm run dev`. Open the printed URL (default `http://localhost:5173`) in a browser.
  - [x] Assert the browser tab title reads `Tasky`. Assert the page shows `<h1>Tasky</h1>` and the placeholder `No tasks`. Assert DevTools → Network → `GET /api/tasks` request returned `200 OK` with body `[]` (the Vite proxy forwarded to `:3000`). Assert DevTools → Console has zero errors.
  - [x] In the Postgres shell from step 1: `docker exec -i tasky_api_smoke psql -U postgres -d tasky_smoke -c "INSERT INTO tasks (description) VALUES ('smoke');"`.
  - [x] Hard-reload the browser tab. Assert the page now shows `<ul><li>smoke</li></ul>` (i.e., one list item with text "smoke"). Assert the new `GET /api/tasks` request returned `200 OK` with the one-row JSON body.
  - [x] Stop the Vite dev server (Ctrl+C). Stop the API dev server (Ctrl+C — confirm the SIGINT log line per Story 1.3). Stop and remove the ephemeral Postgres container.
  - [x] Capture: the build output (Task 8), the two `GET /api/tasks` response bodies, the rendered page text for both states (no-tasks and one-task), and any console-error / 404 evidence (should be empty) into Debug Log References. Optional: a screenshot of each state.
  - [x] If Docker is unavailable, document this in Completion Notes and mark Step B as deferred to Story 1.5 (per AC #16 fallback). Step A alone is sufficient for AC #16 in that fallback path.

- [x] **Task 10: Final integrity check before declaring done** (AC: all)
  - [x] `git status` shows the following changes and ONLY these: `web/src/App.tsx` (modified), `web/src/api.ts` (added), `web/src/App.css` (modified), `web/src/index.css` (modified), `web/vite.config.ts` (modified), `web/index.html` (modified). Nothing else changed by this story.
  - [x] `git diff web/package.json` shows zero output (no dependency changes per AC #12). `git diff web/package-lock.json` also shows zero output (no `npm install` ran).
  - [x] `git diff web/src/main.tsx` shows zero output (per AC #11).
  - [x] `web/src/assets/` still contains `react.svg`, `vite.svg`, `hero.png` (unchanged on disk per AC #13). `web/public/icons.svg` and `web/public/favicon.svg` unchanged.
  - [x] No new files in `api/`, `e2e/`, `db/`, or the project root.
  - [x] Commit with message such as `feat(web): minimal Tasky shell with GET /api/tasks fetch (Story 1.4)`. Do not push (manual builder action, same convention as Stories 1.1 / 1.2 / 1.3).

## Dev Notes

### Locked code skeleton — `web/src/api.ts`

[Source: architecture.md#3.1, architecture.md#4.1, architecture.md#4.2]

This is the single source of truth for the frontend's HTTP client. Match it character-for-character. If you find yourself "improving" it — adding `axios`, wrapping in TanStack Query, exposing an `API_BASE` constant, building a generic `request<T>(...)` factory — stop. Those are deliberate non-decisions (see "Anti-patterns to avoid" below). Stories 2.1 / 2.2 / 2.3 / 2.4 will append `createTask`, `toggleTask`, `deleteTask` to this same file using the same minimal-fetch pattern.

```ts
// Mirror of api/src/db.ts's Task type. Boundary mapping happens server-side
// (architecture.md#4.5) — the JSON wire format is the contract here.
export type Task = {
  id: number;
  description: string;
  completed: boolean;
  createdAt: string;
};

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
```

Notes for the reader (do NOT add as comments to the file beyond what is already there):

- **Why `as Task[]` and not `zod.parse`:** Phase 0 ships zero validation libraries (Architecture §3.2 / §5.3). The API in Story 1.3 returns a typed shape; treating its output as the declared type is the same trust model used by every minimal `fetch` example in the React docs. Reconsider in Phase 1 when the API surface grows.
- **Why throw on `!response.ok` instead of returning a discriminated union:** keeps the calling code in `App.tsx` to one `try` / `catch` with `console.error`. A `Result<T, E>` shape would force every caller to branch on success/failure even when the only failure handling is "log and stay on the loading screen." Story 2.5 will introduce a real error toast, at which point the throw still works (the catch handler just calls a toast function instead of `console.error`).
- **Why no `signal: AbortSignal`:** the fetch in `App.tsx` is mount-only; there is no user action that re-issues it before resolution in this story. Stories 2.x mutations re-fetch after success, but never racing in-flight reads. Adding `AbortController` plumbing now is premature.
- **Why no `Content-Type` header on the request:** `GET` has no body. Browsers do not need (and `fetch` does not send) a `Content-Type` for a body-less request.

### Locked code skeleton — `web/src/App.tsx`

[Source: architecture.md#3.1, architecture.md#4.3, epics.md#Story 1.4]

```tsx
import { useEffect, useState } from 'react';
import { fetchTasks, type Task } from './api';
import './App.css';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  return (
    <main>
      <h1>Tasky</h1>
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

- **Why `useState<Task[]>([])` instead of `useState<Task[] | null>(null)`:** the `loading` flag is the source of truth for "have we fetched yet?". Encoding that into the data type as well (using `null`) duplicates state and forces narrowing at every read site. Empty-array-plus-loading-flag is the simpler shape.
- **Why a nested `async function load()` instead of an IIFE `(async () => { ... })()`:** equivalent at runtime; the named function is easier to read and to set a debugger breakpoint on. Either is correct; the locked skeleton uses the named form.
- **Why no `useOptimistic` here:** Story 1.4 has zero mutations. `useOptimistic` lands in Story 2.1 (POST) or Story 2.3 (PATCH toggle) per Architecture §3.1. Premature here.
- **Why `aria-live="polite"` only on the empty-state `<p>`:** screen readers should announce the result of the asynchronous fetch ("No tasks" or the list arrival), but should NOT re-announce the static `Loading…` text or each `<li>` (the `<ul>` itself is enough). `polite` (vs `assertive`) is correct because this is informational, not urgent. Do NOT add `aria-live` to the `<ul>` or the `Loading…` `<p>`.
- **Why `…` (U+2026) instead of `...`:** typography correctness. Browsers render the single Unicode character at the correct width and screen readers pronounce it as "ellipsis" once instead of "dot dot dot". Vite + React handle UTF-8 source files natively.
- **Why no `key` on the `<p>` branches:** sibling-uniqueness keys are required when React renders a sibling LIST. Conditional render of a single element per branch needs no key.
- **Why no error UI in this story:** the epic AC describes three states: loading, empty, populated. There is no fourth "fetch failed" state in the AC. Story 2.5 adds a toast. For Story 1.4, a fetch failure leaves the placeholder text on screen (`No tasks`, since `tasks` stays at its initial `[]`) and one `console.error` line. This is acceptable and intentional.
- **Why `function App()` declaration not `const App = () => {}`:** named function declaration produces a clearer name in React DevTools and stack traces. Either works; the locked skeleton uses the declaration form (matches Story 1.1's scaffold style).

### Locked code skeleton — `web/src/App.css`

[Source: architecture.md#3.1, architecture.md#4.3]

```css
main {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

h1 {
  margin: 0 0 1.5rem;
  font-size: 2rem;
  font-weight: 600;
}

ul {
  list-style: disc;
  padding-left: 1.5rem;
  margin: 0;
}

li {
  margin: 0.25rem 0;
}

p {
  margin: 0;
  color: #6b6375;
}
```

Notes for the reader (do NOT add as comments to the file):

- **Why `max-width: 640px`:** comfortable single-column reading width for a list app. Not a magic number — it's the same order of magnitude as common reading-line-length recommendations and matches what later stories will be themed around. Adjust in Story 3.1.
- **Why `list-style: disc`:** browser default for `<ul>` is already `disc` on most browsers, but explicitly setting it makes the intent visible and survives a future CSS reset.
- **Why one `p` color and no dark-mode override here:** the `:root { color-scheme: light dark; }` in `web/src/index.css` (Task 4) lets the browser pick a sensible default text color per OS theme. The faint `#6b6375` for `<p>` is inherited from the prior Vite-demo palette (preserved as a deliberate restraint — `<p>` text is "secondary" relative to the `<h1>` and the list items). Story 3.1 introduces a real palette.
- **Why no `&:focus-visible` rules:** there are no focusable interactive elements in this story (no `<button>`, no `<a>`, no `<input>`). Focus styling is Story 2.x territory when interactive elements arrive.

### Locked code skeleton — `web/src/index.css`

[Source: architecture.md#3.1]

```css
:root {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  color-scheme: light dark;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
}
```

Notes for the reader (do NOT add as comments to the file):

- **Why keep `color-scheme: light dark`:** lets the browser apply its native dark-mode background and form-control colors automatically, with zero JS and zero media-query CSS. Matches the discipline thesis ("the browser's defaults already work").
- **Why drop the `--accent: #aa3bff` variable:** it was the Vite-demo purple. The new shell has no accent-colored elements. Reintroduce a real palette in Story 3.1 if and when one is designed.
- **Why drop the `1126px` `#root` width:** the Vite-demo layout was a fixed-width centered column with bordered sides. The new shell uses `max-width: 640px` on `<main>` (per `App.css`), which is responsive without a wrapper rule.
- **Why drop the dark-mode `#social .button-icon` invert filter:** that selector existed to recolor SVG logos in the demo's social section. The shell has no such elements.

### Locked code skeleton — `web/vite.config.ts`

[Source: architecture.md#3.4, architecture.md#4.2; user decision 2026-04-29]

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api/* to the API process during `npm run dev` so the frontend
      // can use relative URLs (architecture.md#3.4 same-origin contract).
      // Production same-origin routing is handled by Caddy in Story 1.5.
      '/api': 'http://localhost:3000',
    },
  },
});
```

Notes for the reader (do NOT add as comments to the file beyond what is already there):

- **Why `'http://localhost:3000'` is the literal value:** Story 1.3's API binds `0.0.0.0:3000` (default Express). When `npm run dev` runs on the same host, `localhost:3000` reaches it. There is no Compose network in dev (Story 1.5).
- **Why no `changeOrigin: true`:** that flag rewrites the `Host` header from `localhost:5173` to `localhost:3000`. The Story 1.3 API does not inspect or care about `Host`. Adding the flag is harmless but unnecessary; keep the config minimal.
- **Why no `rewrite` callback:** the API routes are already mounted at `/api/tasks` (Story 1.3 AC #12). The proxy preserves the path by default. Adding a `rewrite: (p) => p.replace(/^\/api/, '')` would BREAK the routing.
- **Why no `https`, `cors`, or `secure` keys:** dev is HTTP-only at this stage (HTTPS is Caddy in production, Story 1.5). CORS is not needed because the proxy makes the browser see only the dev-server origin.
- **Why TypeScript-typed `vite.config.ts`:** Vite supports both `.ts` and `.js` configs; the project already uses `.ts`. `defineConfig(...)` provides type inference for the `server.proxy` shape.

### Why no React Router

[Source: architecture.md#3.1 ("React Router: deliberately omitted... single screen, no URLs"), architecture.md#5.3]

Tasky is a single-screen app: title + list. There are no routes to navigate between. Adding `react-router` / `react-router-dom` (or TanStack Router, or Wouter) would ship ~30 KB of code, introduce a "where do I add the next route?" decision the architecture has explicitly closed, and require a `BrowserRouter` wrapper in `main.tsx` that does nothing. If a Phase 1 story ever needs routes (a settings page, a per-tag view), revisit then. Until that day: no router.

### Why no state-management library

[Source: architecture.md#3.1 ("State manager: useState, useOptimistic for optimistic UI"), architecture.md#5.3]

The total state in Story 1.4 is `{ tasks: Task[], loading: boolean }`. Across the entire Phase 0 frontend (Stories 1.4 + 2.x), the state shape grows to maybe one or two more flags. `useState` plus, eventually, `useOptimistic` (Story 2.1+) is sufficient. Redux / Zustand / Jotai / Recoil / MobX exist to solve "deeply nested components share state across many screens" — none of which applies. Architecture §5.3 specifically lists this as forbidden ("if any of these appears... it is a discipline-thesis violation").

### Why no data-fetching library (TanStack Query / SWR)

[Source: architecture.md#3.1 ("Data fetching: native fetch wrapped in a 4-function api.ts"), architecture.md#5.3]

TanStack Query and SWR shine when there is request deduplication, background revalidation, retry policy, cache invalidation across components, and infinite scrolling to manage. Phase 0 has: ONE list, fetched ONCE on mount, refetched after each mutation in Stories 2.x. The 4-function `api.ts` (`fetchTasks`, `createTask`, `toggleTask`, `deleteTask`) handles this. Adding a query library is "16 KB of clever for code that already works in 12 lines."

### Why no CSS framework (Tailwind / MUI / Chakra / shadcn)

[Source: architecture.md#3.1, architecture.md#5.3]

The architecture locks "vanilla CSS in a single `App.css`" as the styling strategy. Tailwind/MUI/etc. are productivity multipliers for design systems with dozens of components — Phase 0 has `<main>`, `<h1>`, `<ul>`, `<li>`, `<p>`, and (later) one `<button>`, one `<input>`. Total CSS at the end of Phase 0 will be under 100 lines. Tailwind would ship ~10 KB minified just for the runtime; MUI ships hundreds of KB.

### Why no test framework

[Source: architecture.md#3.5, architecture.md#5.3]

Same reasoning as Story 1.3: Phase 0 has zero unit / integration tests by deliberate design. The single E2E (Playwright "create → reload → assert visible") arrives in Story 3.2. Adding Vitest / Jest / Mocha / `@testing-library/react` here would (a) ship dependencies, (b) require a stub test, (c) require a CI-or-not decision. The AC #16 verification — `npm run build` clean plus a runtime browser smoke against the running API — is the actual quality gate for this story.

### Runtime verification recipe (AC #16, Step B)

This recipe assumes Docker is available on the host. It builds on Story 1.3's "Runtime verification recipe" by adding the frontend dev-server step.

```bash
# Shell 1: ephemeral Postgres + API.
docker run --rm \
  -v "$PWD/db:/docker-entrypoint-initdb.d:ro" \
  -e POSTGRES_PASSWORD=verify \
  -e POSTGRES_DB=tasky_smoke \
  -p 5432:5432 \
  --health-cmd 'pg_isready -U postgres -d tasky_smoke' \
  --health-interval 1s \
  --health-timeout 1s \
  --health-retries 30 \
  --name tasky_web_smoke \
  -d postgres:17-alpine

until [ "$(docker inspect -f '{{.State.Health.Status}}' tasky_web_smoke)" = "healthy" ]; do sleep 1; done

cd api
DATABASE_URL='postgres://postgres:verify@127.0.0.1:5432/tasky_smoke' npm run dev &
API_PID=$!
sleep 2
curl -s http://localhost:3000/api/tasks   # Expect: []

# Shell 2: Vite dev server.
cd web
npm run dev
# Open the printed URL (default http://localhost:5173) in a browser.
# Assert: tab title "Tasky", H1 "Tasky", placeholder "No tasks", network shows
# GET /api/tasks -> 200 [], zero console errors.

# Shell 1 again: insert a row, hard-reload the browser tab.
docker exec -i tasky_web_smoke psql -U postgres -d tasky_smoke \
  -c "INSERT INTO tasks (description) VALUES ('smoke');"
# Browser hard-reload (Cmd+Shift+R / Ctrl+Shift+R).
# Assert: page now shows <ul><li>smoke</li></ul>, network shows GET /api/tasks
# -> 200 [{"id":1,"description":"smoke",...}], zero console errors.

# Tear down.
# Ctrl+C the Vite dev server (shell 2).
# Ctrl+C the API dev server (shell 1) — confirm "SIGINT received" log line.
kill -TERM "$API_PID" 2>/dev/null
docker stop tasky_web_smoke
```

Capture: the build output (Task 8), the two `GET /api/tasks` response bodies, and the rendered page text for both states into Debug Log References.

### Pre-existing repo state to be aware of

[Source: filesystem inspection at story creation time, 2026-04-29]

- **Story 1.1 already shipped the Vite scaffold.** `web/src/{main.tsx, App.tsx, App.css, index.css, vite-env.d.ts, assets/}`, `web/index.html`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.app.json`, `web/tsconfig.node.json`, `web/eslint.config.js`, `web/package.json`, `web/package-lock.json`, `web/public/{favicon.svg, icons.svg}` all exist.
- **`web/src/App.tsx` is the Vite-template demo** (122 lines: counter button, hero image, React/Vite logos, Documentation/Connect-with-us sections, external links to vite.dev / react.dev / GitHub / Discord / X.com / Bluesky). It is replaced WHOLESALE by Task 2.
- **`web/src/App.css` is 184 lines of demo styling** (`.counter`, `.hero`, `#center`, `#next-steps`, `#docs`, `#social`, `#spacer`, `.ticks`, etc.). Replaced wholesale by Task 3.
- **`web/src/index.css` is 111 lines of demo `:root` theming** (purple `--accent`, fixed `1126px` `#root` width, dark-mode overrides for `#social .button-icon`, `code` styling). Trimmed to 11-ish lines by Task 4.
- **`web/src/main.tsx` is correct as-is** — `createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)` plus `import './index.css'`. Untouched by this story.
- **`web/src/api.ts` does NOT exist.** Created from scratch by Task 1. (Architecture §5.1 lists `web/src/api.ts` as a locked file; this story creates it.)
- **`web/index.html` `<title>` is `web`** (the Vite default). Changed to `Tasky` by Task 6.
- **`web/vite.config.ts` is 7 lines** with no `server` block. Task 5 adds the dev-server proxy.
- **`web/src/assets/` contains `react.svg`, `vite.svg`, `hero.png`** (Vite-demo assets). Left in place but unreferenced (AC #13).
- **`web/public/icons.svg`** is the Vite-demo icon sprite (referenced by the OLD `App.tsx` via `<use href="/icons.svg#documentation-icon">`, etc.). Left in place but unreferenced after this story.
- **`web/public/favicon.svg`** is generic and is referenced by `index.html`. Untouched.
- **`web/package.json` deps:** `react ^19.2.5`, `react-dom ^19.2.5`, plus dev deps for ESLint, TypeScript, Vite, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@types/node`. All sufficient for Story 1.4 — no new packages needed.
- **`web/tsconfig.app.json`** has `strict`, `verbatimModuleSyntax: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`, `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`. Untouched by this story (the new code MUST satisfy these flags as-is — see AC #14).
- **The API process from Story 1.3 binds `0.0.0.0:3000`** by default and exposes `GET /api/tasks` returning a JSON array. The Vite dev-server proxy in this story routes `/api/*` to that.
- **No Caddy / Compose yet.** Story 1.5 lands the production same-origin topology; until then, the Vite proxy is the ONLY mechanism for the relative `/api/*` URL to reach the API in dev.
- **A stray top-level `/Users/gio/Source/bmad-test/package.json` exists.** Same precedent as Story 1.3: out of scope, do not touch.
- **`api/dist/` may exist** as a leftover from Story 1.3's runtime verification step. It is gitignored. Do not touch.
- **The git working tree may not be clean before this story starts.** Begin by inspecting `git status` and noting any pre-existing modifications that are not yours to touch.

### What this story does NOT touch

These belong to specific later stories — touching them is scope creep:

- **`web/package.json`** — no new deps in Story 1.4 (AC #12). Future stories may add: nothing in 2.x (mutations also use native `fetch`); Playwright lands as a top-level dep in Story 3.2.
- **`web/tsconfig.app.json`, `web/tsconfig.node.json`, `web/tsconfig.json`** — strictness flags stay as Story 1.1 set them (AC #14).
- **`web/eslint.config.js`** — no lint-rule changes; the new code must satisfy the existing config.
- **`web/src/main.tsx`** — left untouched (AC #11).
- **`web/src/assets/{react.svg, vite.svg, hero.png}`, `web/public/icons.svg`** — left in place but unreferenced (AC #13).
- **`api/`** — read-only context; the `Task` shape on the wire and the `GET /api/tasks` route are inputs to this story (already shipped by Story 1.3).
- **`db/`** — untouched.
- **`README.md`** — explicitly NOT modified by this story (AC #15). The frontend's README presence lands with Story 3.3.
- **`Caddyfile`, `docker-compose.yml`, `web/Dockerfile`, `api/Dockerfile`** — Story 1.5.
- **POST / PATCH / DELETE in `api.ts`, the input field, the toggle checkbox, the delete button, optimistic updates, the error toast region** — Stories 2.1 / 2.2 / 2.3 / 2.4 / 2.5.
- **The designed empty state (illustration, helper copy)** — Story 3.1.
- **Bespoke favicon, OpenGraph tags, theme-color, page typography polish** — Story 3.1 / Story 3.3.
- **The single Playwright E2E** — Story 3.2.
- **`.env.example`** — no frontend env vars in Phase 0 (no `VITE_API_URL` per AC #8).

### Anti-patterns to avoid (common LLM mistakes)

- ❌ Do **not** add `axios`, `ky`, `wretch`, `superagent`, or any other HTTP library. Native `fetch` is the architectural decision (Architecture §3.1).
- ❌ Do **not** add `@tanstack/react-query`, `swr`, or any data-fetching library. The 4-function `api.ts` is the locked contract.
- ❌ Do **not** add `react-router`, `react-router-dom`, `wouter`, or `@tanstack/react-router`. Single-screen app (Architecture §3.1, §5.3).
- ❌ Do **not** add Redux, `@reduxjs/toolkit`, `zustand`, `jotai`, `recoil`, or `mobx`. `useState` is sufficient (Architecture §3.1, §5.3).
- ❌ Do **not** add Tailwind, MUI, Chakra UI, shadcn/ui, Radix, Mantine, or `daisyui`. Vanilla CSS in `App.css` (Architecture §3.1, §5.3).
- ❌ Do **not** add `clsx`, `class-variance-authority`, `tailwind-merge`. No utility CSS, no need.
- ❌ Do **not** add `framer-motion`, `react-spring`, `auto-animate`. No animations in this story.
- ❌ Do **not** add `react-icons`, `lucide-react`, `@heroicons/react`. No icons in this story.
- ❌ Do **not** add `vitest`, `jest`, `@testing-library/react`, `playwright`, `cypress`. No tests in Phase 0 (Architecture §3.5, §5.3).
- ❌ Do **not** call `fetch('http://localhost:3000/api/tasks')` or any absolute URL. Relative `/api/*` only (AC #8).
- ❌ Do **not** introduce `import.meta.env.VITE_API_URL` or any `API_BASE` constant. Same-origin contract is unconditional (AC #8).
- ❌ Do **not** add `cors` middleware to the API to "make dev easier." Use the Vite proxy (Task 5). Adding CORS would violate Story 1.3 AC #17 (no CORS).
- ❌ Do **not** wrap `App` in a `<BrowserRouter>` or `<QueryClientProvider>` or any other context provider in `main.tsx`. `main.tsx` stays untouched (AC #11).
- ❌ Do **not** make the `useEffect` callback `async`. Wrap async work in a nested `async function load()` and call it (AC #3).
- ❌ Do **not** add a "ran already" `useRef` guard to suppress StrictMode's double-effect. The double-call is intentional and harmless for an idempotent GET (AC #3).
- ❌ Do **not** use array index as the React key (`<li key={index}>`). Use `task.id` (AC #4). Index keys break reconciliation when items are added/removed in Stories 2.x.
- ❌ Do **not** import `react.svg`, `vite.svg`, `hero.png`, or reference `/icons.svg`. The shell is image-free in this story (AC #2, #13).
- ❌ Do **not** add `<a href>` external links, social icons, "Powered by Vite" footers, or any marketing chrome. FR22 (no interruptions, no marketing).
- ❌ Do **not** add a signup form, login button, OAuth provider button, or password input. FR12 (no auth in Phase 0).
- ❌ Do **not** read or write `localStorage`, `sessionStorage`, `document.cookie`, or `IndexedDB`. No client-side persistence in Phase 0 (Architecture §3.1; the DB is the source of truth).
- ❌ Do **not** add `useOptimistic` here. Lands in Story 2.1+ (Architecture §3.1, §4.3).
- ❌ Do **not** add a `<Suspense>` boundary or `use(promise)`. Not needed for this fetch shape; React docs' minimal `useEffect` + state pattern is the intended approach (Architecture §4.3).
- ❌ Do **not** add a CSS reset (`normalize.css`, `modern-normalize`, `the-new-css-reset`). Browser defaults are sufficient at this stage.
- ❌ Do **not** use `outline: none` or `outline: 0` anywhere. Focus rings are an accessibility requirement; later interactive elements depend on them.
- ❌ Do **not** add `<meta name="description">`, OpenGraph tags, Twitter Card meta, theme-color, or web-app manifest in `index.html`. Story 3.1 / 3.3 polish.
- ❌ Do **not** delete `web/src/assets/` files, `web/public/icons.svg`, or `web/public/favicon.svg`. Out of scope (AC #13).
- ❌ Do **not** modify `web/src/main.tsx` (AC #11). StrictMode stays.
- ❌ Do **not** modify `web/package.json` `dependencies` or `devDependencies` (AC #12). Zero `npm install` runs in this story.
- ❌ Do **not** modify `README.md` (AC #15). Frontend README presence is Story 3.3 territory.
- ❌ Do **not** modify any file under `api/` or `db/`. The API contract is an input, not an output, of this story.
- ❌ Do **not** loosen `verbatimModuleSyntax`, `strict`, `noUnusedLocals`, or any other tsconfig flag (AC #14). Fix imports / types instead.
- ❌ Do **not** rewrite `index.html` to a React-template "boilerplate-rich" version (analytics, fonts, CDN links). One title change only (AC #10).

### Naming and style conventions

[Source: architecture.md#4.1]

- **TS/TSX modules:** `kebab-case.ts(x)` for plain modules (`api.ts`); `PascalCase.tsx` is also acceptable for files that export a single React component (`App.tsx` — Story 1.1's scaffold convention). This story preserves that mix.
- **TS types/interfaces:** `PascalCase` (`Task`).
- **TS variables/functions:** `camelCase` (`fetchTasks`, `tasks`, `loading`, `setTasks`, `setLoading`).
- **Component names:** `PascalCase` (`App`).
- **CSS selectors:** lower-case element selectors (`main`, `h1`, `p`, `ul`, `li`); no class names in this story (none needed).
- **JSON keys (consumed):** `camelCase` (`createdAt`) — set by the API at the boundary in `api/src/db.ts`; the frontend trusts this contract.
- **URL paths (consumed):** `kebab-case`, plural resource nouns (`/api/tasks`).

### References

- [Source: epics.md#Story 1.4] — User story, acceptance criteria, scope boundaries (epics.md lines 334–350).
- [Source: epics.md#Story 1.3] — API contract input: `GET /api/tasks` returns `Task[]` JSON, same-origin under `/api/`.
- [Source: prd.md#FR1] — A user can view a list of all their tasks on a single screen (this story scaffolds the list view; full FR1 lands across Stories 1.4 + 2.x).
- [Source: prd.md#FR12] — No authentication / account / onboarding in the UI.
- [Source: prd.md#FR14] — Frontend implemented in React 19 + Vite + TypeScript.
- [Source: prd.md#FR19] — Same-origin `/api/` path prefix.
- [Source: prd.md#FR22] — No signup prompt, tour overlay, welcome modal, or marketing interruption on first load.
- [Source: prd.md#FR40] — `console.log` / `console.error` to stdout/stderr only; no logging library (applies to frontend `console.error(err)` in `App.tsx` catch handler).
- [Source: prd.md#NFR1] — App shell loads and renders the empty state in under one second on typical broadband (the `Loading…` placeholder is the budget signal here).
- [Source: architecture.md#3.1] — Frontend stack: React 19.2, Vite 8.0, TypeScript 5.x, vanilla CSS in single `App.css`, `useState` (and later `useOptimistic`), native `fetch` wrapped in 4-function `api.ts`, no router, no state library, no data-fetching library, no CSS framework.
- [Source: architecture.md#3.4] — Caddy reverse proxy at the edge (Story 1.5); same-origin topology; `/api/*` path prefix mapped to API container.
- [Source: architecture.md#3.5] — No test framework in Phase 0; single Playwright E2E in Story 3.2.
- [Source: architecture.md#4.1] — Naming conventions; snake_case DB → camelCase JSON boundary mapping happens in `api/src/db.ts` (frontend consumes the camelCase shape directly).
- [Source: architecture.md#4.2] — REST + JSON, bare-array collection responses, ISO-8601 UTC dates, JSON-number IDs, no API versioning, `application/json` only.
- [Source: architecture.md#4.3] — Frontend patterns: `App.tsx` re-fetches on mount and after mutations; `Loading…` on initial fetch; single error-toast region added in Story 2.5.
- [Source: architecture.md#4.5] — Co-locate first; inline until it hurts; boundary mapping in one place (server-side, in `db.ts`).
- [Source: architecture.md#5.1] — Repository layout: `web/src/{main.tsx, App.tsx, api.ts, App.css}` is the locked file set for the frontend.
- [Source: architecture.md#5.3] — No tests dir, no migrations dir, no observability dir, no `controllers/` / `services/` / `repositories/`; "if any of these appears in the Phase 0 codebase, it is a discipline-thesis violation."
- [Source: 1-1-repository-scaffold-and-starter-templates.md] — Story 1.1 Dev Agent Record (file list confirms `web/src/{main.tsx, App.tsx, App.css, index.css}`, `web/index.html`, `web/vite.config.ts`, `web/tsconfig*.json`, `web/package.json` all scaffolded).
- [Source: 1-3-minimal-api-with-get-api-tasks-returning-empty-list.md] — Story 1.3 Dev Agent Record (confirms `GET /api/tasks` returns `[]` with `Content-Type: application/json; charset=utf-8` against an empty DB; `Task` shape `{id, description, completed, createdAt}` verified with one row); locked code skeletons for `api/src/db.ts` and `api/src/server.ts` define the `Task` JSON contract this story consumes.
- [Source: 1-3-minimal-api-with-get-api-tasks-returning-empty-list.md#Completion Notes] — Story 1.3 deviation precedent: locked skeletons in story specs may need to be patched against tsconfig strictness; verify by running the build before declaring done. Same-LLM review carries bias risk — call out in Review Findings.

### Project Structure Notes

- The project root is `/Users/gio/Source/bmad-test/`. All paths above are relative to this root.
- After this story, `web/src/` contains exactly five files at the top level: `main.tsx` (untouched), `App.tsx` (replaced), `api.ts` (NEW), `App.css` (replaced), `index.css` (trimmed) — plus `vite-env.d.ts` (untouched, Vite default) and the `assets/` directory (untouched per AC #13). This matches Architecture §5.1's locked file set for the frontend.
- `web/dist/` is generated by `npm run build` (Task 8 verification) and is gitignored (per the project-root `.gitignore`'s bare `dist` rule, same as `api/dist/`). It is the deployment artifact consumed by Caddy in Story 1.5.
- The BMad scaffolding directories (`_bmad/`, `_bmad-output/`, `.agents/`, `docs/`) are unaffected.
- `api/`, `e2e/`, `db/`, `LICENSE`, `.env.example`, `README.md` are unaffected by this story.
- After this story, the frontend can be developed locally by running `npm run dev` from `web/` against an API process running on `localhost:3000`. The full Docker Compose orchestration (with Caddy serving `web/dist/` and proxying `/api/*` to the API container) arrives in Story 1.5.

## Dev Agent Record

### Agent Model Used

claude-opus-4.7 (github-copilot)

### Debug Log References

**Task 8 — `npm run build` output (web/):**

```
> web@0.0.0 build
> tsc -b && vite build

vite v8.0.10 building client environment for production...
✓ 18 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index--qwHxly2.css    0.59 kB │ gzip:  0.35 kB
dist/assets/index-DY0bkENL.js   190.99 kB │ gzip: 60.22 kB
✓ built in 421ms
```

Zero TS errors. `dist/assets/` contains only the hashed JS+CSS bundle — no `react.svg`, `vite.svg`, or `hero.png` (confirms AC #2/#13: demo assets unreferenced).

**Task 9 — Runtime smoke (Step B):**

Ephemeral Postgres started (`postgres:17-alpine`, `tasky_smoke` DB, `db/init.sql` mounted), reached `healthy`. API dev server (`tsx watch src/server.ts`) reported `API listening on port 3000`.

Direct API call before frontend:

```
$ curl -s -i http://localhost:3000/api/tasks
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
[]
```

Vite dev server (`vite v8.0.10`) reached ready in 412 ms on `http://localhost:5173/`. `curl http://localhost:5173/` confirmed served `index.html` contains `<title>Tasky</title>`.

Proxy verification:

```
$ curl -s -i http://localhost:5173/api/tasks
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
[]
```

(Headers `x-powered-by: Express` confirm the proxy forwarded to the API.)

**Empty state (headless Chrome via playwright at http://localhost:5173/):**

- `document.title` = `"Tasky"`
- `<h1>` text = `"Tasky"`
- `document.body.innerText` = `"Tasky\n\nNo tasks"`
- `document.querySelector('ul')` = `null`
- Console: 3 messages, **0 errors, 0 warnings** (only React DevTools info notice)

**Insert + reload:**

```
$ docker exec -i tasky_web_smoke psql -U postgres -d tasky_smoke \
    -c "INSERT INTO tasks (description) VALUES ('smoke');"
INSERT 0 1

$ curl -s http://localhost:5173/api/tasks
[{"id":1,"description":"smoke","completed":false,"createdAt":"2026-04-29T20:23:46.206Z"}]
```

After hard-reload:

- `document.title` = `"Tasky"`
- `<ul>` outerHTML = `"<ul><li>smoke</li></ul>"` ✅
- `document.body.innerText` = `"Tasky\nsmoke"`
- Console: **0 errors** (only React DevTools info notice)

**Tear-down:**

- Vite + API both received SIGINT cleanly; API logged `SIGINT received, shutting down...` (matches Story 1.3 graceful-shutdown contract).
- `docker stop tasky_web_smoke` returned the container name; `lsof :3000 :5173` empty afterward.

### Completion Notes List

- Implemented all 10 tasks per the locked code skeletons character-for-character — `api.ts` (created), `App.tsx` (replaced), `App.css` (replaced), `index.css` (trimmed), `vite.config.ts` (proxy added), `index.html` (title only).
- `npm run build` clean: zero TS errors against `strict` + `verbatimModuleSyntax` + `noUnusedLocals` + `noUnusedParameters` + `erasableSyntaxOnly`. The `import { fetchTasks, type Task } from './api'` form satisfies `verbatimModuleSyntax` (value + type-only co-import).
- Runtime smoke (AC #16 Step B) executed end-to-end against ephemeral Postgres + the Story 1.3 API. Empty state (`No tasks`) and populated state (`<ul><li>smoke</li></ul>`) both verified, with 0 console errors in either state and the Vite proxy correctly forwarding `/api/tasks` to `localhost:3000`. Hard-reload exercised StrictMode's double-effect path on a populated DB without producing duplicate rows or errors.
- AC #11 (main.tsx untouched), AC #12 (no dep changes), AC #13 (demo assets unreferenced but on disk), AC #15 (README untouched) all confirmed via `git diff` and `ls`.
- One known minor: Vite 8.0 emits a deprecation/info warning during build about Node version on certain hosts; not present in this run. Build output preserved above shows no warnings whatsoever.
- No deviations from locked skeletons. No new dependencies added. `web/package.json` and `web/package-lock.json` unchanged.

### File List

- `web/src/api.ts` — **added** (created from scratch per AC #1; locked skeleton)
- `web/src/App.tsx` — **modified** (wholesale replaced; was 122-line Vite demo)
- `web/src/App.css` — **modified** (wholesale replaced; was 184 lines of demo styling)
- `web/src/index.css` — **modified** (trimmed from 111 → 13 lines; demo theming removed)
- `web/vite.config.ts` — **modified** (added `server.proxy['/api']` → `http://localhost:3000`)
- `web/index.html` — **modified** (single-line `<title>` change `web` → `Tasky`)

## Change Log

| Date       | Version | Change                                                                                                                                                                  | Author |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-29 | 0.1     | Story drafted (ready-for-dev) by create-story workflow. Includes locked code skeletons for `api.ts`, `App.tsx`, `App.css`, `index.css`, `vite.config.ts`, anti-patterns list, runtime verification recipe, and references with `[Source: ...]` citations. | PM     |
| 2026-04-29 | 0.2     | Implementation complete. All 10 tasks executed; `npm run build` clean; AC #16 Step B runtime smoke verified end-to-end (empty + populated states, 0 console errors). Status → review. | Dev    |
