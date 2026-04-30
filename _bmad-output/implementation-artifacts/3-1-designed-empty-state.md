# Story 3.1: Designed empty state

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a first-time visitor,
I want the empty state to feel deliberately designed rather than blank or accidental,
so that the app signals intentionality and earns my willingness to type a first task without onboarding instructions.

## Acceptance Criteria

1. **`web/src/App.tsx` REPLACES the existing empty-state branch** — the line `<p aria-live="polite">No tasks</p>` (the placeholder from Story 1.4, preserved through Stories 2.2–2.5 because the form/list/error structure all live in the OTHER branches of the same ternary). The replacement is a `<div className="empty-state">…</div>` containing exactly TWO elements: (a) a primary copy line in a `<p>` element, (b) a secondary hint line in a `<p>` element. NO additional decorations (no SVG illustration, no icon, no animation, no third paragraph). The DOM order is `<p class="empty-state-primary">…</p>` then `<p class="empty-state-hint">…</p>`. The `aria-live="polite"` attribute MOVES from the old `<p>` to the new `<div className="empty-state">` (so transitions in/out of empty state are announced once per change, not per-paragraph). [Source: web/src/App.tsx:32 (post-2.5 state — empty branch), epics.md#Story 3.1 AC ("deliberately styled empty state"), prd.md#FR21]

2. **The primary copy line is EXACTLY**: `Nothing here yet.` Three words, ending with a period. NO emoji, NO ellipsis (the period is intentional — definitive, not trailing-off), NO em-dash, NO exclamation point ("Nothing here yet!" reads as cheery; the brief's voice is matter-of-fact). NO synonym variants ("Empty list.", "No tasks yet.", "All clear.") — the EXACT phrase `Nothing here yet.` matches the discipline-first, builder-speak voice established in the brief's narrative ("not a generic blank list with placeholder text, but something that signals 'this is intentional, not lazy'"). [Source: prd.md#FR21, prd.md narrative line 192, brief — "discipline-first voice"]

3. **The secondary hint line is EXACTLY**: `Type a task above and press Enter.` Six words plus the trailing period. This sentence does THREE things at once: (a) it tells the user WHAT to do (type), (b) it tells the user WHERE (above — pointing to the form, which always sits between `<h1>` and the empty state per the layout from Story 2.2), (c) it tells the user the SUBMIT MECHANISM (press Enter — which matches the form's primary submission path; clicking Add also works but Enter is the more common single-input pattern, and Story 2.7's smoke test exercises the Enter path specifically). NO mention of the Add button (would dilute the single instruction), NO icon to indicate "above" (the word "above" is sufficient with the form positioned directly above), NO mention of toggle/delete (those affordances are discoverable once a task exists). The line satisfies FR23/NFR18: a first-time user knows how to create a task from the empty state alone, no external instruction needed. [Source: prd.md#FR23, prd.md#NFR18, web/src/App.tsx (post-2.2 state — form is between h1 and the conditional render branches), 2-2-list-and-create-tasks-in-the-ui.md AC #16 (Add button), 2-7-playwright-smoke-test-in-e2e.md AC #10 (Enter is the form's primary submit path)]

4. **NO signup prompt, NO tour overlay, NO welcome modal, NO marketing language** anywhere in the empty state — preserves FR22, which was preserved through Story 1.4 and must remain preserved here. Specifically forbidden phrasings: "Welcome to Tasky!", "Get started", "Try it out", "Sign in to sync", "Watch a quick tour", "Pro tip:", "Did you know?". The empty state is two short sentences. Period. [Source: prd.md#FR22, epics.md#Story 3.1 AC ("no signup prompt, no tour overlay, no marketing language")]

5. **`web/src/App.css` GAINS a single new block of rules for the `.empty-state` class and its descendants** — appended after the existing `.error-toast` block (added by Story 2.5), at the end of the file. The new rules are EXACTLY:
   - `.empty-state { padding: 2rem 0; text-align: center; }` — vertical breathing room (2rem top + bottom) and centered alignment so the two short lines anchor visually rather than hugging the left margin.
   - `.empty-state-primary { margin: 0 0 0.5rem; font-size: 1.125rem; font-weight: 500; color: #2a2333; }` — slightly larger than body text, medium weight, near-black color (NOT pure black — `#2a2333` is the same hue family as the existing `p { color: #6b6375; }` rule; provides visual hierarchy without harshness). The `#2a2333` on the App's default white background gives a contrast ratio of ~13:1, well above WCAG AA's 4.5:1 floor.
   - `.empty-state-hint { margin: 0; font-size: 0.95rem; color: #6b6375; }` — slightly smaller than body, the SAME color as the existing `p` rule (`#6b6375`), establishing it as secondary information. The `#6b6375` on white is ~5.4:1 contrast, above WCAG AA's 4.5:1 floor for normal text.
   - NO additional rules — no `.empty-state svg`, no `.empty-state::before`, no `.empty-state h2`, no animation/transition, no border, no background, no box-shadow, no rounded corners (the empty state is text on whitespace; chrome would contradict the minimalism).
   - Total lines added: ≤ 12 (3 selectors × ~3 lines each, plus a 1-line comment optional).
   [Source: web/src/App.css (post-2.5 state), prd.md#NFR17 (WCAG AA 4.5:1), brief — "polished empty state... minimalism", architecture.md#3.1 (vanilla CSS one file)]

6. **The active-vs-completed task styling MUST meet WCAG AA contrast ratio (~4.5:1 for text)** — this AC explicitly satisfies NFR17. The completed-task styling locked in Story 2.3 is `.completed { text-decoration: line-through; opacity: 0.6; }`. Verify the contrast: text `color` for `<li> <span>` is the browser default body color (which inherits from the App's defaults — effectively black `#000` or very-near-black on the App's white background). With `opacity: 0.6` applied, the perceived contrast against white drops to ~4.5:1 (rounded down from ~12.6:1 × 0.6 = ~7.6:1 — actually well above the 4.5 floor; opacity reduces apparent contrast more dramatically than the linear math suggests, and a manual check via a contrast tool is required). The dev MUST verify this contrast using a tool (browser devtools' contrast picker, axe DevTools, or https://webaim.org/resources/contrastchecker/) and record the measured ratio in the Completion Notes. If the measured ratio falls BELOW 4.5:1, the locked rule MUST change to `.completed { text-decoration: line-through; opacity: 0.7; color: #6b6375; }` (changing both opacity AND color, not just opacity, restores deterministic contrast). Active-task text uses the browser default (black/near-black), trivially well above 4.5:1. [Source: prd.md#NFR17, 2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md (locked `.completed` rule), WCAG 2.1 SC 1.4.3]

7. **The empty state MUST be visible whenever `tasks.length === 0` AND `loading === false` AND `error === null OR error !== null`** — i.e., the empty-state render branch is the SECOND condition in the existing ternary chain (after `loading`), unchanged in semantics from Stories 1.4–2.5. The error toast (`<p role="alert">`) sits ABOVE the conditional render branches (between `<form>` and the ternary) and renders OVER the empty state when both are present — the empty state is NOT hidden by the toast, NOT replaced by it, NOT competing with it for the same screen region. Specifically: when a user submits an invalid task (description too long), the toast appears above AND the empty state remains below. This is correct UX — the user can see the error message AND the "type a task above" hint simultaneously. [Source: web/src/App.tsx (post-2.5 state — render structure), 2-5-error-surfacing-for-failed-mutations.md AC #3 (toast position)]

8. **The empty state MUST NOT render in the `<ul>` branch.** When `tasks.length > 0`, the user is in the list-rendering branch and the empty-state DOM does NOT exist (consequence of the ternary, but explicit so the dev does not "helpfully" merge the branches into one always-rendered structure with a hidden state). The empty state is genuinely absent (not display:none, not visibility:hidden) when tasks exist — this matters for screen-reader behavior with the `aria-live="polite"` attribute (announcement fires on append/remove of the live region's children, not on display changes). [Source: web/src/App.tsx (post-2.5 state — ternary structure), MDN ARIA aria-live]

9. **NO new files in `web/src/`, `api/`, `db/`, `e2e/`, or the project root.** This story's complete file-change set is exactly: `web/src/App.tsx` (modified — replace one branch's JSX), `web/src/App.css` (modified — append `.empty-state` rules). Two files. Specifically, do NOT create `web/src/EmptyState.tsx` (the empty-state JSX is ~5 lines; a separate component would be premature abstraction per Architecture §5.3's three-callsite extraction trigger — there is exactly ONE callsite). [Source: architecture.md#5.3 (three-callsite trigger), AC #5]

10. **NO NEW DEPENDENCIES.** Same forbidden list as prior stories — no Tailwind, no MUI, no shadcn, no styled-components, no emotion, no clsx, no framer-motion, no react-spring, no lottie-react, no SVG-as-React-component generator. The empty state is plain HTML + ~12 lines of CSS. The deps list MUST stay byte-identical: `git diff web/package.json web/package-lock.json` MUST produce empty output. [Source: epics.md#Story 3.1 AC ("no UI library (Tailwind, MUI, shadcn) is added"), architecture.md#5.3]

11. **NO use of Tailwind utility classes (e.g., `className="text-center py-8 text-lg"`)**, NO inline `style={...}` props on the empty-state JSX, NO CSS-in-JS (`styled.div`, `css`-prop). All styling lives in `web/src/App.css` per AC #5 and per Architecture §3.1. [Source: architecture.md#3.1, AC #5]

12. **NO additional ARIA attributes on the empty-state DOM** beyond the `aria-live="polite"` on the wrapper `<div>` (moved from the deprecated `<p>`). Specifically: NO `role="status"` (would be redundant with `aria-live="polite"`), NO `aria-atomic="true"` (default behavior is fine for a two-paragraph region), NO `aria-label` on the wrapper (the visible text IS the accessible name; an aria-label would override and confuse screen readers), NO `tabindex` (the region is not interactive). [Source: MDN ARIA aria-live, accessibility best practices]

13. **NO image, NO SVG, NO illustration, NO icon** in the empty state. Architecture §3.1 establishes vanilla CSS only — adding an SVG asset (whether inline, imported, or referenced via `background-image`) would introduce an asset pipeline concern (where does it live? does Vite need an asset import? does Caddy serve it?) and contradicts the brief's "polished empty state" intent (which is about typography and copy, not decorative chrome — see brief narrative line 192: "not a generic blank list with placeholder text, but something that signals 'this is intentional, not lazy'" — that signal is achieved through copy + spacing, not imagery). Future stories MAY add a brand mark/illustration; this story does not. [Source: brief narrative line 192, architecture.md#3.1, prd.md narrative line 192]

14. **NO change to the existing form, h1, error toast, list rendering, checkbox, span, Delete button, or any other JSX outside the `tasks.length === 0` branch.** Specifically, do NOT "while we're in here" tweak the `<h1>Tasky</h1>` styling (an h1 redesign belongs in Story 3.3 if anywhere), do NOT adjust the `<form>` layout (Story 3.2 owns mobile/responsive), do NOT add a "stats" line ("0 tasks") to the list-rendering branch. Two-file scope per AC #9. [Source: AC #9, prior story ownership]

15. **NO change to `web/src/api.ts`, `web/index.html`, `web/vite.config.ts`, or any non-`App.tsx`/`App.css` file in `web/`.** This story is purely presentational. [Source: AC #9]

16. **NO change to `api/`, `db/`, `compose.yaml`, `Caddyfile`, `e2e/`, `README.md`.** This story is frontend-only. The README's mention of the empty state (if any future) belongs in Story 3.3. The empty state's interaction does not change the smoke test's selectors (the smoke test creates a task IMMEDIATELY, never observing the empty state — the locator `getByRole('textbox', { name: 'New task description' })` works with or without the empty state visible). [Source: AC #9, 2-7-playwright-smoke-test-in-e2e.md (smoke test selectors)]

17. **TypeScript strictness compliance**: the JSX changes introduce no new type considerations (no new state, no new props, no new event handlers). The `className` attribute is a standard React prop typed as `string | undefined`. `aria-live` is typed by `@types/react`. NO `as`-casts, NO `// @ts-expect-error`, NO `// @ts-ignore`. The diff should pass `tsc --noEmit` with zero changes to `tsconfig.app.json`. [Source: web/tsconfig.app.json (strict flags from Story 1.4)]

18. **The dev MUST verify the change visually in a real browser** before marking the story `done`: load `http://localhost` (with the stack running and zero tasks in the DB — clear the table or use `docker compose down -v` then `up -d` if needed), confirm the empty state renders with the locked copy, take a screenshot saved to `_bmad-output/implementation-artifacts/3-1-empty-state-screenshot.png` (this PNG is the ONE exception to AC #9's "two-file change set" rule — it lives under `_bmad-output/`, not under `web/` or `docs/`, so it's a Dev Agent Record artifact, not a source file). The screenshot is for the Completion Notes audit trail; it does NOT ship with the build. [Source: prd.md#NFR18 (validated by walkthrough on real device), epics.md#Story 3.1 AC ("verified by visual inspection")]

19. **The dev MUST verify the WCAG AA contrast ratios** per AC #5 and AC #6 using a real contrast tool, and record the measured ratios in Completion Notes for: (a) `.empty-state-primary` color `#2a2333` on background white (expected ~13:1), (b) `.empty-state-hint` color `#6b6375` on background white (expected ~5.4:1), (c) the `.completed` rule's effective text contrast (expected ≥ 4.5:1; if less, apply the AC #6 fallback rule). Tool MUST be reproducible — the Chromium devtools contrast picker is sufficient and is the recommended choice; alternatives include axe DevTools, Stark, or the WebAIM checker. [Source: prd.md#NFR17, AC #5, AC #6]

20. **The empty state MUST be reachable via the standard journey** — a fresh user opens the deployed URL on a fresh browser session and lands on the empty state because the DB has zero tasks. Verify by: (a) `docker compose down -v && docker compose up -d` (resets the volume), (b) wait for services up, (c) open the URL in an INCOGNITO browser window (no caching), (d) confirm the empty state renders within 1 second per NFR1. The `down -v` is acceptable here because this is a verification scenario, not a documented user procedure (and Story 2.6's anti-pattern about not documenting `down -v` in the README still holds). [Source: prd.md#NFR1, journey 1 walkthrough]

21. **NO change to deps versions in `web/package.json`** ("while we're updating the empty state, let me bump React patch versions"). Out of scope; introduce risk for zero benefit. [Source: AC #10]

22. **NO storybook, no design-tokens file, no `theme.css`, no CSS variables** introduced by this story. The two new colors (`#2a2333`, `#6b6375` — though `#6b6375` is the existing `p` rule's color, not new) are written as literal hex codes per the existing `App.css` convention. A future story MAY introduce a theme system; this story does not. [Source: web/src/App.css (existing literal-hex convention)]

23. **NO copy localization or i18n preparation.** The literal strings "Nothing here yet." and "Type a task above and press Enter." live directly in the JSX. Phase 0 is single-language; introducing an i18n framework or even a `messages.ts` constants file would be premature abstraction. [Source: architecture.md#5.3 (no premature abstraction)]

24. **The dev MUST execute `npm run build` and confirm zero new TypeScript errors** before marking the story `done`. Build output should be byte-similar to pre-change (the diff is two files; bundle-size impact is < 1 KB compressed). Record the new bundle size in Completion Notes. [Source: standard verification practice]

## Tasks / Subtasks

- [ ] **Task 1: Confirm prerequisites** (AC: #9, #15, #16)
  - [ ] Run `git status` — confirm clean working tree.
  - [ ] Run `cat web/src/App.tsx | wc -l` — note current line count (post-2.5 expected size; if disk state differs from expected post-2.5 state, all prior Stories 2.2–2.5 must be merged first).
  - [ ] Run `cat web/src/App.css | wc -l` — note current line count.
  - [ ] Confirm `tasks.length === 0` branch in App.tsx currently renders `<p aria-live="polite">No tasks</p>`.

- [ ] **Task 2: Modify `web/src/App.tsx`** (AC: #1–#4, #7, #8, #11, #12, #14, #17)
  - [ ] Locate the empty-state branch (`tasks.length === 0 ? (...) : (...)`).
  - [ ] REPLACE `<p aria-live="polite">No tasks</p>` with the locked JSX skeleton in Dev Notes below.
  - [ ] Verify primary copy is EXACTLY `Nothing here yet.`
  - [ ] Verify hint copy is EXACTLY `Type a task above and press Enter.`
  - [ ] Verify `aria-live="polite"` moved to the wrapper `<div className="empty-state">`.
  - [ ] Verify NO other JSX in the file is touched.

- [ ] **Task 3: Modify `web/src/App.css`** (AC: #5, #11, #22)
  - [ ] Append the locked CSS skeleton in Dev Notes below to the END of the file.
  - [ ] Verify the existing `.error-toast` block (added by Story 2.5) is the LAST block before the new additions.
  - [ ] Verify total CSS additions ≤ 12 lines.

- [ ] **Task 4: TypeScript build verification** (AC: #17, #24)
  - [ ] From `web/`, run `npm run build`.
  - [ ] Confirm zero TS errors.
  - [ ] Record new bundle size in Completion Notes.

- [ ] **Task 5: Visual verification** (AC: #18, #20)
  - [ ] Reset the DB to zero tasks: `docker compose down -v && docker compose up -d` (acceptable verification destructive op per AC #20).
  - [ ] Wait for stack `Up`.
  - [ ] Open `http://localhost` in an incognito browser.
  - [ ] Confirm the empty state renders with the exact two locked strings.
  - [ ] Confirm the error toast slot (when triggered by typing a 501-character task) appears ABOVE the empty state, NOT replacing it.
  - [ ] Take a screenshot, save to `_bmad-output/implementation-artifacts/3-1-empty-state-screenshot.png`.

- [ ] **Task 6: WCAG AA contrast verification** (AC: #6, #19)
  - [ ] Open Chromium devtools → Inspect the `<p class="empty-state-primary">` element → use the color picker → confirm contrast ratio against white background.
  - [ ] Record `.empty-state-primary` ratio in Completion Notes (expect ~13:1).
  - [ ] Repeat for `.empty-state-hint` (expect ~5.4:1).
  - [ ] Create one task, mark it complete (toggle), inspect the `.completed` `<span>` (or `<li>`'s effective text region), record the perceived contrast.
  - [ ] If `.completed` ratio < 4.5:1, apply the AC #6 fallback rule (`opacity: 0.7; color: #6b6375;`); re-measure; record both attempts in Completion Notes.

- [ ] **Task 7: NFR1 perf sanity** (AC: #20)
  - [ ] On the same incognito session, hard-refresh (Cmd-Shift-R / Ctrl-Shift-R).
  - [ ] Eyeball the empty-state-render time — it should appear in < 1 second on typical broadband (NFR1 is a judgment call, not a measurement; a stopwatch is not required).
  - [ ] Record in Completion Notes.

- [ ] **Task 8: Verify forbidden additions are absent** (AC: #9, #10, #13, #14, #15, #16)
  - [ ] `git status` — confirm only `web/src/App.tsx` and `web/src/App.css` modified.
  - [ ] `git diff web/package.json web/package-lock.json` — confirm empty output.
  - [ ] Confirm no SVG/PNG/JPG asset added (other than the screenshot under `_bmad-output/`).
  - [ ] Confirm no new files in `web/src/`.
  - [ ] Confirm no Tailwind/clsx/styled-components imports.
  - [ ] Confirm `index.html`, `vite.config.ts`, `api/**`, `db/**`, `e2e/**`, `compose.yaml`, `Caddyfile`, `README.md` byte-identical.

- [ ] **Task 9: Smoke-test compatibility check** (AC: #16)
  - [ ] Run `cd e2e && npm test` — confirm Story 2.7's smoke test STILL PASSES (the test creates a task immediately so empty state is irrelevant; this is a regression check that the JSX change did not break the input/list locators).

- [ ] **Task 10: Populate Dev Agent Record**
  - [ ] Fill the Completion Notes List with: build outcome, bundle size delta, contrast ratios (3 measurements), perf observation, screenshot path, smoke-test outcome.
  - [ ] Fill the File List with the two-file change set (plus the screenshot under `_bmad-output/`).
  - [ ] Fill the Change Log with one row.

## Dev Notes

### Locked code skeleton — `web/src/App.tsx` empty-state branch

The change is to the SECOND branch of the existing ternary (the `tasks.length === 0` branch). All other branches and JSX remain UNTOUCHED. The diff is conceptually:

```tsx
// BEFORE (line 32 in the post-2.5 state):
        ) : tasks.length === 0 ? (
          <p aria-live="polite">No tasks</p>
        ) : (
```

```tsx
// AFTER:
        ) : tasks.length === 0 ? (
          <div className="empty-state" aria-live="polite">
            <p className="empty-state-primary">Nothing here yet.</p>
            <p className="empty-state-hint">Type a task above and press Enter.</p>
          </div>
        ) : (
```

The exact strings:
- `Nothing here yet.`
- `Type a task above and press Enter.`

The exact class names:
- Wrapper: `empty-state`
- Primary copy: `empty-state-primary`
- Hint copy: `empty-state-hint`

### Locked code skeleton — `web/src/App.css` additions

Append to the END of `web/src/App.css` (after the existing `.error-toast` block from Story 2.5):

```css
.empty-state {
  padding: 2rem 0;
  text-align: center;
}

.empty-state-primary {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 500;
  color: #2a2333;
}

.empty-state-hint {
  margin: 0;
  font-size: 0.95rem;
  color: #6b6375;
}
```

11 lines (3 selectors at 4 lines each minus blank-line collapsing). Below the AC #5 ceiling of 12 lines.

### Why "Nothing here yet." is the locked primary copy

- **Three words.** Brevity matches the discipline thesis.
- **Period, not exclamation.** "Nothing here yet!" reads as cheery onboarding theater. The brief's voice is matter-of-fact: state the situation, do not editorialize about it.
- **"yet"** implies forward motion (a task can/will arrive) without instructing the user (no "Add one!"); it's an observation, not a CTA.
- **Sentence-case capitalization** matches the rest of the App's copy (`Tasky`, `Loading…`, `Add`).

### Why the hint copy is "Type a task above and press Enter."

- **"Type a task"** is the action. Not "Create one", not "Add an item" — "task" matches the app's noun (the H1 is "Tasky", the entity is a task).
- **"above"** spatially references the input field positioned directly above the empty state.
- **"press Enter"** is the canonical submit gesture for a single-input form. The Add button works too, but mentioning it here would dilute the single instruction. The smoke test (Story 2.7) exercises the Enter path; the empty state's hint matches.

### Why centered text and 2rem padding

- **`text-align: center`** anchors the two short lines visually. Left-aligned, the lines would hug the leftmost ~40% of the 640px max-width container and look orphaned.
- **`padding: 2rem 0`** (32px top + 32px bottom) gives the empty state room to breathe. Less than 1rem feels cramped; more than 3rem starts pushing the form upward in a way that looks unbalanced.
- **No horizontal padding inside the wrapper** — the parent `<main>` already has `padding: 2rem 1rem` (App.css line 4); double-padding would over-indent the centered text.

### Why no SVG/illustration

The brief's narrative line 192: *"a designed empty state — not a generic blank list with placeholder text, but something that signals 'this is intentional, not lazy.'"* The signal of intentionality comes from the copy choice and the typographic treatment — NOT from a decorative graphic. Adding an SVG would:

- Introduce an asset import + Vite asset pipeline considerations (~10 min of new file location decisions).
- Couple visual identity to a decorative element that future Phase 1 work will likely revisit.
- Visibly contradict the "minimalism is the position" thesis the brief explicitly takes.

The two-paragraph + whitespace approach IS the design. Restraint is intentional.

### Why the AC #6 contrast verification matters NOW

Story 2.3 locked `.completed { text-decoration: line-through; opacity: 0.6; }` because at that time the contrast question was deferred to Story 3.1 (the polish epic). Now is the moment to verify and, if necessary, harden the rule. The `opacity: 0.6` math:

- Pure black (`#000`) on white (`#fff`) = 21:1 contrast.
- `opacity: 0.6` causes the rendered color to blend with the background — effective rendered color ≈ `rgba(0, 0, 0, 0.6)` over white ≈ `#666666`.
- `#666` on `#fff` = ~5.7:1, above the 4.5:1 floor.

So the locked rule SHOULD pass. But: opacity composition depends on the underlying text color (which is the body default), and a future stylesheet change could shift the body color. Recording the measured value in Completion Notes creates a reproducible baseline.

The fallback rule `opacity: 0.7; color: #6b6375;` is more deterministic: it sets BOTH the alpha AND the explicit color, and `#6b6375` on white is ~5.4:1 — still above 4.5:1 — and `opacity: 0.7` reduces effective contrast to ~4.5:1 (right at the floor; if even tighter, change to `0.8`).

### Runtime verification recipe

```bash
# Start with a clean DB
cd /Users/gio/Source/bmad-test
docker compose down -v && docker compose up -d
docker compose ps   # all three Up

# Open the app
open http://localhost   # or DOMAIN

# Empty-state visual check
# Expected: centered "Nothing here yet." (medium weight, near-black) + smaller "Type a task above and press Enter." (gray)

# Contrast check (Chromium devtools)
# 1. Right-click "Nothing here yet." → Inspect
# 2. In the Styles pane, click the colored swatch next to `color: #2a2333`
# 3. Read the contrast ratio (should be ~13:1, "AAA Pass")
# 4. Repeat for "Type a task above..." (#6b6375, expect ~5.4:1, "AA Pass")

# .completed contrast check
# 1. Type a task: "test"
# 2. Press Enter
# 3. Click the task's checkbox to mark complete
# 4. Inspect the strike-through `<span>` → measure perceived contrast
# 5. Record value; if < 4.5:1, apply AC #6 fallback

# Verify error toast does NOT replace empty state
# 1. Reset to empty: refresh after deleting the test task
# 2. Type a 501-char description (paste a long string)
# 3. Press Enter → expect 400 → toast appears
# 4. Confirm toast appears ABOVE the empty state, both visible
```

### Anti-patterns and forbidden additions

- ❌ DO NOT change the primary copy from `Nothing here yet.` Per AC #2.
- ❌ DO NOT change the hint copy from `Type a task above and press Enter.` Per AC #3.
- ❌ DO NOT add a third paragraph ("You can also click Add."). Per AC #1, AC #3.
- ❌ DO NOT add a heading (`<h2>`) to the empty state. Per AC #1.
- ❌ DO NOT add an emoji to either string. Per AC #2, AC #3.
- ❌ DO NOT use exclamation points or em-dashes in the copy. Per AC #2, brief voice.
- ❌ DO NOT add an SVG, PNG, or icon. Per AC #13.
- ❌ DO NOT add an illustration or background-image. Per AC #13.
- ❌ DO NOT add a "Get started" button. Per AC #4.
- ❌ DO NOT add a "Welcome to Tasky" header or modal. Per AC #4.
- ❌ DO NOT add a "Pro tip:" or "Did you know?" line. Per AC #4.
- ❌ DO NOT add `aria-label` to the wrapper. Per AC #12.
- ❌ DO NOT add `role="status"` (redundant with `aria-live="polite"`). Per AC #12.
- ❌ DO NOT add `aria-atomic`, `tabindex`, or other ARIA attributes. Per AC #12.
- ❌ DO NOT remove `aria-live="polite"` ("centered text doesn't need an announcement"). Screen-reader users rely on it for the empty-to-list and list-to-empty transitions.
- ❌ DO NOT extract `EmptyState.tsx` as a separate component. Per AC #9 (one callsite, no extraction trigger).
- ❌ DO NOT extract a `messages.ts` constants file for the two strings. Per AC #23.
- ❌ DO NOT add Tailwind, MUI, shadcn, styled-components, emotion. Per AC #10.
- ❌ DO NOT add inline `style={{...}}` props. Per AC #11.
- ❌ DO NOT add CSS-in-JS. Per AC #11.
- ❌ DO NOT add CSS variables (`--empty-bg: white;`). Per AC #22.
- ❌ DO NOT add a `theme.css` or `tokens.css` file. Per AC #22.
- ❌ DO NOT add animation/transition (`@keyframes fadeIn`). Per AC #5 (no transitions specified).
- ❌ DO NOT add hover states on the empty-state region (it's not interactive). Per AC #5.
- ❌ DO NOT add `border`, `background-color`, `box-shadow`, `border-radius`. Per AC #5.
- ❌ DO NOT touch the form's CSS, the h1's CSS, or any other selector. Per AC #14.
- ❌ DO NOT touch the list rendering branch's JSX. Per AC #14.
- ❌ DO NOT add a "0 tasks" stats line in any branch. Per AC #14.
- ❌ DO NOT modify `web/src/api.ts`. Per AC #15.
- ❌ DO NOT modify `web/index.html` (Story 3.2 owns viewport meta). Per AC #15.
- ❌ DO NOT modify `web/vite.config.ts`. Per AC #15.
- ❌ DO NOT modify `api/`, `db/`, `compose.yaml`, `Caddyfile`, `e2e/`, `README.md`. Per AC #16.
- ❌ DO NOT add `useReducedMotion()` checks (no animation = no need).
- ❌ DO NOT add a Storybook story for the empty state. Out of scope; no Storybook in Phase 0.
- ❌ DO NOT add a unit test for the empty-state copy (`expect(screen.getByText("Nothing here yet.")).toBeInTheDocument()`). Per AC #16 and Story 2.7's smoke-test-only constraint.
- ❌ DO NOT add the empty-state strings to a constants file or i18n catalog. Per AC #23.
- ❌ DO NOT bump dep versions while in here. Per AC #21.
- ❌ DO NOT skip the contrast verification (AC #19). It's the documented NFR17 evidence.
- ❌ DO NOT skip the smoke-test re-run (Task 9). It's the regression check that the JSX change did not break the smoke test.
- ❌ DO NOT change the className from `empty-state` to anything else (`empty-list`, `no-tasks`, `intro-state`). Per AC #5.
- ❌ DO NOT use BEM-style class names (`empty-state__primary`). Use the simple dash-separated names per AC #5.
- ❌ DO NOT change `padding: 2rem 0` to a horizontal value (`padding: 0 2rem`). Per Dev Notes rationale.
- ❌ DO NOT change `font-size: 1.125rem` and `0.95rem` (precise sizes selected for hierarchy without harshness).
- ❌ DO NOT change `font-weight: 500` to `bold` or `600`. Medium weight is the deliberate choice.
- ❌ DO NOT change the colors from `#2a2333` and `#6b6375`. The contrast ratios in AC #5 are calibrated to these specific values.
- ❌ DO NOT introduce dark-mode support. Out of scope for this story; future polish.

### Conventions reinforced by this story

- **Polish = restraint.** "Designed" does not mean "decorated"; it means "intentional copy + intentional spacing".
- **One callsite = no abstraction.** No EmptyState component until a second callsite exists.
- **Vanilla CSS with literal hex colors.** No CSS variables, no theme tokens, no design system file.
- **WCAG verification is recorded in Completion Notes.** Contrast measurements live in the audit trail, not in the code.
- **`aria-live="polite"` for state-region announcements.** Matches the toast's `role="alert"` (more urgent) — the empty state is informational, not urgent.
- **No imagery in Phase 0.** Brand and illustration are Phase 1 concerns.

### What this story does NOT touch

- `web/src/App.tsx` outside the empty-state branch — h1, form, error toast, list-rendering branch all preserved.
- `web/src/App.css` outside the appended block — main, h1, ul, li, p, form, input, button, .error-toast all preserved.
- `web/src/api.ts` — no changes.
- `web/index.html` — Story 3.2 owns viewport meta.
- `web/vite.config.ts` — no changes.
- `api/`, `db/`, `compose.yaml`, `Caddyfile`, `e2e/` — backend and deploy stack untouched.
- `README.md` — Story 3.3 owns the rewrite.

### Source citations

- `web/src/App.tsx:32` (post-2.5 state) — empty-state branch under modification.
- `web/src/App.css` (post-2.5 state) — file under modification, append-only.
- `_bmad-output/planning-artifacts/epics.md#Story 3.1` (lines 533-549) — source-of-truth for AC.
- `_bmad-output/planning-artifacts/prd.md#FR21` (line 533) — "deliberately designed empty state".
- `_bmad-output/planning-artifacts/prd.md#FR22` (line 534) — "no signup prompt, tour overlay, welcome modal".
- `_bmad-output/planning-artifacts/prd.md#FR23` (line 535) — "first-time user can complete create/toggle/delete actions without external instruction".
- `_bmad-output/planning-artifacts/prd.md#NFR17` (line 649) — "Active-vs-completed task states meet WCAG AA contrast ratio".
- `_bmad-output/planning-artifacts/prd.md#NFR18` (line 653) — "first-time user can complete the full create/toggle/delete loop without external instruction".
- `_bmad-output/planning-artifacts/prd.md` line 192 — narrative inspiration for the copy ("not a generic blank list... 'this is intentional, not lazy'").
- `_bmad-output/planning-artifacts/architecture.md#3.1` — vanilla CSS, single file convention.
- `_bmad-output/planning-artifacts/architecture.md#5.3` — three-callsite extraction trigger.
- `_bmad-output/implementation-artifacts/2-2-list-and-create-tasks-in-the-ui.md` — form/input layout positions form between h1 and conditional render.
- `_bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md` — `.completed { text-decoration: line-through; opacity: 0.6; }` rule under verification.
- `_bmad-output/implementation-artifacts/2-5-error-surfacing-for-failed-mutations.md` AC #3 — toast position above conditional branches.
- `_bmad-output/implementation-artifacts/2-7-playwright-smoke-test-in-e2e.md` — selectors that must continue to work.
- WCAG 2.1 SC 1.4.3 (Contrast Minimum, AA) — 4.5:1 for normal text.

## Dev Agent Record

### Context Reference

- Story epic: `_bmad-output/planning-artifacts/epics.md#Story 3.1`
- Architecture: `_bmad-output/planning-artifacts/architecture.md#3.1`, `#5.3`
- Predecessors: Stories 2.2–2.5 (form, list, toggle, delete, error toast)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

<!--
Dev MUST fill (per AC #6, #18, #19, #20, #24):
- Build outcome and new bundle size:
- .empty-state-primary measured contrast ratio (#2a2333 on white):
- .empty-state-hint measured contrast ratio (#6b6375 on white):
- .completed measured contrast ratio (and whether AC #6 fallback was applied):
- Empty-state visual sanity (incognito, fresh DB):
- NFR1 perf observation (< 1 second):
- Screenshot saved at: _bmad-output/implementation-artifacts/3-1-empty-state-screenshot.png
- Smoke test outcome (Story 2.7 still passes):
- Commit SHA at verification:
-->

### File List

<!--
Expected entries:
- web/src/App.tsx (modified — empty-state branch only)
- web/src/App.css (modified — appended .empty-state block)
- _bmad-output/implementation-artifacts/3-1-empty-state-screenshot.png (new — verification artifact, not shipped)
-->

## Change Log

| Date       | Version | Description                                                              | Author |
| ---------- | ------- | ------------------------------------------------------------------------ | ------ |
| 2026-04-29 | 0.1     | Initial story draft created (status: ready-for-dev)                      | sm     |
