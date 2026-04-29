---
workflowStatus: 'in-progress'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan']
lastStep: 'step-04-coverage-plan'
nextStep: '{skill-root}/steps-c/step-05-generate-output.md'
lastSaved: '2026-04-29'
mode: 'epic-level'
target_epic: 'Epic 2 — Task CRUD — End-to-End Vertical Slice'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - knowledge/risk-governance.md
  - knowledge/probability-impact.md
  - knowledge/test-levels-framework.md
  - knowledge/test-priorities-matrix.md
---

# Test Design Progress

## Step 1: Mode Detection

- **Mode:** Epic-Level
- **Target Epic:** Epic 2 — Task CRUD — End-to-End Vertical Slice (7 stories: 2.1–2.7)
- **Inputs available:**
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/planning-artifacts/epics.md`
- **Rationale:** Epic 2 carries the PRD's "never cut" durability claims (FR7–FR11, NFR5–NFR7), all CRUD functional risk (FR1–FR6, FR14–FR18), error surfacing (FR29–FR30), and contains the project's only automated test (Story 2.7 Playwright smoke).

## Step 2: Load Context

### Configuration

- `tea_use_playwright_utils: true`
- `tea_use_pactjs_utils: false`
- `tea_pact_mcp: none`
- `tea_browser_automation: auto`
- `test_stack_type: auto` → **Detected: greenfield (no code yet)**; target stack per Architecture is **fullstack** (React 19 + Vite frontend, Node 24 + Express 5 backend, Postgres 17, Playwright in `e2e/`)
- `test_artifacts: _bmad-output/test-artifacts`
- `test_design_output: _bmad-output/test-artifacts/test-design`
- `risk_threshold: p1`

### Existing Test Coverage

- **Repository state:** Empty (no `package.json`, no `api/`, no `web/`, no `e2e/` yet)
- **Existing tests:** None — Epic 2's Story 2.7 will introduce the project's only automated test (single Playwright smoke spec per Architecture §3.5)
- **Coverage gap:** Total — this is greenfield Phase 0 work

### Knowledge Fragments Loaded (Epic-Level Required)

- `risk-governance.md` — scoring matrix, gate decision rules
- `probability-impact.md` — 1–9 scale, action thresholds (DOCUMENT/MONITOR/MITIGATE/BLOCK)
- `test-levels-framework.md` — unit/integration/e2e selection
- `test-priorities-matrix.md` — P0–P3 mapping

### Architectural Constraints That Shape Tests

- **Single Playwright smoke test only** (Architecture §3.5): the entire automated test surface in Phase 0 = `e2e/tasks.spec.ts` "create → reload → assert visible"
- **No unit-test framework, no integration test framework** in Phase 0 stack — additional automated coverage is out of scope
- **Manual validation is the primary mechanism** for the bulk of Epic 2 acceptance criteria (especially Story 2.6 persistence verification = scripted manual sequence in README)
- **No CORS, same-origin** (`/api/*` via Caddy) — simplifies E2E network shape
- **No auth** — no token/session setup in tests
- **Manual validation in route handlers** (no Zod) — error-shape tests must verify the hand-rolled `{error: string}` contract

This is an unusual epic-level test design: the **product strategy deliberately constrains automated testing to one smoke test**. The test design must therefore prioritize:
1. The single P0 automated path (Story 2.7 smoke)
2. Manual verification scripts for durability (Story 2.6 — the trust-anchor test)
3. `curl`-based API verification recipes (callable by self-hosters per FR18, FR41)
4. A clear honest gap-list of what is NOT automated and why

## Step 3: Risk Assessment (Epic-Level)

> Mode is Epic-Level, so the formal **system-level testability review** (controllability/observability/reliability per ADRs) is out of scope here. We capture testability concerns inline within the risk table where they materially shift probability or impact.

### Risk Categories Used

`TECH` = technical debt / fragility · `SEC` = security · `PERF` = performance · `DATA` = data integrity / durability · `BUS` = business logic correctness · `OPS` = operational

### Scoring Scale (from `probability-impact.md`)

Probability: 1=Unlikely, 2=Possible, 3=Likely · Impact: 1=Minor, 2=Degraded, 3=Critical · Score = P×I · Action: 1–3 DOCUMENT, 4–5 MONITOR, 6–8 MITIGATE, 9 BLOCK

### Risk Register — Epic 2

| ID  | Cat   | Risk                                                                                               | Stories         | P | I | Score | Action   | Mitigation                                                                                                                                      |
|-----|-------|----------------------------------------------------------------------------------------------------|-----------------|---|---|-------|----------|------------------------------------------------------------------------------------------------------------------------------------------------|
| R1  | DATA  | Postgres data loss across `compose down/up` (volume not mounted, container ephemeral) — PRD top risk | 2.6, 2.7        | 2 | 3 | **6** | MITIGATE | Story 2.6 5-scenario manual sequence + Story 2.7 Playwright reload smoke. **Both required.** Verified before Phase 0 declared complete.        |
| R2  | DATA  | Host VPS reboot loses task data (named volume not persistent across reboot)                          | 2.6             | 1 | 3 | 3     | DOCUMENT | Story 2.6 scenario 5 (reboot) is the canonical test. Single manual run on the real VPS pre-launch. Documented in README persistence section.   |
| R3  | BUS   | API responses leak `owner_id` (Phase 1 boundary violation; future-auth contract leak)               | 2.1, 2.3        | 2 | 2 | 4     | MONITOR  | Boundary mapping in single response builder per Architecture §4.1. Verify via `curl` that responses contain only `{id, description, completed, createdAt}`. |
| R4  | BUS   | snake_case/camelCase mapping inconsistency (`created_at` ↔ `createdAt`) breaks frontend parsing      | 2.1, 2.2        | 2 | 2 | 4     | MONITOR  | Single-point mapping at Express response builder (Architecture §4.1). Manual `curl` + UI smoke after Story 2.2.                                |
| R5  | SEC   | SQL injection via unparameterized queries in CRUD handlers                                           | 2.1, 2.3, 2.4   | 1 | 3 | 3     | DOCUMENT | AC mandates `$1` parameterized queries. Self-policing code review. Manual `curl` probe with `'; DROP TABLE tasks;--` payload pre-launch.       |
| R6  | BUS   | Validation gap: `description` length 1–500 not enforced at API or DB → corrupt rows                  | 2.1             | 2 | 2 | 4     | MONITOR  | Dual enforcement: SQL `CHECK (length 1–500)` + manual API check. Test with `curl` payloads at boundaries: `""`, 500-char, 501-char, non-string. |
| R7  | BUS   | PATCH `:id` / DELETE `:id` integer validation missing → 500s on malformed input                      | 2.3, 2.4        | 2 | 1 | 2     | DOCUMENT | AC requires positive-integer validation returning 400. Manual `curl` smoke with `abc`, `-1`, `0`, very-large IDs.                              |
| R8  | BUS   | 404 vs 200 wrong: PATCH/DELETE on missing id returns 200 instead of 404                              | 2.3, 2.4        | 2 | 1 | 2     | DOCUMENT | Manual `curl` against deleted/nonexistent id. Easy to catch.                                                                                    |
| R9  | TECH  | Error toast UX leaves UI stuck (re-fetch loop, stale optimistic state) — blocks subsequent actions   | 2.5             | 2 | 2 | 4     | MONITOR  | Story 2.5 AC explicitly forbids UI-thread blocking. Manual: induce 500 by killing API container, verify input/checkboxes still interactive.    |
| R10 | TECH  | Silent failure: mutation rejects but no error surfaced (FR29 violation)                              | 2.5             | 2 | 3 | **6** | MITIGATE | Story 2.5 inline error region required. Manual: induce network failure (browser devtools offline), verify visible error within ~3s.            |
| R11 | OPS   | First-time-VPS deploy fails (Architecture-flagged highest-risk single bullet from PRD §Resources)    | (Epic 1, 2.6)   | 3 | 3 | **9** | BLOCK    | **Out of scope for Epic 2** but Epic 2's persistence verification (Story 2.6) is the gate. **Explicit cross-epic dependency noted.**           |
| R12 | TECH  | Playwright smoke uses real network → flaky on slow CI / first-load latency                           | 2.7             | 2 | 1 | 2     | DOCUMENT | Single test, runs locally against `http://localhost`. No CI mandated in Phase 0. Generous default timeout, unique task description per run.    |
| R13 | TECH  | Playwright smoke leaves test data in DB (no cleanup) → drift on shared VPS                           | 2.7             | 2 | 1 | 2     | DOCUMENT | AC mandates delete-cleanup at end of test. Acceptable for solo Phase 0 use.                                                                    |
| R14 | DATA  | `useState`-only client state silently lost on refresh (FR11 violation)                               | 2.2, 2.6        | 1 | 3 | 3     | DOCUMENT | Story 2.6 scenario 1 (browser refresh) is the canonical test. Re-fetch on mount is the architectural pattern.                                  |
| R15 | BUS   | Whitespace-only / empty submission causes 400 instead of silent ignore (UX papercut)                 | 2.2             | 2 | 1 | 2     | DOCUMENT | Frontend trims and silently ignores empty (per AC). API 400 is the safety net only.                                                            |
| R16 | TECH  | Optimistic-state revert on failure not implemented in Story 2.5 (deferred to 3.4)                    | 2.5 → 3.4       | 2 | 1 | 2     | DOCUMENT | Story 2.5 AC explicitly stands alone without optimistic UI; this is a documented forward-reference, not a defect.                              |
| R17 | OPS   | Graceful shutdown (`SIGTERM`) leaks DB connections → data inconsistency on restart                   | 2.6             | 1 | 2 | 2     | DOCUMENT | Pool close on `SIGTERM` is in Story 1.3 AC. Story 2.6 scenarios 3 & 4 (compose restart / down-up) implicitly verify clean shutdown.            |
| R18 | SEC   | No-auth posture means anyone with URL can wipe all tasks                                             | (Acknowledged)  | 3 | 2 | **6** | MITIGATE | **Documented Phase 0 acceptance** per FR12 and PRD risk table. Mitigation = README "Acknowledged Gaps" + NFR13 (deployable behind Tailscale).  |

### High-Risk Summary (Score ≥ 6)

| ID  | Risk                                                            | Score | Action   | Status                                                                                                            |
|-----|-----------------------------------------------------------------|-------|----------|-------------------------------------------------------------------------------------------------------------------|
| R11 | First-time-VPS deploy failure                                   | 9     | BLOCK    | Cross-epic dependency on Epic 1; gated by Story 2.6 persistence sequence on the real VPS                          |
| R1  | Postgres `compose down/up` data loss                            | 6     | MITIGATE | Story 2.6 scenario 4 + Story 2.7 Playwright smoke required; this is the headline trust test                       |
| R10 | Silent mutation failure (no error surfaced)                     | 6     | MITIGATE | Story 2.5 inline error region required; manual fault-injection verification                                       |
| R18 | No-auth → anyone-can-wipe                                       | 6     | MITIGATE | Accepted Phase 0 trade-off; README disclosure is the mitigation                                                   |

### Risk-Driven Test Implications

1. **R1 gets the project's only automated test** — Story 2.7 Playwright smoke is correctly aimed at the highest mitigatable risk. No reallocation needed.
2. **R10 (silent failure) and R11 (deploy) require manual fault-injection scripts** — these belong in the README persistence/quickstart sequences, not in `e2e/`.
3. **R18 is mitigation-by-disclosure** — verification = grep README for "Acknowledged Phase 0 gaps" content, not a runtime test.
4. **Validation-shape risks (R3, R4, R6, R7, R8) cluster as `curl` smoke recipes** — recommend a `docs/api-smoke.sh` or README "API verification" subsection so self-hosters can re-run them.
5. **No P0-priority automated test gap exists** — the single Playwright smoke covers the single P0 risk (R1). The system is designed correctly for its stated discipline-first thesis. Test design must avoid the temptation to invent infrastructure (Vitest, supertest) that the architecture explicitly rejected.

### Testability Concerns Specific to Epic 2

- **🚨 No integration-test seam between Express handlers and Postgres** — Phase 0 architecture explicitly skips supertest/Vitest. Test design must accept `curl` + manual as the integration verification mechanism.
- **🚨 No fault-injection harness** — to verify R10 (silent failure surfacing), the test plan must give a concrete "kill the API container" procedure rather than relying on a mock.
- **✅ Strong observability via stdout logs** — `docker compose logs api` is the assertion mechanism for backend behavior during manual verification.
- **✅ Strong reproducibility via `compose down/up`** — the durability test is deterministic and self-resetting.
- **✅ Same-origin, no auth, no CORS** — eliminates entire categories of E2E flakiness.


## Step 4: Coverage Plan & Execution Strategy

> **Architectural reality check:** Phase 0 ships exactly **one** automated test (`e2e/tasks.spec.ts`). Per Architecture §3.5 and PRD discipline thesis, adding Vitest/supertest/component frameworks is **explicitly rejected**. This coverage plan therefore organizes scenarios across three execution channels: **Automated (Playwright)**, **Manual scripted (`curl` + README sequences)**, and **Manual exploratory** — with honest gap labeling. This is not a lack of rigor; it is the rigor.

### 4.1 Coverage Matrix

Levels used: **E2E-Auto** (Playwright) · **API-Manual** (`curl` recipe in `docs/` or README) · **UI-Manual** (scripted browser walkthrough) · **Ops-Manual** (`docker compose` + reboot sequences). Each scenario maps back to one or more risks (R1–R18) and one Story (2.1–2.7).

| #   | Scenario                                                                                          | Story | Level         | Priority | Risks Covered      | Notes                                                                                            |
|-----|---------------------------------------------------------------------------------------------------|-------|---------------|----------|--------------------|--------------------------------------------------------------------------------------------------|
| C1  | Create task → reload page → task still visible (canonical durability path)                        | 2.7   | **E2E-Auto**  | **P0**   | R1, R14            | The single Playwright spec. Must clean up its created task at end. Generous timeout.              |
| C2  | `compose down && compose up` preserves all tasks (named volume mounted)                           | 2.6   | Ops-Manual    | **P0**   | R1, R17            | Headline trust test. README scenario 4. Run pre-launch on the real VPS.                          |
| C3  | VPS host reboot preserves all tasks                                                               | 2.6   | Ops-Manual    | **P0**   | R2                 | README scenario 5. Single pre-launch run on real VPS. Cross-epic gate with R11.                  |
| C4  | Mutation failure surfaces inline error within ~3s (kill API container, attempt create)            | 2.5   | UI-Manual     | **P0**   | R10                | FR29 verification. Use browser devtools "offline" or `docker compose stop api`.                   |
| C5  | POST `/api/tasks` with valid `{description: "x"}` returns 201 + `{id, description, completed:false, createdAt}` | 2.1 | API-Manual | P1 | R3, R4, R6 | `curl` recipe. Verify response shape excludes `owner_id`, includes camelCase `createdAt`.        |
| C6  | GET `/api/tasks` returns ordered array of mapped task objects                                      | 2.1   | API-Manual    | P1       | R3, R4             | `curl` recipe. Verify ordering matches AC, no `owner_id` leaked.                                  |
| C7  | PATCH `/api/tasks/:id` with `{completed: true}` toggles state, returns 200 + updated task         | 2.3   | API-Manual    | P1       | R4, R7             | `curl` recipe. Then GET to confirm persistence.                                                   |
| C8  | DELETE `/api/tasks/:id` removes task, returns 204; subsequent GET excludes it                     | 2.4   | API-Manual    | P1       | R4                 | `curl` recipe.                                                                                    |
| C9  | Browser refresh after create (no compose action) preserves task list                              | 2.6   | UI-Manual     | P1       | R14                | README scenario 1. Catches `useState`-only regressions.                                           |
| C10 | API container restart (`compose restart api`) preserves tasks; UI re-fetches successfully          | 2.6   | Ops-Manual    | P1       | R1, R17            | README scenario 3.                                                                                |
| C11 | DB container restart (`compose restart db`) preserves tasks after API reconnect                    | 2.6   | Ops-Manual    | P1       | R1, R17            | README scenario 2. Verifies pool reconnection behavior.                                           |
| C12 | Full UI walkthrough: create → toggle → edit (if in 2.x) → delete on real VPS deployed URL         | 2.2   | UI-Manual     | P1       | R4, R9, R14        | Pre-launch smoke on the deployed URL, not localhost. Catches deploy-only regressions.             |
| C13 | POST with `description: ""` → 400 `{error: "..."}`                                                 | 2.1   | API-Manual    | P2       | R6                 | `curl` boundary. Verify error shape is `{error: string}`.                                         |
| C14 | POST with 500-char description → 201; with 501-char → 400                                          | 2.1   | API-Manual    | P2       | R6                 | `curl` boundary pair.                                                                             |
| C15 | POST with non-string `description` (number, null, missing) → 400                                  | 2.1   | API-Manual    | P2       | R6                 | `curl` payload variants.                                                                          |
| C16 | PATCH/DELETE with `:id` = `abc`, `-1`, `0`, very-large → 400                                      | 2.3, 2.4 | API-Manual | P2       | R7                 | `curl` recipe set.                                                                                |
| C17 | PATCH/DELETE on nonexistent id → 404 (not 200, not 500)                                           | 2.3, 2.4 | API-Manual | P2       | R8                 | `curl` recipe.                                                                                    |
| C18 | Whitespace-only frontend submission silently ignored (no API call)                                 | 2.2   | UI-Manual    | P2       | R15                | Manual UX check. API-side 400 (C13) is the safety net.                                            |
| C19 | Error toast does NOT block subsequent UI interaction (input still typeable, checkboxes clickable) | 2.5   | UI-Manual     | P2       | R9                 | Combine with C4 procedure: after error appears, verify UI still responsive.                       |
| C20 | SQL injection probe: `description = "'; DROP TABLE tasks;--"` → stored as literal string, no DB damage | 2.1 | API-Manual | P2       | R5                 | `curl` recipe + post-check `SELECT count(*) FROM tasks`.                                          |
| C21 | README "Acknowledged Phase 0 gaps" section exists and lists no-auth + Tailscale guidance          | —     | Doc-Review    | P2       | R18                | grep/manual review at PR. Mitigation-by-disclosure verification.                                  |
| C22 | Playwright spec cleans up its created task (no DB drift after run)                                 | 2.7   | E2E-Auto      | P3       | R13                | Asserted by AC of Story 2.7; verify by re-running smoke and observing no accumulation.            |
| C23 | Concurrent CRUD from two browser tabs (refresh in tab B reflects tab A's create) — exploratory    | 2.6   | UI-Manual     | P3       | R14                | Nice-to-have; documents single-user assumption.                                                   |
| C24 | Long-list rendering (~200 tasks) — visual + interaction sanity                                    | 2.2   | UI-Manual     | P3       | (perf-adjacent)    | Out of scope for FR/NFR but cheap to eyeball pre-launch.                                          |

**Coverage cross-check vs. risk register:**

- All P0/MITIGATE risks (R1, R10) → covered by C1, C2, C4 ✅
- All BLOCK risk (R11) cross-epic gate → C2 + C3 + C12 on real VPS ✅
- All MONITOR risks (R3, R4, R6, R9) → covered by C5–C8, C12, C13–C15, C19 ✅
- All accepted/documented risks (R2, R5, R7, R8, R12–R17, R18) → covered by C3, C20, C16, C17, C22, C9, C18, C21 ✅
- **No risk uncovered. No coverage redundancy across levels** (E2E-Auto handles only the headline durability path; API-Manual handles contract/validation; UI-Manual handles UX; Ops-Manual handles infra).

### 4.2 Execution Strategy

Phase 0 has no CI pipeline (per PRD/Architecture). Execution model is **PR-time** (developer-local) and **Pre-Launch** (one-time on real VPS). No nightly/weekly suites — the system is too small to justify them.

| Channel        | Trigger                                  | Contents                                | Time budget        |
|----------------|------------------------------------------|-----------------------------------------|--------------------|
| **PR / Local** | Before merging any Story 2.x PR          | Affected Story's API-Manual + UI-Manual scenarios; full Playwright smoke (C1) | < 10 min           |
| **Pre-Launch** | Once, on real VPS, before declaring Phase 0 complete | C2, C3, C9–C12 (full Story 2.6 sequence) + C1 + C20 | ~30–45 min         |
| **Post-Deploy Sanity** | After any deploy to VPS               | C1 (Playwright) + C12 (UI walkthrough on deployed URL) | < 10 min           |

- **No nightly required:** single Playwright spec + manual ops checks; cron adds no value.
- **No weekly required:** no perf/chaos/large-data suites in Phase 0.
- **CI is explicitly out of scope** per PRD brutal-cut order.

### 4.3 Resource Estimates (Ranges)

Greenfield project; estimates assume one developer building from scratch.

| Priority | Scenarios          | Build Effort        | Per-Run Effort       |
|----------|--------------------|---------------------|----------------------|
| **P0**   | C1, C2, C3, C4     | ~3–6 hours total (Playwright spec + README persistence sequence + fault-injection notes) | ~10–15 min (manual scenarios) + <1 min (Playwright) |
| **P1**   | C5–C12             | ~3–5 hours (curl recipes file, UI walkthrough script, README authoring) | ~15–25 min full pass |
| **P2**   | C13–C21            | ~2–4 hours (boundary curl recipes, doc-review checklist) | ~10–15 min          |
| **P3**   | C22–C24            | ~0.5–1 hour         | ~5 min exploratory   |
| **Total build** |             | **~8–16 hours** distributed across Stories 2.1–2.7 ACs | — |
| **Total per pre-launch pass** | | — | **~30–45 min**       |

Timeline: build effort folds into the Story implementation hours; no separate "test sprint" needed.

### 4.4 Quality Gates

Adapted from `risk-governance.md` and `test-priorities-matrix.md` for a single-test architecture:

| Gate                                                | Threshold                                                                                              |
|-----------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| **P0 pass rate**                                    | **100%** — C1 (Playwright) green + C2/C3/C4 manually verified before Phase 0 declared complete         |
| **P1 pass rate**                                    | **≥ 95%** — C5–C12 documented passing on the real VPS pre-launch                                       |
| **P2 pass rate**                                    | **≥ 80%** — boundary/UX checks; documented exceptions allowed if risk-accepted                          |
| **P3**                                              | Best-effort; failures logged but non-blocking                                                          |
| **High-risk mitigations (R1, R10, R18) closed**     | Required: C1 green, C2/C4 manual evidence captured, README "Acknowledged Gaps" section merged          |
| **Cross-epic BLOCK risk (R11)**                     | Phase 0 cannot ship until C2 + C3 + C12 pass on the real VPS once                                      |
| **Coverage target**                                 | **100% of P0–P1 risks covered by at least one scenario** (verified above). Code-coverage % is N/A — no unit/integration framework exists. |
| **No new automated tests added without explicit ADR amendment** | Architectural discipline: prevents test-stack scope creep                                              |

### 4.5 Honest Gap List (What Is NOT Covered, and Why)

To prevent later auditors from mistaking the spartan automation footprint for an oversight:

1. **No backend unit tests** — Phase 0 architecture rejects Vitest. Risk accepted; mitigated by code review + curl recipes.
2. **No frontend component tests** — Same rejection. Mitigated by single E2E + UI-Manual walkthroughs.
3. **No contract tests** — single deployer, single consumer, no contract drift surface.
4. **No load/perf tests** — Phase 0 NFR is "responsive for 1 user with ~200 tasks"; eyeball test (C24) suffices.
5. **No accessibility automated audit** — out of Phase 0 scope per PRD brutal cuts.
6. **No security scanning** — Phase 0 SEC posture is "no auth, deploy behind Tailscale"; SQL injection probe (C20) is the only adversarial test.
7. **No cross-browser matrix** — Playwright default (Chromium) only; documented limitation.
8. **No data-migration tests** — schema is one `CREATE TABLE`; no migrations exist yet.

These gaps are **deliberate and traceable to PRD/Architecture decisions**, not oversights. Re-opening them is a Phase 1 conversation.


## Step 5: Generate Output

### Execution Mode

- **Requested:** auto (config default)
- **Resolved:** sequential (epic-level mode is single-worker by design; one output artifact)

### Output Generated

- `_bmad-output/test-artifacts/test-design-epic-2.md` — full Epic 2 test design document populated from `test-design-template.md`

### Template Population — Verified Sections

- ✅ Executive Summary (scope, risk summary, coverage summary)
- ✅ Not in Scope (10 items with reasoning + mitigation)
- ✅ Risk Assessment (4 high-priority, 7 medium, 7 low) — all 18 risks renumbered to R-001…R-018 format
- ✅ Entry / Exit Criteria
- ✅ Test Coverage Plan (P0/P1/P2/P3 with note clarifying priority ≠ execution timing)
- ✅ Execution Strategy (PR / Pre-Launch / Post-Deploy — simple, no smoke/P0/P1 tier redundancy)
- ✅ Resource Estimates (interval ranges only — no false precision)
- ✅ Quality Gate Criteria (P0=100%, P1≥95%, P2≥80%; non-negotiables)
- ✅ Mitigation Plans (all 4 high-priority risks: R-011, R-001, R-010, R-018)
- ✅ Assumptions and Dependencies
- ✅ Interworking & Regression
- ✅ Honest Gap List (8 gaps traced to PRD/Architecture decisions)
- ✅ Follow-on Workflows
- ✅ Approval block
- ✅ Appendix (KB references + related docs)

### Checklist Validation

**Mode:** Epic-Level (single document) — system-level two-doc validation N/A; handoff doc N/A.

- ✅ Prerequisites: PRD, Architecture, Epics all present and read
- ✅ Process Steps 1–4: all completed (see prior sections)
- ✅ Risk IDs unique, formatted R-NNN, all P/I in {1,2,3}, scores correct
- ✅ Coverage matrix: all requirements mapped to levels, no duplicate coverage, owners noted
- ✅ Execution strategy: simple PR/Pre-Launch/Post-Deploy, no complex tier structure
- ✅ Resource estimates: all intervals, no exact "2.5 hours" calculations
- ✅ Quality gates: P0=100%, P1≥95% defined; high-risk mitigation closure required
- ✅ Priority sections include only Criteria; no execution context mixed in
- ✅ Note clarifying P0/P1/P2/P3 = priority not timing present at top of Coverage Plan
- ✅ Out-of-scope items listed with reasoning
- ✅ Entry/Exit criteria specific
- ✅ Interworking & Regression populated
- ✅ Anti-bloat: no repeated notes, no AI-slop superlatives, professional tone
- ✅ No orphaned browsers / temp artifacts (no CLI sessions used)
- ✅ All artifacts in `_bmad-output/test-artifacts/`

### Polish Pass Notes

- Risk IDs reformatted from R1…R18 (Step 3 working notation) to R-001…R-018 in the final doc to match template convention; cross-references updated throughout coverage matrix
- Test scenario IDs kept as C1–C24 (sequence-of-scenarios convention; clearer than P0-001 style for this scale)
- Cross-references between mitigation plans and coverage scenarios verified bidirectional

### Completion Report

- **Mode used:** Epic-Level, sequential execution
- **Output file:** `_bmad-output/test-artifacts/test-design-epic-2.md` (single document, ~330 lines)
- **Key risks:** R-011 (BLOCK, cross-epic), R-001/R-010/R-018 (MITIGATE, all in-epic)
- **Gate thresholds:** P0=100%, P1≥95%, P2≥80%; high-risk mitigation closure non-negotiable
- **Open assumptions:** Architecture §3.5 single-test discipline holds; real VPS available for Pre-Launch pass; Tailscale recommended in README
- **On-complete hook:** Resolver returned empty `workflow.on_complete` → no terminal instruction to execute → exiting normally

