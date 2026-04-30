# Story 3.4: Optimistic UI with server reconciliation (Nice-to-ship — first to cut)

Status: ready-for-dev

## Story

As any individual using the app,
I want create/toggle/delete actions to render instantly before the server confirms,
So that the app feels lightweight in actual reach-for-it moments and the perceived latency does not exceed what an `Apple Reminders`-tier app provides.

## Acceptance Criteria

**Given** the working CRUD from Epic 2 and the polished UI from Stories 3.1–3.2
**When** I refactor `web/src/App.tsx` to use React 19's `useOptimistic` hook on all three mutation paths (create, toggle, delete)
**Then** clicking Add applies the new task to the visible list within one frame (~16ms) before the `POST /api/tasks` response arrives — covers FR27, NFR2
**And** clicking a checkbox flips the visible completion state within one frame before the `PATCH` response arrives — covers FR27, NFR2
**And** clicking Delete removes the task from the visible list within one frame before the `DELETE` response arrives — covers FR27, NFR2
**And** when the server response confirms the action, the optimistic state is reconciled with the server-truth without visible flicker
**And** when the server response is an error (4xx or 5xx) or a network failure, the optimistic change is automatically reverted and the inline error region from Story 2.5 displays the failure — covers FR29 + Architecture §4.3 reconciliation pattern
**And** when optimistic UI is unavailable for a specific action (or this entire story is cut), in-flight create actions surface a skeleton placeholder row within ~150ms — covers FR28, NFR3 — the skeleton row implementation is included regardless of optimistic UI as the documented fallback
**And** no per-row spinners or loading indicators appear on individual task rows during mutations (Architecture §4.3)
**And** the implementation uses native `useOptimistic` only — no TanStack Query, no SWR, no other data-fetching library is added (Architecture §3.1)

**Cut criteria:** This story is the first to cut per the brutal cut order. Cut if any prior story (1.1–3.3) ran more than ~1 hour over its budget OR if total elapsed time at the start of 3.4 exceeds the day's deploy window. When cut: the app falls back to the plain request/response behavior from Epic 2 plus the ~150ms skeleton placeholder for create actions (still implemented as the documented fallback per AC above), and the cut is documented as a deliberate Phase 0 trade-off in the README's "Acknowledged Phase 0 gaps" section.

## Dev Notes

### Architectural alignment & locked decisions

1. **`web/src/App.tsx` is REFACTORED — the existing structure (post-Story 2.5) is preserved in its scaffolding (mount effect, `description`/`error` state, error toast, three render branches) but the THREE mutation handlers (`handleSubmit`, `handleToggle`, `handleDelete`) are restructured to use React 19's `useOptimistic` hook.** The shape of the refactor: a NEW `optimisticTasks` derived state via `useOptimistic(tasks, reducer)` becomes the single source of truth for what the JSX renders. The three handlers each: (a) compute the optimistic state delta and call the dispatch returned by `useOptimistic`, (b) `await` the API call, (c) on success, call `setTasks(...)` with the server-returned state (the optimistic state is automatically discarded by React's transition), (d) on error, do NOT call `setTasks` (the optimistic state automatically reverts when the transition ends), and call `showError(err)` to surface the failure via the existing toast. [Source: web/src/App.tsx (post-2.5 state), React 19 docs (useOptimistic), architecture.md#4.3]

2. **`useOptimistic` MUST be imported from `'react'`** (NOT from `'react-dom'`, NOT from `'react/experimental'` — it's stable in React 19.0+). Add to the existing import: `import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';`. The `useTransition` import is REQUIRED because `useOptimistic`'s dispatch ONLY operates inside a transition (React throws an error if called outside one); the handler bodies MUST wrap the optimistic dispatch + API call inside `startTransition(async () => { ... })`. [Source: React 19 docs — `useOptimistic` requires Action context (transition or form action)]

3. **The `useOptimistic` reducer signature** is `(currentState: Task[], action: OptimisticAction): Task[]` where `OptimisticAction` is a discriminated union of three variants:
    - `{ type: 'add'; task: Task }` — append (for create)
    - `{ type: 'toggle'; id: number }` — flip `completed` for the matching task (for toggle)
    - `{ type: 'remove'; id: number }` — filter out the matching task (for delete)

    The reducer is defined as a TOP-LEVEL function (NOT inside the component) named `applyOptimistic`. Its body uses a switch on `action.type`, returning the new state array per variant. This matches the React 19 idiom and keeps the reducer pure (no closures over component state). The discriminated-union type is defined at module top-level above `App`.

    [Source: React 19 docs (useOptimistic reducer pattern), TypeScript discriminated unions]

4. **The OPTIMISTIC TASK created during `handleSubmit` MUST have a TEMPORARY id.** Because the server-assigned `id` is not yet known, the optimistic task uses a sentinel id value. The locked sentinel: a NEGATIVE integer derived from `-Date.now()` (e.g., `-1716998400000`). Negative ids are guaranteed not to collide with the server's `BIGSERIAL` (which is always positive). The sentinel id is used ONLY for the optimistic render (so the `<li key={task.id}>` has a unique key) and is REPLACED when the server returns the real task. The `Task` type's `id` field stays `number`; no type widening to `number | string` (which would force Task consumers to handle both). The `createdAt` field of the optimistic task uses `new Date().toISOString()` (close enough to the eventual server value; the server will overwrite). The `completed` field is `false`. [Source: React 19 useOptimistic patterns, db/init.sql (BIGSERIAL is positive)]

5. **The optimistic task is DROPPED automatically by React when the transition ends** — the dev MUST NOT manually call any "remove the optimistic task" logic. The flow:
    - Inside the transition, `addOptimisticTask({ type: 'add', task: optimisticTask })` mutates the optimistic state immediately (visible to JSX in the same frame).
    - `await createTask(trimmed)` does the network round-trip.
    - On success, `setTasks((prev) => [...prev, serverTask])` updates the REAL state. When the transition ends, React diffs `optimisticTasks` against the real state — the optimistic task with the negative id is replaced by the server task. NO flicker because both renders happen in the same commit cycle.
    - On error (the catch branch), DO NOT call `setTasks`. When the transition ends, React reverts `optimisticTasks` to match `tasks` — the optimistic task disappears from the list. The error toast (via `showError(err)`) communicates the failure.

    This automatic-revert behavior is the key value proposition of `useOptimistic`. The dev MUST NOT re-implement revert logic manually (e.g., maintaining a separate "optimistic" array, manually filtering on error). Trust the hook. [Source: React 19 docs — automatic optimistic state lifecycle]

6. **The full refactored `handleSubmit` shape** (locked):

    ```typescript
    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
      event.preventDefault();
      const trimmed = description.trim();
      if (trimmed.length === 0) return;

      const optimisticTask: Task = {
        id: -Date.now(),
        description: trimmed,
        completed: false,
        createdAt: new Date().toISOString(),
      };

      setDescription('');
      inputRef.current?.focus();

      startTransition(async () => {
        addOptimisticTask({ type: 'add', task: optimisticTask });
        try {
          const serverTask = await createTask(trimmed);
          setTasks((prev) => [...prev, serverTask]);
        } catch (err) {
          console.error(err);
          showError(err);
        }
      });
    }
    ```

    Notes on the order: (a) `event.preventDefault()` and validation FIRST — outside the transition so the silent-ignore returns immediately; (b) `setDescription('')` and re-focus OUTSIDE the transition — the input clearing is non-optimistic (it commits regardless of API outcome; preserving the input on error per Story 2.2 AC #6.h would conflict with optimistic-UX intent here, so this story's locked behavior is to clear immediately and rely on the toast to communicate the failure); (c) inside the transition, dispatch the optimistic add FIRST, then `await` the API, then on success update real state. [Source: React 19 patterns, Story 2.2's `handleSubmit` shape adapted]

7. **The full refactored `handleToggle` shape** (locked):

    ```typescript
    async function handleToggle(id: number, nextCompleted: boolean): Promise<void> {
      startTransition(async () => {
        addOptimisticTask({ type: 'toggle', id });
        try {
          const updated = await toggleTask(id, nextCompleted);
          setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        } catch (err) {
          console.error(err);
          showError(err);
        }
      });
    }
    ```

    Note: the toggle reducer flips `completed` for the matched id by computing `!t.completed` — it does NOT use the `nextCompleted` arg. Rationale: this keeps the reducer's action payload minimal (`{ type: 'toggle'; id }` — no need for a `nextCompleted` field) and matches the natural semantic ("user clicked the checkbox; flip it"). [Source: React 19 patterns, Story 2.3's `handleToggle` shape adapted]

8. **The full refactored `handleDelete` shape** (locked):

    ```typescript
    async function handleDelete(id: number): Promise<void> {
      startTransition(async () => {
        addOptimisticTask({ type: 'remove', id });
        try {
          await deleteTask(id);
          setTasks((prev) => prev.filter((t) => t.id !== id));
        } catch (err) {
          console.error(err);
          showError(err);
        }
      });
    }
    ```

    [Source: React 19 patterns, Story 2.4's `handleDelete` shape adapted]

9. **The JSX `tasks.map(...)` rendering MUST be changed to `optimisticTasks.map(...)`.** This is the SINGLE point of integration with the JSX layer — the entire visible list is driven by the optimistic state, NOT the real state. The same applies to `tasks.length === 0` checks (the empty-state branch becomes `optimisticTasks.length === 0`). The `loading` state and the empty-state branch from Story 3.1 work UNCHANGED — they read from `optimisticTasks` instead of `tasks`. [Source: React 19 docs (useOptimistic — derived state for render)]

10. **The `useOptimistic` hook call** is placed INSIDE the `App` component, AFTER `const [tasks, setTasks] = useState<Task[]>([])` and BEFORE the handlers. Exact line:

    ```typescript
    const [optimisticTasks, addOptimisticTask] = useOptimistic<Task[], OptimisticAction>(
      tasks,
      applyOptimistic,
    );
    ```

    The explicit type parameters `<Task[], OptimisticAction>` are REQUIRED because TypeScript cannot reliably infer the action type from the reducer signature alone in React 19's current type definitions. Omitting them risks `unknown` inference for the action parameter. [Source: React 19 type definitions (`@types/react` v19)]

11. **The `useTransition` hook call** is placed alongside `useOptimistic`:

    ```typescript
    const [isPending, startTransition] = useTransition();
    ```

    The `isPending` value MAY be unused by JSX in this story (the optimistic state IS the loading indicator — see AC #7 / Dev Note #14). If TypeScript's `noUnusedLocals` complains about `isPending`, prefix it with `_` (`const [_isPending, startTransition] = useTransition()`) per existing project convention. NO use of `isPending` to disable buttons (per AC #7 / Dev Note #14). [Source: React 19 docs (useTransition)]

12. **The `parseError` helper in `web/src/api.ts` is NOT modified by this story.** All three API helper functions (`createTask`, `toggleTask`, `deleteTask`) keep their existing signatures and behavior — they throw verb-prefixed `Error` instances on failure (the format `${VERB} /api/tasks${path} failed: ${parseError(response)}` from Stories 2.2/2.3/2.4/2.5). The optimistic refactor does NOT change the API contract; it only reorganizes how the React component consumes API responses. [Source: web/src/api.ts (post-2.4 state), Story 2.5]

13. **The error toast from Story 2.5 works UNCHANGED** — the catch blocks call `showError(err)` (existing helper) which sets the `error` state and starts the auto-dismiss timer. The toast renders above the form per Story 2.5's locked DOM. The interaction with optimistic UI: when an action fails, two things happen in quick succession — (a) the optimistic state reverts (the task disappears, the checkbox unflips, the deleted task reappears) within the same React commit, (b) the toast appears with the error message. The user sees the visual revert AND reads why. [Source: Story 2.5, React 19 useOptimistic + transition lifecycle]

14. **NO per-row spinners, NO per-row loading indicators, NO disabled controls during in-flight mutations** (AC #7, Architecture §4.3). The optimistic state IS the UI feedback. Specifically: do NOT add a `pending` state per task, do NOT show a `<span class="spinner">` next to the optimistically-added task, do NOT set `disabled` on the checkbox or Delete button while their PATCH/DELETE is in flight. The optimistic state's instant change is the entire user-facing acknowledgement; the next event (success → reconcile, failure → revert + toast) closes the loop. [Source: AC #7, architecture.md#4.3]

15. **The skeleton-row fallback (AC #6, NFR3) is the DOCUMENTED FALLBACK that ships REGARDLESS of whether `useOptimistic` is implemented in this story.** The AC text is explicit: "the skeleton row implementation is included regardless of optimistic UI as the documented fallback". The implementation pattern is: when `handleSubmit` is in flight (i.e., between Enter press and either success or failure), AND no optimistic UI is showing the new task yet, AND ~150ms has elapsed since submit, AND the API call has not yet returned, render a skeleton `<li>` placeholder.

    HOWEVER — when `useOptimistic` IS implemented (this story's primary goal), the optimistic task is rendered IMMEDIATELY (within ~16ms), so the 150ms skeleton timer NEVER fires (the optimistic task is already visible by the 150ms mark). The skeleton-row code path is DEAD code under normal optimistic operation but exists as the fallback for the documented cut scenario.

    The locked implementation: a `useState<boolean>` flag `showSkeleton` that defaults to `false`, set to `true` after a 150ms `setTimeout` started inside `handleSubmit` BEFORE the optimistic dispatch, and cleared after the API call resolves. The JSX renders a `<li className="skeleton">…</li>` when `showSkeleton === true`. (See "Locked code skeleton" section for exact code.) [Source: AC #6, NFR3, FR28, epics.md#Story 3.4 cut criteria]

16. **The skeleton row CSS** is appended to `web/src/App.css`:

    ```css
    .skeleton {
      min-height: 44px;
      background: linear-gradient(90deg, #f0eef2 0%, #e8e4eb 50%, #f0eef2 100%);
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.5s ease-in-out infinite;
      border-radius: 4px;
    }

    @keyframes skeleton-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    ```

    The colors are in the same muted-grey family as Story 3.1's `.empty-state-hint` (`#6b6375`) and Story 2.2's input border (`#d0c9d6`). The shimmer is a subtle 1.5s loop — visible enough to indicate "in progress" without being distracting. The `min-height: 44px` matches the Story 3.2 row height so the layout doesn't jump when the skeleton resolves to a real task.

    NOTE: the shimmer animation IS an exception to Story 3.2 AC #21 / Story 3.1's "no animations" constraint. The justification: the skeleton row is by definition a loading indicator and a static skeleton would be indistinguishable from a real-but-empty row. The animation is short (1.5s loop), respects user motion preferences if a future Phase 1 story adds `prefers-reduced-motion: reduce` rules (this story does NOT add such rules — out of scope), and only renders during the rare 150ms+ create-in-flight window when optimistic UI is unavailable. [Source: AC #6, web/src/App.css (Story 3.1/3.2 conventions)]

17. **NO `useReducer` to replace `useState` for tasks.** The reducer pattern lives INSIDE `useOptimistic`'s reducer; the canonical `tasks` state remains a `useState<Task[]>`. Adding a separate `useReducer` for `tasks` would double the state-management surface for zero benefit. [Source: architecture.md#5.3, scope discipline]

18. **NO `useFormStatus` hook.** The form's pending status is implicit in the optimistic state (the optimistic task is visible). Adding `useFormStatus` would require restructuring the form into a Server Component / Action pattern, which is out of scope (this is a Vite SPA, not a Next.js app). [Source: scope, architecture.md#3.1]

19. **NO Server Actions, NO `<form action={...}>` with a function action.** This is a Vite + Express SPA — Server Actions are a Next.js / RSC feature. The form continues to use `onSubmit` per Story 2.2's locked pattern. [Source: architecture.md#3.1]

20. **NO TanStack Query, NO SWR, NO Apollo, NO RTK Query, NO Zustand, NO Jotai.** AC #8 is explicit: "no other data-fetching library is added". The `useOptimistic` hook from React 19 is the entire mechanism. The `useState`/`useEffect` patterns from Story 1.4 remain the data lifecycle. [Source: AC #8, architecture.md#3.1]

21. **NO API contract changes.** `api/src/db.ts`, `api/src/server.ts`, `db/init.sql` are NOT modified. The frontend optimistic refactor consumes the existing API as-is. [Source: scope discipline]

22. **NO `web/src/api.ts` changes.** The three mutation helpers + `parseError` are byte-identical to their post-Story 2.4/2.5 state. [Source: scope discipline]

23. **The mount-time `fetchTasks` effect from Story 1.4 is UNCHANGED.** The `loading` state, the initial `tasks = []`, the `try`/`catch` around the initial fetch — all preserved. The `optimisticTasks` derived state will mirror `tasks` after mount completes (`useOptimistic` returns the underlying state when no transition is active). [Source: web/src/App.tsx (post-2.5 state), Story 1.4]

24. **The error toast region from Story 2.5 is UNCHANGED in its DOM placement and CSS.** The `<p role="alert">` between `<h1>` and `<form>` is preserved. Only the catch blocks of the three handlers change (now wrapped inside the `startTransition` block). [Source: Story 2.5]

25. **The empty-state region from Story 3.1 is UNCHANGED in its DOM and CSS** — only the conditional check is updated to read `optimisticTasks.length === 0` instead of `tasks.length === 0`. This means: while a delete is in-flight on the LAST task, the optimistic state shows zero tasks and the empty-state renders for ~50-300ms; if the delete fails, the optimistic state reverts (the task reappears) and the empty-state disappears. Acceptable UX — instant feedback with self-correction on failure. [Source: Story 3.1, AC #7 (no flicker on success path)]

26. **The skeleton-row CSS class is `.skeleton`** — single-word class, lowercase, no BEM. Placed in `App.css` after the `.empty-state*` and `.error-toast*` blocks (or after the Story 3.2 form/button rules — the dev's choice; just at the end of the file). [Source: Story 3.1/3.2 CSS conventions]

27. **NO new files in `web/src/`, `api/`, `e2e/`, `db/`, or the project root.** This story's complete file-change set is exactly: `web/src/App.tsx` (modified — refactor handlers + add useOptimistic + add skeleton state), `web/src/App.css` (modified — append `.skeleton` rule + `@keyframes`). Two files. Specifically, do NOT create `web/src/hooks/useOptimisticTasks.ts`, do NOT create `web/src/components/SkeletonRow.tsx`, do NOT create `web/src/state/`. [Source: architecture.md#5.1, architecture.md#5.3]

28. **NO new dependencies.** Same forbidden list as prior stories — no `@tanstack/react-query`, no `swr`, no `zustand`, no `jotai`, no `valtio`, no `recoil`, no `xstate`. The deps list MUST stay byte-identical; `git diff web/package.json web/package-lock.json` MUST produce empty output. [Source: AC #8, architecture.md#5.3]

29. **TypeScript edge cases the dev MUST handle:**
    - The `OptimisticAction` discriminated union MUST be exported (for the reducer's type) OR defined adjacent to the reducer (TS scoping). The locked decision: define both `OptimisticAction` and `applyOptimistic` at module top-level, ABOVE the `App` function. They are NOT exported (internal to App.tsx).
    - The `useOptimistic<Task[], OptimisticAction>` explicit type parameters are REQUIRED (Dev Note #10).
    - The `useTransition` returns `[boolean, (callback: () => void | Promise<void>) => void]`. The callback CAN be async (React 19 supports async transitions); TypeScript will not complain about the `async` keyword.
    - `addOptimisticTask({ type: 'add', task: optimisticTask })` — TS will narrow the `task` property only when `type === 'add'`; the discriminated union ensures type safety.
    - `verbatimModuleSyntax: true` (per Story 1.4's locked tsconfig) requires `import { type Foo }` for type-only imports — but value-imports of hooks (`useOptimistic`, `useTransition`) are bare. Mixed example: `import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';` (all hooks are value imports). Existing `import { type Task } from './api'` stays as-is.
    - `noUnusedLocals: true` will flag `isPending` if unused — prefix with `_` per Dev Note #11.

30. **The dev MUST verify the React version is 19.0+ in `web/package.json`.** Story 1.4 locked `react ^19.2` — confirm at story-start. If a prior story or dependabot PR has downgraded React to 18.x, the `useOptimistic` and `useTransition` (with async callbacks) will not work. If downgraded: REVERT the version bump or open a separate PR to restore React 19; do NOT proceed with this story until React 19 is confirmed. [Source: web/package.json (Story 1.4 locked deps)]

31. **The dev MUST verify the change visually in a real browser** before marking the story `done`: load `http://localhost` (or the deployed URL), perform each of the three mutation paths under both fast (localhost) and artificially-slow (devtools throttled "Slow 3G") network conditions. Recipe in the "Verification recipe" section below. [Source: prd.md#NFR2, AC #1/2/3/4/5]

32. **NO behavior regression in the cut path.** If this story is CUT, the dev MUST still implement the skeleton-row fallback (per AC #6 explicit text). Concretely: if the day's deploy window forces a cut, the dev edits `App.tsx` to ADD the skeleton-row state + JSX + 150ms timer (Dev Note #15) but DOES NOT add `useOptimistic`/`useTransition`. The `App.tsx` falls back to the request-then-update pattern from Story 2.2/2.3/2.4 plus the skeleton row. The README's "Acknowledged Phase 0 gaps" section (Story 3.3) gets the no-optimistic-UI bullet (Story 3.3 Dev Note #16). [Source: AC #6 explicit text, epics.md#Story 3.4 cut criteria]

33. **NO `useEffect` for optimistic state synchronization.** The `useOptimistic` hook is self-managing; do NOT add a `useEffect(() => { setOptimisticTasks(tasks); }, [tasks])` or any similar sync pattern. React handles the reconciliation when the transition ends. Adding a manual sync would create an infinite loop or break the optimistic-revert-on-error behavior. [Source: React 19 docs]

34. **NO custom comparison function for the `useOptimistic` reducer's identity check.** React's default reference equality is sufficient — the reducer returns NEW arrays (via `[...prev, task]`, `prev.map(...)`, `prev.filter(...)`), which React detects as state changes. [Source: React 19 docs]

35. **The dev MUST NOT use `flushSync`.** The optimistic state update is intended to render in the same frame; React 19's transition behavior already prioritizes optimistic updates as urgent. `flushSync` would force synchronous DOM updates, defeating React's batching and potentially causing layout thrash. [Source: React 19 docs — useOptimistic + transition automatic urgency]

36. **The dev MUST NOT handle the case where the user submits a second task while the first is in-flight.** React 19's transitions support concurrent dispatches: each `addOptimisticTask({ type: 'add', task })` accumulates into the optimistic state. Two rapid creates show two optimistic tasks; both reconcile when their respective API calls return. The dev does NOT need to add explicit queue management. [Source: React 19 concurrent transitions]

37. **NO `react-error-boundary` or error-boundary wrapping.** The catch blocks inside each handler catch all errors; uncaught errors from React itself (rare, e.g., a render-time exception) would bubble to React's default behavior. Adding an error boundary is out of scope. [Source: scope discipline]

38. **The skeleton row's React `key`** uses a stable string `'skeleton-create'` (since there's only one skeleton at a time). Using `Math.random()` or `Date.now()` as the key would cause React to remount the skeleton DOM on every render, killing the shimmer animation. The locked key is `key="skeleton-create"`. [Source: React key conventions]

### Locked code skeleton — `web/src/App.tsx` (full refactored file)

The dev MUST produce code structurally equivalent to the following. The Story 1.4 mount effect, Story 2.2 `description` state and `inputRef`, Story 2.3 toggle JSX, Story 2.4 Delete button, Story 2.5 error toast + `showError` helper, Story 3.1 empty-state JSX, Story 3.2 CSS classes — ALL preserved character-for-character; the additions are: imports update, `OptimisticAction` type + `applyOptimistic` reducer (top-level), `useOptimistic` + `useTransition` hook calls inside `App`, refactored `handleSubmit`/`handleToggle`/`handleDelete`, skeleton row state + JSX, `tasks` → `optimisticTasks` in the render branches.

```typescript
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { createTask, deleteTask, fetchTasks, toggleTask, type Task } from './api';
import './App.css';

type OptimisticAction =
  | { type: 'add'; task: Task }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number };

function applyOptimistic(currentTasks: Task[], action: OptimisticAction): Task[] {
  switch (action.type) {
    case 'add':
      return [...currentTasks, action.task];
    case 'toggle':
      return currentTasks.map((t) =>
        t.id === action.id ? { ...t, completed: !t.completed } : t,
      );
    case 'remove':
      return currentTasks.filter((t) => t.id !== action.id);
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | null>(null);
  const skeletonTimerRef = useRef<number | null>(null);

  const [optimisticTasks, addOptimisticTask] = useOptimistic<Task[], OptimisticAction>(
    tasks,
    applyOptimistic,
  );

  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchTasks();
        setTasks(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
      }
      if (skeletonTimerRef.current !== null) {
        window.clearTimeout(skeletonTimerRef.current);
      }
    };
  }, []);

  function showError(messageOrErr: string | unknown): void {
    const message =
      typeof messageOrErr === 'string'
        ? messageOrErr
        : messageOrErr instanceof Error && messageOrErr.message.includes(' failed: ')
          ? messageOrErr.message
          : 'Something went wrong';
    setError(message);
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 3000);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = description.trim();
    if (trimmed.length === 0) return;

    const optimisticTask: Task = {
      id: -Date.now(),
      description: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setDescription('');
    inputRef.current?.focus();

    // Skeleton-row fallback timer — fires only if useOptimistic is somehow
    // unavailable AND the API call takes > 150ms. Under normal optimistic
    // operation, the optimistic task renders within ~16ms and this timer's
    // setShowSkeleton(true) is a visual no-op (the skeleton would render
    // alongside the already-visible optimistic task).
    skeletonTimerRef.current = window.setTimeout(() => {
      setShowSkeleton(true);
    }, 150);

    startTransition(async () => {
      addOptimisticTask({ type: 'add', task: optimisticTask });
      try {
        const serverTask = await createTask(trimmed);
        setTasks((prev) => [...prev, serverTask]);
      } catch (err) {
        console.error(err);
        showError(err);
      } finally {
        if (skeletonTimerRef.current !== null) {
          window.clearTimeout(skeletonTimerRef.current);
          skeletonTimerRef.current = null;
        }
        setShowSkeleton(false);
      }
    });
  }

  async function handleToggle(id: number, _nextCompleted: boolean): Promise<void> {
    startTransition(async () => {
      addOptimisticTask({ type: 'toggle', id });
      try {
        const updated = await toggleTask(id, _nextCompleted);
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      } catch (err) {
        console.error(err);
        showError(err);
      }
    });
  }

  async function handleDelete(id: number): Promise<void> {
    startTransition(async () => {
      addOptimisticTask({ type: 'remove', id });
      try {
        await deleteTask(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        console.error(err);
        showError(err);
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      setDescription('');
    }
  }

  return (
    <main>
      <h1>Tasky</h1>
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
      ) : optimisticTasks.length === 0 && !showSkeleton ? (
        <div className="empty-state" aria-live="polite">
          <p className="empty-state-primary">Nothing here yet.</p>
          <p className="empty-state-hint">Type a task above and press Enter.</p>
        </div>
      ) : (
        <ul>
          {optimisticTasks.map((task) => (
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
          ))}
          {showSkeleton && <li key="skeleton-create" className="skeleton" />}
        </ul>
      )}
    </main>
  );
}

export default App;
```

### Locked code skeleton — `web/src/App.css` (additions)

APPENDED to the end of `App.css`, after the Story 3.1 `.empty-state*` rules and Story 3.2 form/button/list rules (the dev MUST verify exact placement based on the file's current state).

```css
.skeleton {
  min-height: 44px;
  background: linear-gradient(90deg, #f0eef2 0%, #e8e4eb 50%, #f0eef2 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

### Verification recipe (manual, real-browser)

```bash
# Step 1: Start the stack
docker compose up -d
# OR for dev mode with React DevTools:
cd api && npm run dev &
cd web && npm run dev

# Step 2: Open the app in Chromium with DevTools open
# → Navigate to http://localhost or http://localhost:5173

# Step 3: Test the optimistic CREATE path (fast network)
# → Open DevTools Network panel; throttling: "No throttling"
# → Type "test optimistic create", press Enter
# → Expected: the new task appears in the list IMMEDIATELY (within ~16ms — visible to the eye as instant)
# → The POST /api/tasks request is in-flight in the Network panel
# → Within ~50ms, the request completes; the task's id changes from negative (optimistic) to positive (server)
# → Inspect the <li> in DevTools Elements panel: confirm key changes from "-1716998400000" to a small positive integer
# → No flicker, no layout shift

# Step 4: Test the optimistic CREATE path (slow network — verifies skeleton fallback would fire if optimistic absent)
# → DevTools Network: throttling: "Slow 3G"
# → Type "test slow create", press Enter
# → Expected: the new task STILL appears in the list IMMEDIATELY (optimistic UI)
# → The POST /api/tasks takes ~2 seconds to complete (network throttled)
# → Within that 2-second window, the optimistic task is visible — the skeleton row should NOT appear (because the optimistic task is already there)
# → After ~2s, the task's id reconciles to the server-assigned positive value

# Step 5: Test the optimistic CREATE path with FORCED FAILURE (revert)
# → Stop the API container: docker compose stop api
# → Type "test create failure", press Enter
# → Expected: the task appears in the list IMMEDIATELY (optimistic)
# → After ~5-10s (depending on browser timeout) the fetch fails
# → The optimistic task DISAPPEARS from the list (automatic revert)
# → The error toast appears with text "POST /api/tasks failed: ..." (per Story 2.5)
# → Restart the API: docker compose start api

# Step 6: Test the optimistic TOGGLE path
# → Add a task; click its checkbox
# → Expected: checkbox flips to checked IMMEDIATELY; description gets line-through styling (per Story 2.3)
# → PATCH request in Network panel; on success, no visible change (state already correct)
# → Click again to uncheck; same instant feedback

# Step 7: Test the optimistic TOGGLE with FORCED FAILURE (revert)
# → Stop the API: docker compose stop api
# → Click a checkbox
# → Expected: checkbox flips IMMEDIATELY (optimistic)
# → After timeout, checkbox flips BACK to original state (revert) AND error toast appears
# → Restart API

# Step 8: Test the optimistic DELETE path
# → Click "Delete" on a task
# → Expected: task disappears from list IMMEDIATELY
# → DELETE request in Network panel; on success, no visible change
# → If it was the LAST task, empty state appears immediately

# Step 9: Test the optimistic DELETE with FORCED FAILURE (revert)
# → Stop the API: docker compose stop api
# → Click "Delete" on a task
# → Expected: task disappears IMMEDIATELY
# → After timeout, task REAPPEARS in its original position AND error toast appears
# → Restart API

# Step 10: Test concurrent optimistic operations
# → Type "first", press Enter; immediately type "second", press Enter
# → Expected: both tasks appear in list within ~16ms each; both POST requests fire concurrently; both reconcile to server-assigned ids on completion

# Step 11: Visual smoke test for skeleton row (manual injection — requires temporarily disabling useOptimistic)
# → This is a CUT-PATH verification (Step 11 is OPTIONAL and only run if the dev wants to verify the skeleton fallback works in isolation)
# → Temporarily comment out the addOptimisticTask call inside startTransition in handleSubmit
# → Set DevTools Network to "Slow 3G"
# → Type a task, press Enter
# → Expected: input clears immediately; ~150ms later, a shimmering skeleton row appears at the bottom of the list; ~2s later, the skeleton is replaced by the real task
# → REVERT the change (uncomment addOptimisticTask) before committing
```

### Anti-patterns (do not do these)

- ❌ DO NOT install `@tanstack/react-query`, `swr`, `apollo-client`, `urql`, `zustand`, `jotai`, `valtio`, `recoil`, `xstate`, `redux`, `mobx`. Per AC #8 / Dev Note #20.
- ❌ DO NOT install `react-loading-skeleton`, `react-content-loader`, `react-skeleton-screen`. The locked skeleton CSS is ~10 lines of vanilla CSS. Per AC #8 / Dev Note #28.
- ❌ DO NOT install `react-spring`, `framer-motion`, `motion`. The shimmer animation is plain CSS `@keyframes`. Per Dev Note #28.
- ❌ DO NOT use `useOptimistic` from `react/experimental` — it's stable in `react` since 19.0. Per Dev Note #2.
- ❌ DO NOT call `addOptimisticTask` OUTSIDE a `startTransition` block — React will throw an error. Per Dev Note #2.
- ❌ DO NOT call `addOptimisticTask` after `await` — if the await resolves and the transition ends, subsequent `addOptimisticTask` calls have no effect. Always dispatch BEFORE awaiting. Per Dev Note #6/7/8.
- ❌ DO NOT manually maintain a separate "optimistic" array (e.g., `const [pendingTasks, setPendingTasks] = useState([])`). The `useOptimistic` hook is the entire mechanism. Per Dev Note #5.
- ❌ DO NOT call `setOptimisticTasks(...)` directly — `useOptimistic` returns a dispatch function, not a setter. Per React 19 API.
- ❌ DO NOT use `useState` for the optimistic id sentinel (e.g., `const [tempIdCounter, setTempIdCounter] = useState(-1)`). Use `-Date.now()` per Dev Note #4.
- ❌ DO NOT use `crypto.randomUUID()` for the optimistic id — `Task.id` is `number`, not `string`. Per Dev Note #4.
- ❌ DO NOT widen `Task.id` to `number | string` to accommodate UUID. Per Dev Note #4.
- ❌ DO NOT use `0` or any other positive sentinel — collisions with `BIGSERIAL` are possible. Per Dev Note #4.
- ❌ DO NOT use `Number.MIN_SAFE_INTEGER` — sentinel readability matters; `-Date.now()` is self-documenting. Per Dev Note #4.
- ❌ DO NOT include a `pending` flag on the Task type for in-flight tasks. The optimistic state IS the pending indication. Per Dev Note #14.
- ❌ DO NOT add `disabled={isPending}` to the Add button, checkbox, or Delete button. Per AC #7 / Dev Note #14.
- ❌ DO NOT add `<span class="spinner">` inside the optimistic `<li>`. Per AC #7.
- ❌ DO NOT add a "saving..." indicator next to optimistic tasks. Per AC #7.
- ❌ DO NOT add `aria-busy={isPending}` to the `<ul>` or `<li>` elements. The optimistic state's instant visibility is the entire user-facing acknowledgement. Per Dev Note #14.
- ❌ DO NOT call `setTasks` BEFORE the API call inside the transition. The optimistic dispatch is the pre-API state change; `setTasks` is the post-API reconciliation. Per Dev Note #5/6/7/8.
- ❌ DO NOT call `setTasks` inside the catch block (would persist the failed change). Per Dev Note #5.
- ❌ DO NOT manually filter out the optimistic task in the catch block. React handles revert. Per Dev Note #5.
- ❌ DO NOT use `flushSync` to force the optimistic render. Per Dev Note #35.
- ❌ DO NOT add a `useEffect` to sync `optimisticTasks` with `tasks`. Per Dev Note #33.
- ❌ DO NOT use `useDeferredValue` for the tasks array. Wrong primitive — `useDeferredValue` is for stale-while-revalidate, not optimistic mutations.
- ❌ DO NOT wrap the App component in `<Suspense>` to handle the in-flight state. Per scope discipline.
- ❌ DO NOT wrap the App component in `<ErrorBoundary>`. Per Dev Note #37.
- ❌ DO NOT use Server Actions (`<form action={handleSubmit}>`). Per Dev Note #18/19.
- ❌ DO NOT use `useFormStatus`. Per Dev Note #18.
- ❌ DO NOT use the React 19 `use(promise)` hook for the initial fetch. The Story 1.4 useEffect mount pattern is preserved. Per Dev Note #23.
- ❌ DO NOT remove or modify the mount-time `fetchTasks` effect. Per Dev Note #23.
- ❌ DO NOT remove or modify the error toast region. Per Dev Note #24.
- ❌ DO NOT remove or modify the empty-state region. Per Dev Note #25.
- ❌ DO NOT remove or modify any API helper in `web/src/api.ts`. Per Dev Note #22.
- ❌ DO NOT modify `api/src/db.ts`, `api/src/server.ts`, `db/init.sql`. Per Dev Note #21.
- ❌ DO NOT add a unit test, integration test, or E2E test for the optimistic behavior. Manual real-browser verification per Dev Note #31 is the only test.
- ❌ DO NOT re-introduce the `setLoading(true)`/`setLoading(false)` pattern around mutations. The `loading` state is mount-only. Per Story 2.2 Dev Notes.
- ❌ DO NOT clear the input on FAILED submit (Story 2.2 AC #6.h preserved a "leave input on error" behavior). This story's locked decision is to clear immediately and rely on the toast (Dev Note #6) — the optimistic UX intent overrides the prior "preserve on error" choice. Document this behavioral change in Completion Notes.
- ❌ DO NOT use the `_nextCompleted` parameter naming convention to "fix" the unused-warning — actually USE it (`toggleTask(id, nextCompleted)`). The reducer's `'toggle'` action ignores it (computes `!t.completed`); the API helper still needs it. Per Dev Note #7.
- ❌ DO NOT use `Array.prototype.findIndex` + index-based mutation in the reducer. Use `.map` + immutable update per Dev Note #3 / locked code.
- ❌ DO NOT mutate the `currentTasks` array inside the reducer. React's reconciliation depends on reference equality of the returned array. Per Dev Note #3.
- ❌ DO NOT add a `displayName` to the App function. Per scope discipline.
- ❌ DO NOT add `'use client'` or `'use server'` directives — this is a Vite SPA, not Next.js. Per architecture.md#3.1.
- ❌ DO NOT add `prefers-reduced-motion: reduce` rules in this story. Per Dev Note #16 (deferred to a future Phase 1 story).
- ❌ DO NOT change the skeleton row's React `key` to anything other than `"skeleton-create"`. Per Dev Note #38.
- ❌ DO NOT use `Math.random()` for the optimistic id (collisions possible across rapid submits within the same ms). Per Dev Note #4.

### What this story does NOT touch

Out of scope (NEVER modify in this story):
- `api/` directory (entire backend untouched).
- `db/` directory (schema untouched).
- `e2e/` directory (smoke test untouched).
- `docker-compose.yml`, `Caddyfile`, `Dockerfile*` (deployment untouched).
- `web/src/api.ts` (mutation helpers byte-identical to post-Story 2.5 state).
- `web/src/main.tsx`, `web/index.html`, `web/vite.config.ts`, `web/tsconfig*.json`.
- `web/package.json` (no new deps).
- The mount-time `fetchTasks` `useEffect` (preserved per Dev Note #23).
- The error toast `<p role="alert">` JSX, `showError` helper, `errorTimerRef`, error-toast cleanup `useEffect` (preserved per Dev Note #24).
- The empty-state `<div className="empty-state">` JSX (only the conditional check changes from `tasks.length` to `optimisticTasks.length`, per Dev Note #25).
- The form JSX, the `description` state, the `inputRef`, the `handleKeyDown` Escape handler, the `<button type="submit">Add</button>` — all preserved.
- The list `<li>` inner structure (checkbox + span + Delete button) — preserved.
- All CSS rules from Stories 1.4/2.2/2.3/2.4/2.5/3.1/3.2 — preserved unchanged.

In scope (this story OWNS these):
- `web/src/App.tsx` — refactor: imports update; `OptimisticAction` type + `applyOptimistic` reducer (top-level); `useOptimistic` + `useTransition` hook calls; `showSkeleton` state + `skeletonTimerRef`; refactored `handleSubmit`/`handleToggle`/`handleDelete` (wrap in `startTransition`, dispatch optimistic, reconcile on success, revert-via-noop on error, show toast on error); update render branches to read `optimisticTasks`; insert skeleton `<li>` JSX; extend the cleanup `useEffect` to also clear the skeleton timer.
- `web/src/App.css` — append `.skeleton` rule + `@keyframes skeleton-shimmer` (Dev Note #16).

### Project Structure Notes

- `web/src/App.tsx`: target file for refactor.
- `web/src/App.css`: target file for skeleton CSS append.
- `web/package.json`: verified (React 19+ confirmed per Dev Note #30).

### References

- `_bmad-output/planning-artifacts/epics.md#Story 3.4` (lines 592-611) — story source-of-truth + cut criteria.
- `_bmad-output/planning-artifacts/prd.md#FR27` (line 545) — optimistic create/toggle/delete.
- `_bmad-output/planning-artifacts/prd.md#FR28` (line 546) — skeleton fallback.
- `_bmad-output/planning-artifacts/prd.md#FR29` (line 550) — error surfacing (preserved from Story 2.5).
- `_bmad-output/planning-artifacts/prd.md#NFR2` (line 612) — within one frame (~16ms).
- `_bmad-output/planning-artifacts/prd.md#NFR3` (line 613) — skeleton within ~150ms.
- `_bmad-output/planning-artifacts/prd.md` lines 148, 343-344, 436 — cut order + brutal cut.
- `_bmad-output/planning-artifacts/prd.md` line 474 — risk: optimistic introduces sync bugs → first to cut.
- `_bmad-output/planning-artifacts/architecture.md#3.1` — React 19 + useOptimistic; no state library.
- `_bmad-output/planning-artifacts/architecture.md#4.3` — frontend patterns: optimistic updates, automatic revert on error, no per-row spinners.
- `_bmad-output/planning-artifacts/architecture.md#5.3` — three-callsite trigger (the three handlers ARE the three call sites; reducer extraction is correct).
- `_bmad-output/implementation-artifacts/2-2-list-and-create-tasks-in-the-ui.md` — Story 2.2 `handleSubmit` (refactored here).
- `_bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md` — Story 2.3 `handleToggle` (refactored here).
- `_bmad-output/implementation-artifacts/2-4-delete-task-delete-api-tasks-id-and-ui.md` — Story 2.4 `handleDelete` (refactored here).
- `_bmad-output/implementation-artifacts/2-5-error-surfacing-for-failed-mutations.md` — `showError` helper + toast region (preserved).
- `_bmad-output/implementation-artifacts/3-1-designed-empty-state.md` — empty-state JSX (preserved; conditional updated).
- `_bmad-output/implementation-artifacts/3-2-mobile-and-responsive-behavior.md` — touch-target CSS (preserved).
- `_bmad-output/implementation-artifacts/3-3-readme-quality-bar-full-content-for-distribution.md` — README "Phase 0 gaps" section (gets the no-optimistic-UI bullet ONLY IF this story is cut).
- React 19 docs — `useOptimistic` hook API.
- React 19 docs — `useTransition` hook API.
- React 19 docs — Action context + async transitions.
- TypeScript handbook — Discriminated unions.

## Tasks / Subtasks

- [ ] Task 1: Verify React 19+ in package.json (Dev Note #30)
  - [ ] Read `web/package.json`.
  - [ ] Confirm `react` and `react-dom` are `^19.0.0` or higher.
  - [ ] If downgraded: STOP and revert/fix React version before proceeding.

- [ ] Task 2: Read current state of `web/src/App.tsx` and `web/src/App.css` (Dev Notes #1, #16)
  - [ ] Read full current `App.tsx` (post-Story 3.1 — empty-state JSX in place; post-2.5 toast in place).
  - [ ] Read full current `App.css` (post-Story 3.2 — form/button/list CSS in place).
  - [ ] Note the line counts and the locations of: imports, state declarations, useEffects, handlers, JSX render branches.

- [ ] Task 3: Add module-top-level types and reducer (Dev Notes #3, #29)
  - [ ] ABOVE the `App` function, ADD:
    - `OptimisticAction` discriminated union type.
    - `applyOptimistic(currentTasks, action): Task[]` reducer function.
  - [ ] Use the locked code from "Locked code skeleton — `web/src/App.tsx`" section.

- [ ] Task 4: Update imports (Dev Notes #2, #29)
  - [ ] Modify the React import to: `import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';`
  - [ ] Verify no other React-related imports needed.

- [ ] Task 5: Add hooks inside `App` (Dev Notes #10, #11)
  - [ ] After `const [tasks, setTasks] = useState<Task[]>([]);`, ADD:
    - `const [showSkeleton, setShowSkeleton] = useState<boolean>(false);` (skeleton state)
    - `const skeletonTimerRef = useRef<number | null>(null);` (skeleton timer ref)
    - `const [optimisticTasks, addOptimisticTask] = useOptimistic<Task[], OptimisticAction>(tasks, applyOptimistic);` (optimistic state)
    - `const [_isPending, startTransition] = useTransition();` (transition)

- [ ] Task 6: Extend the cleanup useEffect to also clear the skeleton timer (Dev Note #15)
  - [ ] Find the existing cleanup useEffect (Story 2.5 added one for `errorTimerRef`).
  - [ ] Extend its return cleanup function to also clear `skeletonTimerRef.current` if non-null.

- [ ] Task 7: Refactor `handleSubmit` (Dev Notes #4, #6, #15)
  - [ ] Replace the existing `handleSubmit` with the locked code from "Locked code skeleton".
  - [ ] Verify: `event.preventDefault()` + trim + silent-ignore are OUTSIDE the transition.
  - [ ] Verify: `setDescription('')` and `inputRef.current?.focus()` happen OUTSIDE the transition.
  - [ ] Verify: `skeletonTimerRef.current = window.setTimeout(...)` BEFORE the transition.
  - [ ] Verify: `addOptimisticTask({ type: 'add', task: optimisticTask })` is the FIRST thing inside `startTransition`.
  - [ ] Verify: `await createTask(trimmed)` follows the optimistic dispatch.
  - [ ] Verify: on success, `setTasks((prev) => [...prev, serverTask])`.
  - [ ] Verify: on error, `console.error(err); showError(err);` (no `setTasks` call).
  - [ ] Verify: `finally` block clears the skeleton timer and `setShowSkeleton(false)`.
  - [ ] Verify: optimistic id is `-Date.now()` (negative).

- [ ] Task 8: Refactor `handleToggle` (Dev Note #7)
  - [ ] Replace the existing `handleToggle` with the locked code.
  - [ ] Verify: wrapped in `startTransition`; `addOptimisticTask({ type: 'toggle', id })` first; `await toggleTask`; `setTasks` on success; `console.error + showError` on error.

- [ ] Task 9: Refactor `handleDelete` (Dev Note #8)
  - [ ] Replace the existing `handleDelete` with the locked code.
  - [ ] Verify: wrapped in `startTransition`; `addOptimisticTask({ type: 'remove', id })` first; `await deleteTask`; `setTasks` on success; `console.error + showError` on error.

- [ ] Task 10: Update render branches to read `optimisticTasks` (Dev Notes #9, #25)
  - [ ] Change `tasks.length === 0` → `optimisticTasks.length === 0 && !showSkeleton` (per locked code — empty state appears only when both empty AND no skeleton in-flight).
  - [ ] Change `tasks.map((task) => ...)` → `optimisticTasks.map((task) => ...)`.
  - [ ] Add `{showSkeleton && <li key="skeleton-create" className="skeleton" />}` AFTER the `optimisticTasks.map` inside the `<ul>`.

- [ ] Task 11: Append `.skeleton` CSS to `App.css` (Dev Note #16)
  - [ ] Append the locked CSS from "Locked code skeleton — `web/src/App.css`" to the end of the file.
  - [ ] Verify: `.skeleton` rule + `@keyframes skeleton-shimmer`.

- [ ] Task 12: Build verification
  - [ ] From `web/`, run `npm run build` (`tsc -b && vite build`).
  - [ ] Confirm zero TS errors.
  - [ ] Confirm Vite build emits `web/dist/`.
  - [ ] If TS errors:
    - Verify `useOptimistic<Task[], OptimisticAction>` explicit type parameters.
    - Verify `OptimisticAction` discriminated union is in scope.
    - Verify `_isPending` underscore-prefix (or `isPending` is actually used).
    - Verify all imports updated.

- [ ] Task 13: Real-browser verification — fast network (Dev Note #31, recipe Step 3)
  - [ ] Run the stack; open the app in Chromium.
  - [ ] Test optimistic CREATE: type → Enter → confirm task appears within ~16ms; id reconciles after API response.
  - [ ] Test optimistic TOGGLE: click checkbox → confirm flip is instant; reconciles on PATCH success.
  - [ ] Test optimistic DELETE: click Delete → confirm removal is instant; confirms on DELETE success.

- [ ] Task 14: Real-browser verification — slow network (Dev Note #31, recipe Steps 4-9)
  - [ ] Throttle to "Slow 3G" in DevTools.
  - [ ] Repeat CREATE/TOGGLE/DELETE; confirm UI feedback is still instant.
  - [ ] Stop the API container; trigger CREATE/TOGGLE/DELETE; confirm optimistic state appears, then reverts after timeout, with error toast.
  - [ ] Restart API.

- [ ] Task 15: Concurrent-operation verification (Dev Note #36, recipe Step 10)
  - [ ] Type "first" + Enter, immediately type "second" + Enter.
  - [ ] Confirm both tasks appear instantly; both reconcile to server-assigned ids.

- [ ] Task 16: Skeleton-row visual verification (OPTIONAL, recipe Step 11)
  - [ ] Optionally temporarily comment out the `addOptimisticTask` in `handleSubmit`.
  - [ ] Throttle to "Slow 3G", create a task.
  - [ ] Confirm shimmering skeleton row appears ~150ms after submit.
  - [ ] REVERT the temporary change.

- [ ] Task 17: Anti-pattern self-audit
  - [ ] Confirm no new dependencies in `web/package.json`.
  - [ ] Confirm no `setTasks` call before `await` inside any transition.
  - [ ] Confirm no `disabled={isPending}` on any button.
  - [ ] Confirm no `<span class="spinner">` per task.
  - [ ] Confirm no `flushSync` usage.
  - [ ] Confirm no `useEffect` syncing `optimisticTasks` with `tasks`.
  - [ ] Confirm `addOptimisticTask` is always inside `startTransition`.
  - [ ] Confirm optimistic id uses `-Date.now()` (negative).
  - [ ] Confirm catch blocks call `showError(err)` after `console.error(err)`.

- [ ] Task 18: Update Dev Agent Record + flip status to `review`
  - [ ] Fill in Completion Notes (verification results, any deviations from skeleton, scenarios tested, behavioral changes from prior stories).
  - [ ] Update File List with: `web/src/App.tsx` (refactored), `web/src/App.css` (appended).
  - [ ] Update Change Log with v0.1 entry.
  - [ ] In `_bmad-output/implementation-artifacts/sprint-status.yaml`, flip `3-4-optimistic-ui-with-server-reconciliation-nice-to-ship-first-to-cut` from `ready-for-dev` to `review` OR (if cut) document the cut decision in Completion Notes and mark accordingly.

## Dev Agent Record

### Context Reference

- _bmad-output/planning-artifacts/epics.md (Story 3.4 — lines 592-611)
- _bmad-output/planning-artifacts/prd.md (FR27/28/29 lines 545/546/550; NFR2/3 lines 612/613; cut order lines 148/343/344/436/474)
- _bmad-output/planning-artifacts/architecture.md (§3.1 React 19 + useOptimistic; §4.3 optimistic + revert + no spinners)
- _bmad-output/implementation-artifacts/2-2-list-and-create-tasks-in-the-ui.md (handleSubmit refactored)
- _bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md (handleToggle refactored)
- _bmad-output/implementation-artifacts/2-4-delete-task-delete-api-tasks-id-and-ui.md (handleDelete refactored)
- _bmad-output/implementation-artifacts/2-5-error-surfacing-for-failed-mutations.md (showError + toast preserved)
- _bmad-output/implementation-artifacts/3-1-designed-empty-state.md (empty-state JSX preserved; conditional updated)
- _bmad-output/implementation-artifacts/3-2-mobile-and-responsive-behavior.md (touch-target CSS preserved)
- web/src/App.tsx (post-3.1/3.2 state — refactored here)
- web/src/App.css (post-3.1/3.2 state — skeleton appended here)
- web/src/api.ts (post-2.4/2.5 state — UNCHANGED here)
- web/package.json (verified React ^19.x)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes

- React version verified (target: ^19.x):
- Story status: implemented OR cut (per cut criteria)?
- IF cut: rationale (which prior story over-budget? total elapsed time?):
- IF cut: skeleton-row fallback implemented (per AC #6)? Y/N:
- IF cut: README "Phase 0 gaps" section updated with no-optimistic-UI bullet (per Story 3.3 Dev Note #16)? Y/N:
- IF implemented:
  - useOptimistic + useTransition imports verified:
  - OptimisticAction discriminated union + applyOptimistic reducer placed at module top-level:
  - All three handlers refactored (startTransition wrapping, optimistic dispatch, await, reconcile/revert):
  - Skeleton state + 150ms timer + cleanup added:
  - Render branches updated to read optimisticTasks:
  - .skeleton CSS appended:
  - Build (tsc + vite) succeeded with zero errors:
  - Real-browser verification (fast network) — CREATE / TOGGLE / DELETE all instant?:
  - Real-browser verification (slow network) — UI still instant?:
  - Real-browser verification (API stopped) — optimistic state reverts + error toast?:
  - Concurrent-operation verification (two rapid creates) — both reconcile correctly?:
  - Skeleton-row visual verification (optional) — shimmer renders?:
  - Behavioral change documented: input now CLEARS on failed submit (vs Story 2.2's "preserve on error"); Y/N user-noticeable?:
- Anti-pattern audit results:

### File List

- web/src/App.tsx (refactored — useOptimistic + useTransition + OptimisticAction reducer + skeleton state + three refactored handlers + render branches updated)
- web/src/App.css (modified — appended `.skeleton` rule + `@keyframes skeleton-shimmer`)

### Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-04-29 | 0.1 | Initial draft | Bob (Scrum Master) |
