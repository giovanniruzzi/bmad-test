---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-04-29'
mode: 'epic-level'
target_epic: 'Epic 2 — Task CRUD — End-to-End Vertical Slice'
---

# Test Design: Epic 2 — Task CRUD — End-to-End Vertical Slice

**Date:** 2026-04-29
**Author:** Gio (TEA — Murat persona)
**Status:** Draft
**Project:** Tasky (Phase 0, single-user self-hosted todo)

---

## Executive Summary

**Scope:** Epic-level test design for Epic 2 (7 stories: 2.1–2.7), the vertical slice that delivers PRD MVP value. Epic 2 owns all CRUD functionality, the only automated test in Phase 0, and the durability claims that anchor the project's "trust your own server" thesis.

**Architectural reality that shapes this design:** Per Architecture §3.5 and PRD discipline thesis, Phase 0 ships **exactly one automated test** (`e2e/tasks.spec.ts`). Vitest, supertest, component test frameworks, and CI are explicitly out of scope. Coverage is therefore organized across three execution channels — **Automated (Playwright)**, **Manual scripted (`curl` + README sequences)**, and **Manual exploratory** — with an honest gap list. This is the rigor, not the absence of it.

**Risk Summary:**

- Total risks identified: **18**
- High-priority risks (score ≥ 6): **4** (R1, R10, R11, R18)
- Critical categories: **DATA** (durability), **TECH** (silent UX failure), **OPS** (first-VPS deploy), **SEC** (no-auth posture)

**Coverage Summary:**

- P0 scenarios: **4** (~3–6 hours build effort)
- P1 scenarios: **8** (~3–5 hours build effort)
- P2 scenarios: **9** (~2–4 hours build effort)
- P3 scenarios: **3** (~0.5–1 hour build effort)
- **Total build effort:** ~8–16 hours, distributed across Story 2.1–2.7 implementation
- **Per pre-launch pass:** ~30–45 minutes manual + < 1 minute Playwright

> **Note:** Priority labels (P0/P1/P2/P3) describe **risk and importance**, not execution timing. Execution cadence is defined in the Execution Strategy section.

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|-----------|
| **Backend unit tests (Vitest)** | Architecture §3.5 explicitly rejects them for Phase 0 (discipline-first thesis) | Code review + API-Manual `curl` recipes (C5–C8, C13–C17) |
| **Frontend component tests** | Same architectural rejection | Single E2E (C1) + UI-Manual walkthroughs (C9, C12, C19) |
| **API contract tests (Pact)** | Single deployer + single consumer; no contract-drift surface | None needed |
| **Load / perf tests (k6)** | Phase 0 NFR is "responsive for 1 user with ~200 tasks"; out of brutal-cut scope | Eyeball check (C24) |
| **Accessibility audit** | Out of Phase 0 scope per PRD brutal cuts | Phase 1 work |
| **Security scanning (SAST/DAST)** | Phase 0 SEC posture = "no auth, deploy behind Tailscale" | SQL injection probe (C20) + README disclosure (C21) |
| **Cross-browser matrix** | Playwright default (Chromium) only | Documented limitation |
| **Data migration tests** | Schema is one `CREATE TABLE`; no migrations exist | Re-evaluate when first migration lands |
| **CI pipeline & nightly suites** | No CI in Phase 0 per PRD | Local PR-time execution + one pre-launch pass |
| **Cross-epic blocker R11 (first-VPS deploy)** | Owned by Epic 1 (Foundation) | This doc gates it via C2/C3/C12 on real VPS |

---

## Risk Assessment

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, fragility)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation)
- **DATA**: Data Integrity (loss, corruption, persistence)
- **BUS**: Business Impact (UX harm, logic errors)
- **OPS**: Operations (deployment, config, monitoring)

### Scoring

Probability: 1=Unlikely, 2=Possible, 3=Likely · Impact: 1=Minor, 2=Degraded, 3=Critical · Score = P × I · Action: 1–3 DOCUMENT, 4–5 MONITOR, 6–8 MITIGATE, 9 BLOCK.

### High-Priority Risks (Score ≥ 6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| **R-011** | OPS | First-time-VPS deploy fails (PRD-flagged top risk; cross-epic dependency on Epic 1) | 3 | 3 | **9 BLOCK** | Phase 0 cannot ship until C2 + C3 + C12 pass on real VPS once. Cross-epic gate. | Dev (Epic 1 owner) | Pre-launch |
| **R-001** | DATA | Postgres data loss across `compose down/up` (named volume not mounted, container ephemeral) — PRD top headline risk | 2 | 3 | **6 MITIGATE** | Story 2.6 5-scenario manual sequence (C2) + Story 2.7 Playwright reload smoke (C1). Both required before Phase 0 declared complete. | Dev | Story 2.6 + 2.7 |
| **R-010** | TECH | Silent mutation failure: API rejects, UI never surfaces error (FR29 violation) | 2 | 3 | **6 MITIGATE** | Story 2.5 inline error region required (C4). Manual fault-injection: kill API container, verify visible error within ~3s. | Dev | Story 2.5 |
| **R-018** | SEC | No-auth posture: anyone with the URL can wipe all tasks | 3 | 2 | **6 MITIGATE** | Documented Phase 0 acceptance per FR12 + PRD risk table. Mitigation = README "Acknowledged Gaps" section + NFR13 (deployable behind Tailscale). | PM/Dev | README at launch |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-003 | BUS | API responses leak `owner_id` (Phase 1 boundary violation) | 2 | 2 | 4 | Boundary mapping in single response builder (Architecture §4.1); verify via `curl` (C5, C6) | Dev |
| R-004 | BUS | snake_case/camelCase mapping inconsistency (`created_at` ↔ `createdAt`) breaks frontend parsing | 2 | 2 | 4 | Single-point mapping at Express response builder; manual `curl` + UI smoke after Story 2.2 (C5–C8, C12) | Dev |
| R-006 | BUS | Validation gap: `description` length 1–500 not enforced at API or DB → corrupt rows | 2 | 2 | 4 | Dual enforcement: SQL `CHECK` + manual API check; boundary `curl` payloads (C13–C15) | Dev |
| R-009 | TECH | Error toast UX leaves UI stuck (re-fetch loop, stale optimistic state) | 2 | 2 | 4 | Story 2.5 AC explicitly forbids UI-thread blocking; manual verify input still interactive after error (C19) | Dev |
| R-002 | DATA | Host VPS reboot loses task data (named volume not persistent across reboot) | 1 | 3 | 3 | Story 2.6 scenario 5 (C3) is canonical; single pre-launch run on real VPS | Dev |
| R-005 | SEC | SQL injection via unparameterized queries in CRUD handlers | 1 | 3 | 3 | AC mandates `$1` parameterized queries; SQL injection probe via `curl` (C20) | Dev |
| R-014 | DATA | `useState`-only client state silently lost on refresh (FR11 violation) | 1 | 3 | 3 | Story 2.6 scenario 1 / browser refresh (C9); re-fetch on mount is architectural pattern | Dev |

### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-007 | BUS | PATCH/DELETE `:id` integer validation missing → 500 on malformed input | 2 | 1 | 2 | DOCUMENT — `curl` smoke C16 |
| R-008 | BUS | 404 vs 200 wrong: PATCH/DELETE on missing id returns 200 instead of 404 | 2 | 1 | 2 | DOCUMENT — `curl` smoke C17 |
| R-012 | TECH | Playwright smoke uses real network → flaky on slow first-load | 2 | 1 | 2 | DOCUMENT — single test, generous timeout, unique task description per run |
| R-013 | TECH | Playwright smoke leaves test data in DB (no cleanup) → drift | 2 | 1 | 2 | DOCUMENT — AC mandates delete-cleanup at end of test (C22) |
| R-015 | BUS | Whitespace-only / empty submission causes 400 instead of silent ignore | 2 | 1 | 2 | DOCUMENT — frontend trim per AC (C18); API 400 is safety net |
| R-016 | TECH | Optimistic-state revert on failure not implemented in 2.5 (deferred to 3.4) | 2 | 1 | 2 | DOCUMENT — explicit forward-reference, not a defect |
| R-017 | OPS | Graceful shutdown (`SIGTERM`) leaks DB connections → inconsistency on restart | 1 | 2 | 2 | DOCUMENT — pool close on `SIGTERM` per Story 1.3 AC; verified by C10/C11 |

---

## Entry Criteria

- [ ] Epic 1 (Foundation) complete: Docker Compose stack boots locally with Postgres named volume mounted
- [ ] Story 2.1 schema applied (`tasks` table with `CHECK (length 1–500)` constraint)
- [ ] `docker compose up` succeeds on developer laptop with frontend reachable via Caddy at `http://localhost`
- [ ] `curl` available on developer machine (for API-Manual scenarios)
- [ ] Playwright installed in `e2e/` workspace (Story 2.7 setup task)
- [ ] Real VPS provisioned and reachable (for pre-launch pass)
- [ ] PRD, Architecture, and Epics documents finalized and committed

## Exit Criteria

- [ ] **All P0 scenarios pass** (C1 Playwright green; C2/C3/C4 manually verified with evidence captured)
- [ ] **All P1 scenarios pass** on real VPS pre-launch (C5–C12)
- [ ] **No open high-severity bugs** in CRUD path (R1, R10 mitigations confirmed working)
- [ ] **README "Acknowledged Phase 0 gaps"** section merged (R18 mitigation, C21)
- [ ] **Cross-epic R-011 closed**: deploy-once-on-real-VPS sequence completed without manual rescue
- [ ] **`docs/api-smoke.sh`** (or equivalent README subsection) committed for self-host re-verification

---

## Test Coverage Plan

> **Reminder:** P0/P1/P2/P3 = priority/risk classification. Execution cadence (PR / Pre-Launch / Post-Deploy) is defined in the next section.

### P0 (Critical) — Blocks core journey + High risk + No workaround

**Criteria:** Mitigates a score-≥6 risk that has no acceptable workaround and blocks the PRD's never-cut promises (durability, deployed URL).

| Test ID | Requirement | Test Level | Risk Link | Story | Notes |
|---------|-------------|-----------|-----------|-------|-------|
| **C1** | Create task → reload page → task still visible (canonical durability path) | **E2E-Auto** (Playwright) | R-001, R-014 | 2.7 | The single Playwright spec. Generous timeout. Unique description per run. Cleans up at end. |
| **C2** | `compose down && compose up` preserves all tasks (named volume mounted) | Ops-Manual | R-001, R-017 | 2.6 | Headline trust test. README scenario 4. Run pre-launch on real VPS. |
| **C3** | VPS host reboot preserves all tasks | Ops-Manual | R-002 | 2.6 | README scenario 5. Single pre-launch run on real VPS. Cross-epic gate with R-011. |
| **C4** | Mutation failure surfaces inline error within ~3s (kill API container, attempt create) | UI-Manual | R-010 | 2.5 | FR29 verification. Use browser devtools "offline" or `docker compose stop api`. |

**Total P0:** 4 scenarios · build effort **~3–6 hours**

### P1 (High) — Important features + Medium risk + Common workflows

**Criteria:** Covers common CRUD paths and the medium-priority risks (R3, R4, R6, R9, R14) that, while not catastrophic, would visibly degrade trust.

| Test ID | Requirement | Test Level | Risk Link | Story | Notes |
|---------|-------------|-----------|-----------|-------|-------|
| **C5** | POST `/api/tasks` returns 201 + correctly mapped `{id, description, completed:false, createdAt}` (no `owner_id`) | API-Manual | R-003, R-004, R-006 | 2.1 | `curl` recipe. Verify response shape excludes `owner_id`, includes camelCase `createdAt`. |
| **C6** | GET `/api/tasks` returns ordered array of mapped task objects | API-Manual | R-003, R-004 | 2.1 | `curl` recipe. Verify ordering matches AC, no `owner_id` leaked. |
| **C7** | PATCH `/api/tasks/:id` with `{completed:true}` toggles state, returns 200 + updated task | API-Manual | R-004, R-007 | 2.3 | `curl` recipe; follow with GET to confirm persistence. |
| **C8** | DELETE `/api/tasks/:id` removes task, returns 204; subsequent GET excludes it | API-Manual | R-004 | 2.4 | `curl` recipe. |
| **C9** | Browser refresh after create (no compose action) preserves task list | UI-Manual | R-014 | 2.6 | README scenario 1. Catches `useState`-only regressions. |
| **C10** | API container restart (`compose restart api`) preserves tasks; UI re-fetches successfully | Ops-Manual | R-001, R-017 | 2.6 | README scenario 3. |
| **C11** | DB container restart (`compose restart db`) preserves tasks after API reconnect | Ops-Manual | R-001, R-017 | 2.6 | README scenario 2. Verifies pool reconnection. |
| **C12** | Full UI walkthrough (create → toggle → delete) on **real VPS deployed URL** | UI-Manual | R-004, R-009, R-014 | 2.2 | Pre-launch smoke on deployed URL. Catches deploy-only regressions. Closes R-011 gate. |

**Total P1:** 8 scenarios · build effort **~3–5 hours**

### P2 (Medium) — Secondary features + Low risk + Edge cases

**Criteria:** Boundary validation, error-shape correctness, UX papercuts, security probes. Documented exceptions allowed if risk-accepted.

| Test ID | Requirement | Test Level | Risk Link | Story | Notes |
|---------|-------------|-----------|-----------|-------|-------|
| **C13** | POST with `description: ""` → 400 `{error: string}` | API-Manual | R-006 | 2.1 | `curl` boundary. Verify `{error: string}` shape. |
| **C14** | POST with 500-char → 201; 501-char → 400 | API-Manual | R-006 | 2.1 | `curl` boundary pair. |
| **C15** | POST with non-string `description` (number, null, missing) → 400 | API-Manual | R-006 | 2.1 | `curl` payload variants. |
| **C16** | PATCH/DELETE with `:id` = `abc`, `-1`, `0`, very-large → 400 | API-Manual | R-007 | 2.3, 2.4 | `curl` recipe set. |
| **C17** | PATCH/DELETE on nonexistent id → 404 (not 200, not 500) | API-Manual | R-008 | 2.3, 2.4 | `curl` recipe. |
| **C18** | Whitespace-only frontend submission silently ignored (no API call fired) | UI-Manual | R-015 | 2.2 | Manual UX check. C13 is the safety net. |
| **C19** | Error toast does NOT block subsequent UI interaction | UI-Manual | R-009 | 2.5 | Combine with C4: after error appears, verify input/checkbox still responsive. |
| **C20** | SQL injection probe: `description = "'; DROP TABLE tasks;--"` stored as literal, no DB damage | API-Manual | R-005 | 2.1 | `curl` + post-check `SELECT count(*) FROM tasks`. |
| **C21** | README "Acknowledged Phase 0 gaps" section exists and lists no-auth + Tailscale guidance | Doc-Review | R-018 | — | grep / manual review at PR. Mitigation-by-disclosure verification. |

**Total P2:** 9 scenarios · build effort **~2–4 hours**

### P3 (Low) — Nice-to-have / Exploratory

| Test ID | Requirement | Test Level | Risk Link | Story | Notes |
|---------|-------------|-----------|-----------|-------|-------|
| **C22** | Playwright spec cleans up its created task (no DB drift across runs) | E2E-Auto | R-013 | 2.7 | Asserted by Story 2.7 AC; verify by re-running smoke and checking no accumulation. |
| **C23** | Concurrent CRUD from two browser tabs (refresh in tab B reflects tab A's create) | UI-Manual | R-014 | 2.6 | Documents single-user assumption. |
| **C24** | Long-list rendering (~200 tasks) — visual + interaction sanity | UI-Manual | (perf-adjacent) | 2.2 | Cheap eyeball pre-launch; no FR/NFR target. |

**Total P3:** 3 scenarios · build effort **~0.5–1 hour**

### Coverage Cross-Check vs. Risk Register

- All P0/MITIGATE risks (R-001, R-010) → covered by C1, C2, C4 ✓
- All BLOCK risk (R-011) cross-epic gate → C2 + C3 + C12 on real VPS ✓
- All MONITOR risks (R-003, R-004, R-006, R-009) → covered by C5–C8, C12, C13–C15, C19 ✓
- All accepted/documented risks (R-002, R-005, R-007, R-008, R-012–R-017, R-018) → covered by C3, C20, C16, C17, C22, C9, C18, C21 ✓
- **No risk uncovered. No coverage redundancy across levels** — E2E-Auto handles only the headline durability path; API-Manual handles contract/validation; UI-Manual handles UX; Ops-Manual handles infra.

---

## Execution Strategy

Phase 0 has **no CI pipeline** (per PRD/Architecture brutal cuts). Execution model is **PR-time** (developer-local) and **Pre-Launch** (one-time on real VPS). The system is too small to justify nightly/weekly suites.

| Channel | Trigger | Contents | Time Budget |
|---------|---------|----------|-------------|
| **PR / Local** | Before merging any Story 2.x PR | Affected story's API-Manual + UI-Manual scenarios; full Playwright smoke (C1) | < 10 min |
| **Pre-Launch** | Once, on real VPS, before declaring Phase 0 complete | C1 + C2 + C3 + C9–C12 + C20 (full Story 2.6 sequence + injection probe) | ~30–45 min |
| **Post-Deploy Sanity** | After any deploy to VPS | C1 (Playwright) + C12 (UI walkthrough on deployed URL) | < 10 min |

**Philosophy:** "Run everything in PRs unless it requires real-VPS infrastructure." Playwright runs in seconds; manual `curl` recipes take a couple of minutes per story. No deferral needed.

**Explicitly NOT included:**

- ❌ Nightly suites (no perf/chaos/long-running tests in Phase 0)
- ❌ Weekly suites (same reason)
- ❌ CI automation (out of scope per PRD brutal-cut order)

---

## Resource Estimates

> Interval ranges, no false precision. Estimates assume one developer building greenfield; build effort folds into Story 2.x implementation hours, not a separate test sprint.

### Test Build Effort

| Priority | Scenarios | Build Effort | Per-Run Effort |
|----------|-----------|--------------|----------------|
| **P0** | C1, C2, C3, C4 | ~3–6 hours (Playwright spec + README persistence sequence + fault-injection notes) | ~10–15 min manual + < 1 min Playwright |
| **P1** | C5–C12 | ~3–5 hours (`curl` recipes file, UI walkthrough script, README authoring) | ~15–25 min full pass |
| **P2** | C13–C21 | ~2–4 hours (boundary `curl` recipes, doc-review checklist) | ~10–15 min |
| **P3** | C22–C24 | ~0.5–1 hour | ~5 min exploratory |
| **Total build** | 24 scenarios | **~8–16 hours** distributed across Stories 2.1–2.7 | — |
| **Total per pre-launch pass** | — | — | **~30–45 min** |

**Timeline:** Folded into Story 2.x implementation; no separate "test phase." Pre-launch pass = one half-day on the real VPS.

### Prerequisites

**Test Data:**

- No factories/fixtures needed; manual scenarios use ad-hoc descriptions ("Buy milk", unique-per-run UUID for Playwright)

**Tooling:**

- `curl` for API-Manual scenarios
- `docker compose` for Ops-Manual scenarios (already required to run the app)
- Playwright (Story 2.7 setup) for the single E2E spec
- Browser devtools (Network → Offline) for fault-injection (C4)

**Environment:**

- Local Docker Compose stack on developer laptop for PR-time runs
- Real VPS with Caddy + Compose for Pre-Launch and Post-Deploy passes
- `docs/api-smoke.sh` (or README "API verification" subsection) — recommended deliverable for self-hosters per FR18, FR41

---

## Quality Gate Criteria

### Pass/Fail Thresholds

| Gate | Threshold |
|------|-----------|
| **P0 pass rate** | **100%** — C1 Playwright green + C2/C3/C4 manually verified with evidence captured before Phase 0 declared complete |
| **P1 pass rate** | **≥ 95%** — C5–C12 documented passing on real VPS pre-launch |
| **P2 pass rate** | **≥ 80%** — boundary/UX checks; documented exceptions allowed if risk-accepted |
| **P3** | Best-effort; failures logged but non-blocking |
| **High-risk mitigations (R-001, R-010, R-018) closed** | Required: C1 green, C2/C4 evidence captured, README "Acknowledged Gaps" section merged |
| **Cross-epic BLOCK risk (R-011)** | Phase 0 cannot ship until C2 + C3 + C12 pass on real VPS once |

### Coverage Targets

- **P0 + P1 risk coverage:** 100% (verified in cross-check above) ✓
- **Code coverage %:** **N/A** — no unit/integration framework exists; counting lines is meaningless here
- **Critical path coverage (CRUD + persistence):** 100% via C1, C5–C8, C2/C3/C9–C11
- **Security probes:** 1 (C20 SQL injection); no broader scanning in Phase 0
- **Acknowledged-gap documentation:** 100% (C21 doc-review)

### Non-Negotiable Requirements

- [ ] All P0 tests pass (no exceptions)
- [ ] No high-risk (≥ 6) item unmitigated; R-018 mitigated by README disclosure
- [ ] R-011 cross-epic gate cleared (deploy-once-on-real-VPS without manual rescue)
- [ ] **No new automated test infrastructure added without explicit ADR amendment** — architectural discipline; prevents test-stack scope creep

---

## Mitigation Plans

### R-011: First-Time-VPS Deploy Failure (Score: 9, BLOCK)

**Mitigation Strategy:**
1. Epic 1 owner produces a `docs/quickstart.md` that runs end-to-end on a fresh VPS in one session
2. Pre-launch dry-run on a throwaway VPS using only the documented commands
3. Pre-launch real run on production VPS executes C2 + C3 + C12 with no off-script intervention
4. Capture and commit any discovered fix-up steps as quickstart updates

**Owner:** Dev (Epic 1 lead) · **Timeline:** Pre-launch · **Status:** Cross-epic dependency, monitored from Epic 2
**Verification:** C2 + C3 + C12 pass on the real VPS; zero unrecorded manual steps in the deploy session.

### R-001: Postgres `compose down/up` Data Loss (Score: 6, MITIGATE)

**Mitigation Strategy:**
1. Story 2.1 schema migration uses a named Docker volume (`tasks_db_data:/var/lib/postgresql/data`)
2. Story 2.6 README persistence section documents the 5-scenario sequence (refresh, db restart, api restart, compose down/up, host reboot)
3. Story 2.7 Playwright spec (C1) automates the create-reload sub-case
4. Pre-launch pass executes the full Story 2.6 sequence on the real VPS (C2, C9–C11)

**Owner:** Dev · **Timeline:** Story 2.6 + 2.7 · **Status:** Planned
**Verification:** C1 green; C2/C9/C10/C11 pass with `psql` `SELECT count(*)` evidence captured before and after each compose action.

### R-010: Silent Mutation Failure (Score: 6, MITIGATE)

**Mitigation Strategy:**
1. Story 2.5 implements an inline error region in the task list view (NOT a transient toast)
2. Error region renders any `4xx`/`5xx` response or network failure within ~3s
3. Region does not block subsequent UI input (verified by C19)
4. Manual fault-injection procedure documented: `docker compose stop api`, attempt create, observe error region

**Owner:** Dev · **Timeline:** Story 2.5 · **Status:** Planned
**Verification:** C4 manual procedure produces visible error within ~3s; C19 confirms UI remains interactive after error.

### R-018: No-Auth → Anyone Can Wipe (Score: 6, MITIGATE — by disclosure)

**Mitigation Strategy:**
1. README "Acknowledged Phase 0 Gaps" section enumerates: no auth, no rate-limit, no CSRF, single-user assumption
2. README "Recommended Deployment" section recommends Tailscale or VPN gateway (NFR13)
3. PRD risk table cross-referenced from README

**Owner:** PM/Dev · **Timeline:** README at launch · **Status:** Planned
**Verification:** C21 doc-review confirms section exists, lists all four gaps, and references Tailscale.

---

## Assumptions and Dependencies

### Assumptions

1. Architecture §3.5's single-Playwright-test discipline is held throughout Phase 0; no late additions of Vitest/supertest will be requested
2. Postgres `CHECK (length 1–500)` constraint is enforced at schema creation in Story 2.1
3. Caddy reverse-proxies `/api/*` to Express same-origin (no CORS in any environment)
4. The real VPS used for pre-launch is the production target (not a staging clone)
5. `docker compose` v2 syntax is used everywhere (`docker compose`, not `docker-compose`)
6. README is the canonical home for manual test procedures; no separate test-runbook artifact

### Dependencies

1. **Epic 1 Foundation** — Docker Compose stack, named volume, Caddy config — Required before Story 2.6 runnable
2. **Story 2.1 schema** — Required before Stories 2.2–2.5 implementable
3. **Real VPS provisioned with SSH access** — Required for Pre-Launch pass and R-011 closure
4. **Tailscale (or equivalent) decision** — Required by R-018 mitigation language in README

### Risks to Plan

- **Risk:** Developer adds Vitest "just for one helper" and starts a slippery slope
  - **Impact:** Architectural discipline erodes; later auditor cannot trust the spartan-by-design framing
  - **Contingency:** Quality gate `No new automated test infrastructure added without explicit ADR amendment` enforced at PR review
- **Risk:** Pre-launch VPS pass surfaces unscripted manual steps
  - **Impact:** R-011 stays open; Phase 0 launch slips
  - **Contingency:** Capture each manual step as a quickstart commit; re-run sequence end-to-end until clean
- **Risk:** Playwright smoke goes flaky on slow first-load (R-012 manifests)
  - **Impact:** Single P0 automated signal becomes noise
  - **Contingency:** Increase default timeout, add explicit `waitFor` on the task-list region, rerun before declaring failure

---

## Interworking & Regression

| Service / Component | Impact | Regression Scope |
|---------------------|--------|------------------|
| **Epic 1 — Docker Compose / Caddy / Volume mount** | Epic 2 inherits all of Epic 1's deploy surface; any Epic 1 change re-opens R-011 | Re-run C2 + C3 + C12 on real VPS |
| **Epic 3 — Polish (optimistic UI, mobile)** (future) | Story 3.4 (optimistic UI) will affect R-016 deferred behavior; may also need to revisit C4/C19 if error semantics change | Re-run C4 + C19 + C1; consider adding optimistic-revert scenario |
| **Epic 4 — Multi-user / Auth** (future) | Will close R-018; will introduce `owner_id` filtering as runtime concern (currently boundary-only via R-003) | Re-design coverage from scratch; this Epic 2 plan becomes single-user baseline |
| **Express response builder (Architecture §4.1)** | Single point that owns snake↔camel mapping and `owner_id` strip; any change re-opens R-003 + R-004 | Re-run C5 + C6 + C7 + C8 |
| **Postgres schema** | `CHECK` constraint changes re-open R-006 | Re-run C13 + C14 + C15 |

---

## Honest Gap List (What Is NOT Covered, and Why)

To prevent later auditors from mistaking the spartan automation footprint for an oversight:

1. **No backend unit tests** — Architecture §3.5 rejects Vitest. Risk accepted; mitigated by code review + `curl` recipes.
2. **No frontend component tests** — Same rejection. Mitigated by single E2E (C1) + UI-Manual (C9, C12, C19).
3. **No contract tests** — single deployer + single consumer; no contract-drift surface.
4. **No load/perf tests** — Phase 0 NFR is "responsive for 1 user with ~200 tasks"; eyeball (C24) suffices.
5. **No accessibility automated audit** — out of Phase 0 scope.
6. **No security scanning (SAST/DAST)** — Phase 0 SEC posture is "no auth, deploy behind Tailscale"; SQL injection probe (C20) is the only adversarial test.
7. **No cross-browser matrix** — Playwright default (Chromium) only; documented limitation.
8. **No data-migration tests** — schema is one `CREATE TABLE`; no migrations exist yet.

These gaps are **deliberate and traceable to PRD/Architecture decisions**, not oversights. Re-opening any of them is a Phase 1 conversation.

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run from this design). For Epic 2, this would scaffold the Story 2.7 Playwright spec from C1.
- Run `*automate` if/when Phase 1 expands the test surface beyond a single smoke. **Not applicable in Phase 0** — would violate the architectural discipline gate.
- Run `*trace` to generate a traceability matrix linking C1–C24 back to PRD FR/NFR IDs (recommended pre-launch).

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: _________________ Date: _________
- [ ] Tech Lead: _________________ Date: _________
- [ ] QA Lead (Murat / TEA): Gio Date: 2026-04-29

**Comments:**

This design deliberately and visibly under-automates relative to typical Murat output, in service of the Architecture §3.5 discipline thesis. The honest gap list (above) is the load-bearing element — it makes the trade-off auditable.

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (used for R-001 through R-018 scoring and action thresholds)
- `probability-impact.md` — 1–9 scoring methodology (used for all P × I = Score calculations)
- `test-levels-framework.md` — Test level selection (E2E-Auto vs API-Manual vs UI-Manual vs Ops-Manual)
- `test-priorities-matrix.md` — P0–P3 prioritization criteria

### Related Documents

- **PRD:** `_bmad-output/planning-artifacts/prd.md` (FR1–FR41, NFR5–NFR13, Risk Table)
- **Epics:** `_bmad-output/planning-artifacts/epics.md` (Epic 2, Stories 2.1–2.7)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` (§3.5 single-test discipline, §4.1 response-builder boundary)
- **Risk register & coverage worksheet:** `_bmad-output/test-artifacts/test-design-progress.md` (Steps 1–4 working notes)

---

**Generated by:** BMad TEA Agent — Test Architect Module (Murat persona)
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6) — Epic-Level mode, sequential execution
