# Story 3.2: Mobile and responsive behavior

Status: review

## Story

As any individual opening the app on an iPhone,
I want the app to render without horizontal scroll and with comfortably-sized touch targets,
So that mobile use is viable without a dedicated mobile design pass.

## Acceptance Criteria

**Given** the polished empty state from Story 3.1 and the working CRUD from Epic 2
**When** I update `web/index.html` and `web/src/App.css` for responsive behavior
**Then** the `<head>` of `index.html` contains `<meta name="viewport" content="width=device-width, initial-scale=1">` — covers FR26
**And** opening the deployed URL on a real iPhone-width viewport (verified on a real device, not browser devtools per PRD §Responsive Design) shows no horizontal scroll — covers FR24
**And** the real-device verification produces a documentary artifact: a screenshot committed to `docs/` (e.g., `docs/mobile-verification.png`) OR a one-line entry in the README's persistence-verification section noting the device model, iOS version, and date of the test
**And** all interactive elements (the add input, Add button, each task's checkbox, each task's Delete button) present a touch target of at least 44 pixels in their smallest dimension on mobile viewports — covers FR25
**And** the layout uses CSS that adapts to viewport width (e.g., max-width container with side padding, no fixed pixel widths that would overflow narrow viewports)
**And** the styling lives in `web/src/App.css` (single vanilla CSS file)
**And** out of scope for this story (deferred per PRD §Responsive Design): tablet-specific layout, landscape-specific layout, swipe gestures, pull-to-refresh

## Dev Notes

### Architectural alignment & locked decisions

1. **`web/index.html` ALREADY contains the viewport meta tag** — line 6 of the current file is `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` (Vite's React-TS template ships this by default; verified via `Read` of the current file state). AC #1 (FR26) is therefore SATISFIED by the existing scaffold and requires NO change to `index.html`. The dev MUST verify this is still the case at story-start (a future scaffolding tweak could have removed it) and document the verification in Completion Notes. The literal value `1.0` (vs `1`) is acceptable — both are valid CSS numeric values; the AC says "contains" not "equals". DO NOT change `1.0` to `1` for cosmetic reasons. [Source: web/index.html:6, prd.md#FR26 (line 541), epics.md#Story 3.2 AC ("the `<head>` of `index.html` contains")]

2. **`web/src/App.css` GAINS new rules for touch-target sizing and mobile-safe layout** — appended after the existing `.empty-state-hint` block (added by Story 3.1), at the end of the file. The new rules target the existing DOM elements established by Stories 2.2/2.3/2.4: `<form>`, `<input>` (the add-task field), `<button type="submit">` (the Add button), each `<li>`, each `<input type="checkbox">` (the toggle), each `<button>` (the Delete button). NO new className needed for any element — touch-target sizing is applied via element selectors (`form input`, `form button`, `li button`, `li input[type="checkbox"]`) so the dev does NOT have to modify `App.tsx` to add classes. [Source: web/src/App.css (post-3.1 state), Stories 2.2/2.3/2.4 (DOM structure), AC #4]

3. **The 44-pixel minimum applies to BOTH `width` AND `height`** for tap targets — this is the WCAG 2.1 Success Criterion 2.5.5 (Target Size, Level AAA) and Apple HIG (Human Interface Guidelines) recommendation. The "smallest dimension" wording in the AC means: a button must be ≥44px wide AND ≥44px tall. A 200px-wide × 30px-tall button FAILS (height < 44). A 44px × 44px square PASSES. The dev MUST size the controls explicitly via CSS `min-height` (and `min-width` where the element would otherwise be narrower than its content). [Source: prd.md#FR25 (line 540), WCAG 2.1 SC 2.5.5, Apple HIG]

4. **The locked CSS rules to APPEND to `web/src/App.css`** are EXACTLY:
    - `form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }` — flex layout for the add-task form so the input grows to fill space and the Add button sits beside it. `gap: 0.5rem` provides breathing room. The `margin-bottom: 1rem` separates the form from the list/empty-state below it. (NOTE: if Story 2.2 already added a `form` rule with these properties, RECONCILE — do NOT duplicate; merge missing properties into the existing rule, leaving Story 2.2's locked properties intact. Verify by grepping `App.css` for `^form` before appending.)
    - `form input { flex: 1; min-height: 44px; padding: 0.5rem 0.75rem; font-size: 16px; box-sizing: border-box; }` — `flex: 1` makes the input fill remaining horizontal space. `min-height: 44px` satisfies the touch-target floor. `padding` provides visual comfort (the height comes from min-height, padding adds internal spacing for the text caret). `font-size: 16px` is REQUIRED to prevent iOS Safari from auto-zooming on focus (Safari zooms inputs with `font-size < 16px`); use the `px` unit literally — DO NOT convert to `1rem` because rem can be overridden by user font-size preferences and lose the 16px guarantee. `box-sizing: border-box` ensures `min-height: 44px` is the OUTER height (not content-box) so padding doesn't push it past expectation.
    - `form button { min-height: 44px; min-width: 44px; padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; }` — `min-height` AND `min-width: 44px` for the Add button. `padding: 0.5rem 1rem` makes the visible button comfortable. `cursor: pointer` is desktop-affordance. NO `background:` or `color:` — let the browser default render; this story is layout/sizing, not visual restyling.
    - `li { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; }` — REPLACES the existing `li { margin: 0.25rem 0; }` rule from Story 1.4. The flex layout horizontally aligns the checkbox, description, and Delete button. `align-items: center` vertically centers them. `min-height: 44px` ensures the WHOLE ROW is a tappable region (so hitting near the description text still satisfies the touch-target requirement for the row's controls). NOTE: removing `margin: 0.25rem 0` is intentional — `gap` on the parent `<ul>` (added below) provides equivalent spacing without needing per-item margin.
    - `ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }` — REPLACES the existing `ul { list-style: disc; padding-left: 1.5rem; margin: 0; }` rule from Story 1.4. The disc bullets are removed (`list-style: none`) because they look out-of-place with the flex-row task items and add no semantic value (the `<ul>` itself is the structure). `padding: 0` removes the indent reserved for bullets. The `display: flex; flex-direction: column; gap: 0.25rem` replaces per-item margin with gap-based spacing.
    - `li input[type="checkbox"] { min-width: 44px; min-height: 44px; margin: 0; cursor: pointer; }` — explicitly sizes the checkbox. NOTE: native checkboxes default to ~13–16px and ignore `width`/`height` in some browsers. To guarantee the touch target, the rule uses `min-width`/`min-height`; on browsers where the native checkbox refuses to grow, the surrounding clickable area (rendered via the parent `<li>`'s flex layout) still provides the 44px row height. DO NOT replace the native checkbox with a custom-styled `<div>` — this is out of scope (custom checkbox styling is Phase 1 polish; the native control is accessible by default and meets functional requirements).
    - `li button { min-height: 44px; min-width: 44px; padding: 0.25rem 0.75rem; font-size: 0.95rem; cursor: pointer; }` — explicitly sizes the per-row Delete button. Same reasoning as the form button rule.
    - `li span { flex: 1; }` — IF Stories 2.2/2.3 wrap the description text in a `<span>` (locked DOM is `<li><input type="checkbox">…<span>{description}</span><button>Delete</button></li>`). The `flex: 1` makes the description fill the horizontal space between the checkbox and the Delete button. If 2.3 placed the description in a different element, ADAPT this selector accordingly. (Verify by reading Story 2.3 and/or the post-2.3 `App.tsx`.)
    - NO `@media` queries — the rules above apply at ALL viewport widths (the layout is mobile-first and works as-is on desktop because the existing `main { max-width: 640px; ... }` constrains the desktop width). A media query would add complexity for no gain in the Phase 0 scope. [Source: epics.md#Story 3.2 ACs, prd.md#FR24/25/26, MDN CSS box-sizing, Apple HIG (touch targets), Stories 1.4/2.2/2.3/2.4 DOM]

5. **The `main { max-width: 640px; margin: 0 auto; padding: 2rem 1rem; }` rule from Story 1.4 IS THE RESPONSIVE CONTAINER** and MUST be preserved unchanged. The combination of `max-width: 640px` + `margin: 0 auto` + `padding: ... 1rem` already satisfies AC #5 ("max-width container with side padding, no fixed pixel widths that would overflow"). On a 375px-wide iPhone viewport, the 640px max-width is irrelevant (the container shrinks to fit the parent), and the `padding: 2rem 1rem` provides 1rem (16px) of breathing room on each side. The dev MUST verify this rule is still present before adding new rules; if a previous story modified it, restore it. [Source: web/src/App.css:1-5 (post-1.4 state, preserved through 3.1), AC #5]

6. **The h1 rule from Story 1.4 (`h1 { margin: 0 0 1.5rem; font-size: 2rem; font-weight: 600; }`)** MUST be preserved. The `2rem` (32px) heading font is comfortable on mobile; no responsive font-size adjustment is needed in Phase 0. DO NOT add `clamp()`, `vw`-based font-sizing, or media queries to scale the heading. [Source: web/src/App.css:7-11 (post-1.4 state)]

7. **Touch-target verification on real device is REQUIRED** — AC #3 specifies "verified on a real device, not browser devtools per PRD §Responsive Design". Browser devtools' device-emulation mode does NOT exercise the native iOS Safari touch-handling, viewport-zoom-on-input behavior, or the actual finger-vs-pixel relationship; the PRD is explicit (line 325) that a real device is required. The dev MUST: (a) deploy or run the app such that it's reachable from a phone (localhost via local-network IP, or the deployed URL from Story 1.5), (b) open it on an iPhone, (c) verify no horizontal scroll, (d) tap each interactive element with a finger to confirm the touch target is comfortable. [Source: prd.md line 325 ("verified on real device, not devtools"), epics.md#Story 3.2 AC #3]

8. **The documentary artifact (AC #3) MUST be ONE of two forms** — the dev picks ONE:
    - **Form A: Screenshot.** Capture a screenshot on the iPhone (volume-up + side-button on iPhone X+; home + side-button on iPhone 8 and earlier), AirDrop or email it to the dev workstation, save it as `docs/mobile-verification.png` (create the `docs/` directory if it doesn't exist; this is the FIRST file in `docs/`), commit it. The screenshot SHOULD show the app rendered with at least one task in the list (so the touch targets are visible) on the iPhone's screen; the system status bar / time display IS acceptable to include (it documents the device).
    - **Form B: README one-liner.** Add a SINGLE line at the END of the `## Persistence verification` section of `README.md` (the section established by Story 2.6) in this exact format: `Mobile-verified on iPhone {model}, iOS {version}, {YYYY-MM-DD}.` Example: `Mobile-verified on iPhone 15 Pro, iOS 18.2, 2026-04-29.` This is a SINGLE markdown paragraph, NOT a sub-heading, NOT a bullet, NOT a table row. Append it after the existing scenarios from Story 2.6 (which Story 2.7 may have already extended with the smoke-test note).
    - DEFAULT to Form A IF the dev has access to a real iPhone AND can save a screenshot file. DEFAULT to Form B IF the dev does not have a real iPhone available and is documenting verification by some other means (a borrowed device, a friend's phone, a tested-by-proxy report). The Form B fallback acknowledges that real-device access cannot always be guaranteed; the README line provides accountability without blocking the story.
    - [Source: epics.md#Story 3.2 AC #3 ("a screenshot committed to `docs/` ... OR a one-line entry in the README")]

9. **The `docs/` directory does NOT YET EXIST** in the repo. If choosing Form A, create it at the project root (`mkdir docs/` from the repo root). The directory's purpose is project-wide documentation artifacts (verification screenshots, future architecture diagrams, etc.) — distinct from `_bmad-output/` (which is workflow artifacts) and from inline README content. If choosing Form A, the directory will contain a single file: `mobile-verification.png`. NO additional files in `docs/` for this story. [Source: epics.md#Story 3.2 AC #3, repository conventions]

10. **NO `@media (min-width: ...)` or `@media (max-width: ...)` queries.** All CSS rules apply at all viewport widths. The mobile-first design with max-width container handles both narrow and wide viewports without media-query branching. Adding a media query for a "desktop layout" or "tablet layout" is OUT OF SCOPE per AC #7. [Source: AC #7, epics.md#Story 3.2 AC ("out of scope ... tablet-specific layout, landscape-specific layout")]

11. **NO landscape-specific styling, NO orientation media queries** (`@media (orientation: landscape)`), NO `@media (hover: none)`, NO touch-detection feature queries. The single set of rules works in portrait, landscape, on touch devices, and on hover devices. [Source: AC #7]

12. **NO swipe gestures, NO pull-to-refresh, NO touch-event handlers.** The app uses standard click/tap (which iOS Safari translates from taps to clicks automatically) for all interactions. Adding `touchstart`/`touchend` listeners or custom gesture detection is OUT OF SCOPE per AC #7. [Source: AC #7, epics.md#Story 3.2 AC]

13. **NO new dependencies.** Specifically: NO `react-responsive`, NO `react-device-detect`, NO `polished`, NO `tailwindcss`, NO `postcss-preset-env`, NO autoprefixer (Vite's built-in `lightningcss` handles vendor prefixes for the rules above; no manual `-webkit-` prefixes are needed for `flex`, `gap`, `min-height`, `box-sizing`, or `font-size` on any browser shipped in the last 5+ years). The package.json files in `web/`, `api/`, and the root remain unchanged. [Source: architecture.md#3.1 (no new deps in Phase 0), AC #6]

14. **NO `App.tsx` changes.** This story's complete file-change set is exactly: `web/index.html` (verified-only — likely unchanged), `web/src/App.css` (modified — replace `ul`/`li` rules + append form/button/checkbox rules), and ONE OF: `docs/mobile-verification.png` (new — Form A) OR `README.md` (modified — Form B one-liner). Specifically, do NOT add `className="mobile-form"` or any new className to JSX elements; the CSS uses element selectors. [Source: AC #6, architecture.md#5.3 (avoid premature abstraction)]

15. **NO touch-target rules on the empty-state region.** Story 3.1 locked `.empty-state` as text on whitespace with NO interactive elements. The 44px touch-target floor applies to interactive elements only (the input, the buttons, the checkbox); the empty-state paragraphs are non-interactive and have no touch-target requirement. DO NOT add `min-height: 44px` to `.empty-state-primary` or `.empty-state-hint`. [Source: WCAG 2.1 SC 2.5.5 (target size applies to interactive controls), Story 3.1]

16. **NO touch-target rules on the error toast.** Story 2.5 locked `.error-toast` with a `<button>` close control inside a `<p role="alert">`. The 44px touch-target floor DOES apply to the toast's close button. Verify Story 2.5's `.error-toast button` rule (or the equivalent) results in ≥44px tap target on mobile; if it does not (e.g., if the button is a 16px-square `×`), ADD a rule `.error-toast button { min-width: 44px; min-height: 44px; }` to this story's CSS append block. The dev MUST inspect Story 2.5's locked CSS (`_bmad-output/implementation-artifacts/2-5-error-surfacing-for-failed-mutations.md` "Locked code skeleton — App.css") and confirm. [Source: Story 2.5, WCAG 2.1 SC 2.5.5]

17. **The dev MUST verify the change visually in a real browser** before marking the story `done`: load `http://localhost` (or the deployed URL) on a desktop browser AND on an iPhone (per AC #3). On desktop, confirm the form/list layout looks correct (input grows, button is comfortably sized, list items are flex rows). On iPhone, confirm no horizontal scroll, tap each control, confirm the input does NOT auto-zoom on focus (a sign that `font-size: 16px` is correctly applied). Record observations in Completion Notes. [Source: prd.md#NFR18, AC #2/3/4]

18. **The dev MUST measure horizontal scroll on the narrowest realistic mobile viewport** — the iPhone SE (1st gen, 320px) is the conservative floor, but most users are on 375px+ devices (iPhone 13 mini and newer). Verify on the actual device or, if devtools is the only available method (acknowledging AC #3 prefers real device), use Chrome devtools' device emulation set to "iPhone SE" (375 × 667) AND "iPhone 14 Pro Max" (430 × 932). The horizontal scrollbar MUST NOT appear at any of these widths. If it does, the most likely cause is a fixed-width child or an overflow from the form's input — debug by inspecting the offending element. [Source: prd.md#FR24, real-world iPhone resolutions]

19. **NO PWA manifest, NO `apple-touch-icon`, NO splash screen, NO `theme-color` meta tag.** PWA installability and home-screen iconography are OUT OF SCOPE for Phase 0 (would require a separate manifest.json, icon assets at multiple resolutions, service worker for offline — none of which appear in the PRD/epics). The viewport meta tag in AC #1 is the ONLY mobile-related `<meta>` directive added. [Source: epics.md#Story 3.2 ACs (no PWA mentioned), Phase 0 scope discipline]

20. **NO service worker, NO offline support, NO `navigator.onLine` checks.** The app is online-only in Phase 0; offline behavior is undefined and not tested. [Source: PRD scope (Phase 0 is online-only)]

21. **NO `prefers-reduced-motion`, NO `prefers-color-scheme` media queries.** No animations exist in the app (Story 3.1 explicitly forbade them); reduced-motion has nothing to attach to. Dark mode is not in Phase 0; the existing white background remains the only theme. [Source: Story 3.1 (no animations), Phase 0 scope]

22. **NO `min-width` on `main`** — the `max-width: 640px` from Story 1.4 is the upper bound; the lower bound is the viewport width (with `padding: ... 1rem` providing the inset). Adding `min-width` would force horizontal scroll on viewports narrower than the min, which is exactly what FR24 prohibits. [Source: AC #2 (no horizontal scroll), web/src/App.css:1-5]

23. **NO `text-size-adjust` CSS property** — modern Safari respects user-zoom preferences without this hint, and adding it can interfere with the iOS auto-zoom-on-input behavior that the `font-size: 16px` rule is precisely designed to prevent. Leave it off. [Source: MDN text-size-adjust quirks, font-size: 16px logic]

24. **NO storybook entries, NO accessibility audit reports, NO Lighthouse score targets** introduced by this story. Verification is manual (real-device test per AC #3), not automated. A future Phase 1 story may introduce Lighthouse CI; this story does not. [Source: architecture.md#3.5 (smoke-test-only test surface), Phase 0 scope]

25. **The dev MUST NOT modify `web/src/main.tsx`, `web/src/api.ts`, `web/src/App.tsx`, `api/src/db.ts`, `api/src/server.ts`, or any file under `db/` or `e2e/`.** This story's scope is layout/sizing CSS plus (optionally) one verification artifact. Touching API code, frontend logic, the database schema, or E2E tests is out of scope and would indicate scope creep. [Source: AC #6, scope discipline]

26. **The dev MUST verify Story 3.1's empty-state CSS still renders correctly after this story's changes** — the new `ul`/`li` rules don't apply when the empty-state branch is rendered (different DOM), but the `form input { font-size: 16px; }` rule changes the input's apparent size, which could affect the visual relationship between the form and the empty state below it. Visual sanity-check both states (empty list AND populated list) on both desktop AND mobile after the changes. [Source: Story 3.1 (locked empty-state), this story's `form input` rule]

### Touch-target measurement methodology (real device + devtools)

**Why real device matters (PRD §Responsive Design, line 325):**
Browser devtools emulation simulates the viewport width and device-pixel-ratio but does NOT simulate:
- iOS Safari's auto-zoom-on-input-focus when font-size < 16px
- Native checkbox rendering size (varies by iOS version)
- Actual finger-vs-pixel relationship (a 44px button feels different on a 6.1" Retina display vs a desktop screen at 100% zoom)
- iOS Safari's bottom toolbar that shrinks the visible viewport during scroll

**Verification recipe:**

```bash
# Step 1: Find the local IP of the dev workstation (so the iPhone on the same Wi-Fi can reach it)
ipconfig getifaddr en0    # macOS Wi-Fi
# → e.g., 192.168.1.42

# Step 2: Make sure the dev stack is running and the web server is bound to 0.0.0.0 (or the interface IP)
# Vite dev server defaults to localhost-only; for this test, run:
cd web && npm run dev -- --host   # binds to 0.0.0.0
# OR use the deployed URL from Story 1.5 (Caddy + HTTPS) which is already reachable from anywhere

# Step 3: On the iPhone, open Safari (NOT Chrome — Chrome on iOS uses WebKit but rendering quirks differ):
# → Navigate to http://192.168.1.42:5173 (Vite dev) OR https://your-deployed-url (Caddy)

# Step 4: Verify no horizontal scroll
# → Try to scroll the page sideways with one finger. If it doesn't move, no horizontal overflow exists.
# → Look at the right edge of the viewport — there should be no clipped content.

# Step 5: Tap each interactive element
# → Tap the add-task input. Confirm the iOS keyboard appears WITHOUT the page zooming in.
#   (If the page zooms, font-size < 16px is the cause; check `form input` rule.)
# → Type a task, tap "Add". Confirm the button feels easy to hit (not requiring careful aim).
# → Tap the checkbox on a task. Confirm it toggles without misfire.
# → Tap "Delete" on a task. Confirm it deletes without misfire.

# Step 6: Capture documentary artifact (Form A: screenshot)
# → On iPhone X+: press Volume-Up + Side button simultaneously
# → On iPhone 8 and earlier: press Home + Side button simultaneously
# → AirDrop the screenshot to the dev workstation, save as docs/mobile-verification.png
# → Commit it with this story's changes.

# Step 6 alternative (Form B: README line)
# → Add to README.md at the end of "## Persistence verification" section:
#   Mobile-verified on iPhone 15 Pro, iOS 18.2, 2026-04-29.
```

**Devtools fallback (if real device unavailable — discouraged but documented):**

```bash
# Open Chromium devtools (F12 or Cmd+Option+I)
# → Click the device-toolbar icon (top-left of devtools, looks like a phone+tablet)
# → From the device dropdown, select "iPhone SE" (375×667) — narrowest realistic
# → Reload the page
# → Verify no horizontal scrollbar appears at the bottom of the viewport
# → Click on each interactive element and confirm it's clickable (devtools simulates touch as click)
# → Switch device to "iPhone 14 Pro Max" (430×932) — widest realistic
# → Repeat checks
# → Document devtools-only verification in Completion Notes (NOT a substitute for real-device per AC #3, but acceptable evidence if real-device access genuinely impossible)
```

### Locked code skeleton — `web/src/App.css` (additions and replacements)

The dev MUST produce CSS structurally equivalent to the following. The existing `main`, `h1`, `p`, `.empty-state*`, `.error-toast*`, and (any other locked) rules MUST be preserved in their existing positions; the rules below REPLACE the existing `ul` and `li` rules and APPEND new rules at the end of the file (after `.empty-state-hint`).

```css
/* ===== EXISTING (preserve) ===== */
/* main { max-width: 640px; margin: 0 auto; padding: 2rem 1rem; }       — Story 1.4 */
/* h1   { margin: 0 0 1.5rem; font-size: 2rem; font-weight: 600; }       — Story 1.4 */
/* p    { margin: 0; color: #6b6375; }                                   — Story 1.4 */
/* (Story 2.2/2.3/2.4 rules, if any, preserved as-is unless replaced below) */
/* .error-toast { ... }                                                  — Story 2.5 */
/* .empty-state* { ... }                                                 — Story 3.1 */

/* ===== REPLACE ul (was: list-style: disc; padding-left: 1.5rem; margin: 0;) ===== */
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* ===== REPLACE li (was: margin: 0.25rem 0;) ===== */
li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
}

/* ===== APPEND (at end of file, after .empty-state-hint) ===== */
form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

form input {
  flex: 1;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  font-size: 16px;
  box-sizing: border-box;
}

form button {
  min-height: 44px;
  min-width: 44px;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
}

li input[type="checkbox"] {
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  cursor: pointer;
}

li button {
  min-height: 44px;
  min-width: 44px;
  padding: 0.25rem 0.75rem;
  font-size: 0.95rem;
  cursor: pointer;
}

li span {
  flex: 1;
}
```

### Reconciliation with prior stories' CSS

Stories 2.2, 2.3, and 2.4 may have added their own `form`, `form input`, `form button`, `li`, `li button`, or `li input[type="checkbox"]` rules to `App.css`. The dev MUST:

1. **Read the current `web/src/App.css`** in full before making changes.
2. **For each locked rule in this story's skeleton, check if a rule with the same selector already exists.**
3. **If an existing rule exists:** MERGE the properties — preserve any properties locked by prior stories that are NOT in conflict with this story; ADD missing properties from this story; CHANGE properties only where this story's locked value supersedes (e.g., this story's `min-height: 44px` on `form input` MUST win over any prior 32px or unspecified height).
4. **If no existing rule exists:** ADD it per the skeleton above.
5. **Document the reconciliation in Completion Notes** — list each selector and whether it was new, merged, or replaced; show the final rule.

The most likely conflicts:
- `ul`/`li` from Story 1.4 (replaced — see skeleton).
- `form` from Story 2.2 (likely added a layout rule — merge `min-height` and `font-size` into `form input` if 2.2 added one without these).
- `li button` from Story 2.4 (Delete button — likely added some styling — merge `min-height: 44px; min-width: 44px;`).
- `li input[type="checkbox"]` from Story 2.3 (toggle — likely no width/height rule yet — add the new rule).

### Anti-patterns (do not do these)

- ❌ DO NOT add `<meta name="apple-mobile-web-app-capable">`, `<meta name="theme-color">`, or any other PWA-related `<meta>` tag. Per AC #19.
- ❌ DO NOT add a `manifest.json`, `apple-touch-icon.png`, or service worker. Per AC #19/20.
- ❌ DO NOT install `tailwindcss`, `react-responsive`, `react-device-detect`, or any other dependency. Per AC #13.
- ❌ DO NOT use `@media (max-width: 768px)` or any other media query. Per AC #10.
- ❌ DO NOT use `vw`, `vh`, `clamp()`, `min()`, or `max()` units for font-size or layout dimensions in this story. Per AC #6 (simple rules).
- ❌ DO NOT use `font-size: 1rem` on `form input` (1rem is 16px by default but can be overridden by user font-size preferences); use literal `16px` to GUARANTEE iOS Safari does not auto-zoom on focus. Per AC #4.
- ❌ DO NOT replace native `<input type="checkbox">` with a custom `<div role="checkbox">` for "better styling". Per AC #4.
- ❌ DO NOT add `touchstart`/`touchend` event listeners or any custom gesture handling. Per AC #12.
- ❌ DO NOT add `swipe-to-delete`, `pull-to-refresh`, or any other gesture-driven interaction. Per AC #12 / AC #7.
- ❌ DO NOT add `transition`, `animation`, or any motion-related property. Story 3.1 forbade animations; this story preserves that constraint.
- ❌ DO NOT add `prefers-color-scheme: dark` styles. Per AC #21.
- ❌ DO NOT add `prefers-reduced-motion: reduce` styles. Per AC #21.
- ❌ DO NOT add `text-size-adjust: 100%`. Per AC #23.
- ❌ DO NOT add `min-width` to `main` or `body`. Per AC #22.
- ❌ DO NOT add `overflow-x: hidden` on `body` or `html` to "fix" horizontal scroll — fix the underlying overflow source instead. Per AC #2 (no horizontal scroll = no overflow at all, not hidden overflow).
- ❌ DO NOT add `width: 100vw` anywhere — `100vw` includes the scrollbar's width on some platforms and causes horizontal overflow. Use `width: 100%` or rely on default block layout.
- ❌ DO NOT add `position: fixed` headers, footers, FABs, or any other fixed positioning. Phase 0 layout is plain document flow.
- ❌ DO NOT change the empty-state rules from Story 3.1. Per AC #15 / Story 3.1's locked rules.
- ❌ DO NOT add a hamburger menu, navigation drawer, or any navigation chrome — there's nothing to navigate to in Phase 0.
- ❌ DO NOT add `<picture>` elements with multiple sources for the screenshot — `docs/mobile-verification.png` is a single PNG.
- ❌ DO NOT compress, resize, or crop the verification screenshot to a thumbnail — committed as captured (the iPhone screenshot's natural dimensions are ~1170×2532 px or similar; ~500KB-2MB is acceptable file size).
- ❌ DO NOT take the screenshot in dark mode or with a non-default theme — the app has only one theme (white background, default text colors).
- ❌ DO NOT add `import './App.css'` to other components (it's already imported once by `App.tsx`); a duplicate import would inline the CSS twice.
- ❌ DO NOT add a unit test, integration test, or E2E test for touch-target sizes. Manual real-device verification per AC #3 is the only test.
- ❌ DO NOT add `aria-label="Add task"` or any other ARIA labels to controls in this story — visible text labels are the accessible name; ARIA is unnecessary. (Prior stories may have added them; preserve those.)
- ❌ DO NOT modify `.gitignore` to exclude `docs/` — the screenshot SHOULD be committed.
- ❌ DO NOT add the screenshot to `.gitattributes` as LFS-tracked — it's a small PNG; standard git binary handling is fine.
- ❌ DO NOT modify `vite.config.ts` to change asset handling. Per AC #14.
- ❌ DO NOT add `<link rel="apple-touch-startup-image">` or splash-screen assets. Per AC #19.
- ❌ DO NOT enable `legacy` browser support in Vite — modern browsers are the only target.

### What this story does NOT touch

Out of scope (NEVER modify in this story):
- `web/src/App.tsx` (no JSX changes — CSS uses element selectors).
- `web/src/api.ts`, `web/src/main.tsx`, `web/vite.config.ts`, `web/tsconfig*.json`.
- `web/package.json` (no new deps — AC #13).
- `api/` directory (entire backend untouched).
- `db/` directory (schema untouched).
- `e2e/` directory (smoke test untouched — Story 2.7's surface is final).
- `docker-compose.yml`, `Caddyfile`, `Dockerfile*` (deployment untouched).
- The empty-state `.empty-state*` rules from Story 3.1 (preserved unchanged — AC #15).
- The error-toast `.error-toast*` rules from Story 2.5 (preserved unchanged; the `.error-toast button` rule is verified for ≥44px and amended only if needed — AC #16).
- The `main`/`h1`/`p` rules from Story 1.4 (preserved unchanged — AC #5/6).
- The `<meta name="viewport">` tag in `web/index.html` (verified-only; should already be present — AC #1 / Dev Note #1).

In scope (this story OWNS these):
- `web/src/App.css` — replace `ul`/`li` rules + append form/button/checkbox rules (Dev Note #4).
- ONE OF:
  - `docs/mobile-verification.png` (new — Form A documentary artifact — Dev Note #8/9), OR
  - `README.md` (modified — Form B one-line note appended to Persistence verification section — Dev Note #8).
- Verification of `web/index.html` viewport meta (read-only check — Dev Note #1).
- Touch-target verification on real iPhone (Dev Note #7, methodology section).

### Project Structure Notes

- `web/src/App.css`: target file for CSS append/replace.
- `web/index.html`: verification-only target (line 6 contains the viewport meta — confirm).
- `docs/mobile-verification.png` (new — IF Form A chosen): verification artifact, project root `docs/` directory.
- `README.md` (IF Form B chosen): one-line append to `## Persistence verification` section.
- `web/src/App.tsx:32` (post-3.1): empty-state branch — verified unchanged after this story's CSS reaches it.

### References

- `_bmad-output/planning-artifacts/epics.md#Story 3.2` (lines 551-567) — story source-of-truth.
- `_bmad-output/planning-artifacts/prd.md#FR24` (line 539) — no horizontal scroll on iPhone width.
- `_bmad-output/planning-artifacts/prd.md#FR25` (line 540) — touch targets ≥44px.
- `_bmad-output/planning-artifacts/prd.md#FR26` (line 541) — viewport meta directive.
- `_bmad-output/planning-artifacts/prd.md#NFR17` (line 649) — WCAG AA contrast (verified by Story 3.1; preserved here).
- `_bmad-output/planning-artifacts/prd.md#NFR18` (line 653) — first-time user completes loop without instruction.
- `_bmad-output/planning-artifacts/prd.md` line 325 — "verified on real device, not devtools".
- `_bmad-output/planning-artifacts/prd.md` line 593 — out-of-scope: tablet/landscape/swipe/pull-to-refresh.
- `_bmad-output/planning-artifacts/architecture.md#3.1` — vanilla CSS, single-file styling, no UI library.
- `_bmad-output/planning-artifacts/architecture.md#5.3` — three-callsite extraction trigger (avoid premature componentization).
- `_bmad-output/implementation-artifacts/3-1-designed-empty-state.md` — empty-state CSS preserved here.
- `_bmad-output/implementation-artifacts/2-5-error-surfacing-for-failed-mutations.md` — error-toast CSS; verify `.error-toast button` touch target.
- `_bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md` — checkbox DOM structure.
- `_bmad-output/implementation-artifacts/2-4-delete-task-delete-api-tasks-id-and-ui.md` — Delete button DOM structure.
- WCAG 2.1 SC 2.5.5 (Target Size, Level AAA) — 44×44 CSS-pixel minimum target size.
- Apple HIG: Layout — minimum touch target recommendation (44×44 pt).
- MDN: `<meta name="viewport">` — viewport configuration semantics.
- MDN: `box-sizing` — border-box vs content-box.

## Tasks / Subtasks

- [x] Task 1: Verify viewport meta tag in `web/index.html` (AC #1)
  - [x] Read `web/index.html`.
  - [x] Confirm line 6 (or any line in `<head>`) contains `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` (or the `1` variant).
  - [x] If missing: add it. If present: no change. Document the verification result in Completion Notes.

- [x] Task 2: Read existing `web/src/App.css` and identify reconciliation needs (Dev Note "Reconciliation")
  - [x] Read the full file.
  - [x] List every selector currently present (`main`, `h1`, `p`, `ul`, `li`, `form`, `form input`, `form button`, `li input[type="checkbox"]`, `li button`, `li span`, `.error-toast*`, `.empty-state*`, etc.).
  - [x] For each selector in this story's skeleton, decide: NEW / MERGE-INTO / REPLACE.
  - [x] Note the planned reconciliation; record in Completion Notes.

- [x] Task 3: Replace and append CSS rules in `web/src/App.css` (AC #4/5/6, Dev Note #4)
  - [x] REPLACE the `ul` rule with the new flex-column layout (Dev Note #4).
  - [x] REPLACE the `li` rule with the new flex-row layout + `min-height: 44px` (Dev Note #4).
  - [x] APPEND `form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }` (or merge into existing).
  - [x] APPEND `form input { ... font-size: 16px; ... }` (the literal 16px is critical for iOS).
  - [x] APPEND `form button { min-height: 44px; min-width: 44px; ... }`.
  - [x] APPEND `li input[type="checkbox"] { min-width: 44px; min-height: 44px; ... }`.
  - [x] APPEND `li button { min-height: 44px; min-width: 44px; ... }`.
  - [x] APPEND `li span { flex: 1; }` (verify Story 2.3's DOM has `<span>` for description; adjust selector if not).
  - [x] Save file.

- [x] Task 4: Verify `.error-toast button` touch target (Dev Note #16)
  - [x] Read Story 2.5's locked CSS (`_bmad-output/implementation-artifacts/2-5-error-surfacing-for-failed-mutations.md` "Locked code skeleton — App.css").
  - [x] Determine the toast close-button's locked dimensions.
  - [x] If < 44px in any dimension: APPEND `.error-toast button { min-width: 44px; min-height: 44px; }` to `App.css`.
  - [x] Document the decision in Completion Notes.

- [ ] Task 5: Build and run the stack (verification prep) — DEFERRED (Docker runtime)
  - [ ] Ensure the api + db + web stack runs (`docker compose up -d` OR `npm run dev` in `web/` + `api/`).
  - [ ] Confirm the app loads at `http://localhost` (or appropriate URL).
  - [ ] Add 2-3 sample tasks (so the list view, not just the empty state, is visible during verification).

- [ ] Task 6: Desktop visual verification (Dev Note #17) — DEFERRED (requires running stack)
  - [ ] Open the app in a desktop browser (Chrome, Firefox, or Safari).
  - [ ] Verify the form renders as a flex row: input fills space, Add button sits beside it.
  - [ ] Verify the list renders as flex rows: checkbox + description + Delete button per row.
  - [ ] Verify each row is ≥44px tall (use devtools' element inspector to confirm computed height).
  - [ ] Verify the Add button and Delete button are ≥44px in both dimensions.
  - [ ] Verify the empty-state branch (delete all tasks) still renders correctly per Story 3.1.

- [ ] Task 7: Mobile real-device verification (AC #2/3/4, Dev Note #7, methodology section) — DEFERRED (real device unavailable in batch-dev)
  - [ ] Reach the app from a real iPhone (local-network IP for dev, or deployed URL).
  - [ ] Open in iOS Safari.
  - [ ] Verify NO horizontal scroll (try to drag sideways; confirm no movement).
  - [ ] Tap the add-task input. CRITICAL: confirm the page does NOT auto-zoom (sign that `font-size: 16px` is correctly applied).
  - [ ] Type a task, tap "Add". Confirm the action succeeds.
  - [ ] Tap a checkbox. Confirm it toggles.
  - [ ] Tap "Delete" on a task. Confirm it deletes.
  - [ ] Note the device model + iOS version + date of verification.

- [ ] Task 8: Capture documentary artifact (AC #3, Dev Note #8/9) — DEFERRED (depends on Task 7)
  - [ ] Choose Form A (screenshot) OR Form B (README line) — see Dev Note #8 for choice criteria.
  - [ ] IF Form A: take iPhone screenshot, transfer to dev workstation, save as `docs/mobile-verification.png`. Create `docs/` directory if needed (`mkdir docs/`).
  - [ ] IF Form B: append the line `Mobile-verified on iPhone {model}, iOS {version}, {YYYY-MM-DD}.` to the END of the `## Persistence verification` section in `README.md`.
  - [ ] Document the choice in Completion Notes.

- [ ] Task 9: Sanity-check empty state and error toast still work (Dev Note #26) — DEFERRED (requires running stack)
  - [ ] Delete all tasks → confirm empty state renders per Story 3.1 (no regression).
  - [ ] Trigger an error (submit a 256+ char task) → confirm toast renders per Story 2.5; confirm toast's close button is ≥44px (per Task 4 decision).

- [x] Task 10: Anti-pattern self-audit
  - [x] Confirm NO new dependencies in `web/package.json`.
  - [x] Confirm NO `@media` queries in `App.css`.
  - [x] Confirm NO `<App.tsx>` changes.
  - [x] Confirm NO PWA-related `<meta>` tags or manifest files.
  - [x] Confirm NO `position: fixed`, `width: 100vw`, or `overflow-x: hidden` introduced.
  - [x] Confirm `font-size: 16px` (literal) on `form input` — NOT `1rem`.

- [x] Task 11: Update Dev Agent Record + flip status to `review`
  - [x] Fill in Completion Notes (reconciliation decisions, real-device test results, Form A/B choice, contrast/touch-target measurements).
  - [x] Update File List with: `web/src/App.css` (modified), `docs/mobile-verification.png` (new — IF Form A) OR `README.md` (modified — IF Form B), `web/index.html` (verified, no change).
  - [x] Update Change Log with v0.1 entry.
  - [x] In `_bmad-output/implementation-artifacts/sprint-status.yaml`, flip `3-2-mobile-and-responsive-behavior` from `ready-for-dev` to `review`. Bump `last_updated` comment.

## Dev Agent Record

### Context Reference

- _bmad-output/planning-artifacts/epics.md (Story 3.2 — lines 551-567)
- _bmad-output/planning-artifacts/prd.md (FR24/25/26 lines 539-541; NFR17/18 lines 649-653; line 325 real-device requirement)
- _bmad-output/planning-artifacts/architecture.md (§3.1 vanilla-CSS single-file, §3.5 smoke-test-only)
- _bmad-output/implementation-artifacts/3-1-designed-empty-state.md (empty-state CSS preserved)
- _bmad-output/implementation-artifacts/2-5-error-surfacing-for-failed-mutations.md (error-toast button touch-target verification)
- _bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md (checkbox DOM)
- _bmad-output/implementation-artifacts/2-4-delete-task-delete-api-tasks-id-and-ui.md (Delete button DOM)
- web/src/App.css (current state — read before reconciliation per Task 2)
- web/index.html (line 6 viewport meta — verified per Task 1)

### Agent Model Used

claude-opus-4.7 (github-copilot)

### Debug Log References

- `npm run build` (web): 0 TS errors. CSS bundle 1.75 kB (gzip 0.73 kB), up from 1.37 kB (gzip 0.65 kB) post-3.1. JS bundle 193.58 kB (gzip 61.03 kB) — unchanged. Build time ~85ms.
- `git diff web/package.json web/package-lock.json` → empty (AC #13 satisfied).

### Completion Notes

- **index.html viewport meta verification:** present at line 6 — `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`. NO change to `index.html` required (AC #1 satisfied by existing scaffold). Per Dev Note #1, `1.0` is acceptable (vs `1`).
- **App.css reconciliation decisions (per selector):**
  - `main` — PRESERVED unchanged (Story 1.4).
  - `h1` — PRESERVED unchanged (Story 1.4).
  - `p` — PRESERVED unchanged (Story 1.4).
  - `ul` — REPLACED. Removed `list-style: disc; padding-left: 1.5rem`; added flex-column + gap.
  - `li` — REPLACED. Removed `margin: 0.25rem 0`; added flex-row + `align-items: center` + `gap: 0.5rem` + `min-height: 44px`.
  - `form` — MERGED. Existing `display: flex; gap: 0.5rem; margin-bottom: 1.5rem`; changed `margin-bottom` to `1rem` per skeleton.
  - `input[type="text"]` (Story 2.2) → `form input` (this story). REPLACED selector. Preserved `border: 1px solid #d0c9d6`, `border-radius: 4px`, `font-family: inherit`, `flex: 1`, `padding: 0.5rem 0.75rem` (visual identity from 2.2). Added `min-height: 44px`, `box-sizing: border-box`. Changed `font-size: 1rem` → `font-size: 16px` (literal, iOS auto-zoom prevention).
  - `button` (general from 1.5/2.2) → split into `form button` and `li button`. REPLACED. Preserved `font-family: inherit`, `cursor: pointer`. Added `min-height: 44px`, `min-width: 44px` to both. `form button` retains `padding: 0.5rem 1rem`, `font-size: 1rem`. `li button` (Delete) gets `padding: 0.25rem 0.75rem`, `font-size: 0.95rem`.
  - `li input[type="checkbox"]` — NEW. `min-width: 44px; min-height: 44px; margin: 0; cursor: pointer`.
  - `li span` — NEW. `flex: 1` (description fills row between checkbox and Delete).
  - `.completed` — PRESERVED unchanged (Story 2.3 + 3.1 contrast verification).
  - `.error-toast` — PRESERVED unchanged (Story 2.5).
  - `.error-toast button` — MERGED. Story 2.5's locked rule used `padding: 0 0.25rem; font-size: 1.25rem; line-height: 1` → effective ~16-20px square (the `×` glyph). BELOW 44px floor per Dev Note #16. Added `min-width: 44px; min-height: 44px`.
  - `.empty-state*` — PRESERVED unchanged (Story 3.1).
- **Final App.css:** 109 lines total (up from 90 post-3.1). Selector list above is exhaustive.
- **`.error-toast button` touch-target decision:** Story 2.5's locked dimensions were ~16-20px square (font-size 1.25rem = 20px line-height 1, plus 0-0.25rem padding). Below the 44px floor per WCAG 2.1 SC 2.5.5 and Apple HIG. Per Dev Note #16, ADDED `min-width: 44px; min-height: 44px` to the existing `.error-toast button` rule (merge, not new rule). Verified rule is now ≥44×44.
- **Desktop browser used for verification:** DEFERRED — not run this batch-dev session.
- **Real-device used:** DEFERRED — no real iPhone available in batch-dev session per Gio's approval.
- **Real-device: horizontal scroll observed?:** DEFERRED.
- **Real-device: input auto-zoom on focus?:** DEFERRED. Note: `font-size: 16px` literal is correctly applied to `form input` per AC #4 / Dev Note #4; iOS auto-zoom prevention is satisfied at the code level.
- **Real-device: each control tappable comfortably?:** DEFERRED. Note: all interactive elements (form input, form button, li input[type="checkbox"], li button, .error-toast button) have explicit `min-width: 44px` AND `min-height: 44px` per WCAG 2.1 SC 2.5.5 + Apple HIG.
- **Empty-state regression check:** DEFERRED (requires running stack). Note: empty-state CSS (Story 3.1) is preserved byte-identical in `App.css`; the new `ul`/`li` rules don't apply to the empty-state branch (different DOM).
- **Error-toast regression check:** DEFERRED (requires running stack). Note: existing `.error-toast` rule preserved; only `.error-toast button` had `min-width`/`min-height` added.
- **Documentary artifact:** NEITHER Form A NOR Form B chosen — both require real-device verification, which is deferred. No `docs/mobile-verification.png` created; no README line added.
- **Anti-pattern audit results:**
  - NO new deps in `web/package.json` ✅ (`git diff` empty).
  - NO `@media` queries in `App.css` ✅.
  - NO `App.tsx` changes ✅.
  - NO PWA `<meta>` tags or manifest files ✅.
  - NO `position: fixed`, `width: 100vw`, or `overflow-x: hidden` introduced ✅.
  - `font-size: 16px` literal on `form input` ✅ (NOT `1rem`).
- **Deferral note:** Per Gio's batch-dev approval, runtime/Docker scenarios (Tasks 5–9) are explicitly deferred. The story is marked `review` (NOT `done`) to reflect that the AC #3 real-device verification — and the documentary artifact (Form A or B) it produces — are unfulfilled. AC #1 (viewport meta), AC #4 (touch-target sizing applied via CSS), AC #5/6 (max-width container + single-file CSS), and AC #7 (out-of-scope avoidance) are satisfied at the code level. AC #2 (no horizontal scroll on real iPhone) is asserted by code review (no fixed widths, no `100vw`, no `min-width` on `main`) but not measured.

### File List

- `web/index.html` — verified, no change (viewport meta already at line 6).
- `web/src/App.css` — modified (rewritten end-to-end via reconciliation: `ul`/`li` replaced, `form` margin updated, `input[type="text"]` → `form input` with new sizing, `button` → `form button` + `li button` with min-44px, NEW `li input[type="checkbox"]` and `li span`, `.error-toast button` gains min-44px).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — modified (header timestamp + 3-2 status flip).
- `docs/mobile-verification.png` — NOT created (Form A deferred runtime artifact).
- `README.md` — NOT modified (Form B alternative also deferred).

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                  | Author             |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-04-29 | 0.1     | Initial draft                                                                                                                                                                                                                                                                                | Bob (Scrum Master) |
| 2026-04-30 | 1.0     | Implemented locked CSS skeleton with full reconciliation against Stories 1.4/2.2/2.3/2.4/2.5/3.1. `npm run build` green. Status → review. Real-device verification (AC #3) and the Form A/B documentary artifact DEFERRED — no real iPhone available in batch-dev session per Gio's approval. | dev                |
