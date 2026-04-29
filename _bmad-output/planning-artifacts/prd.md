---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain-skipped
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
releaseMode: phased
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-tasky.md
  - _bmad-output/planning-artifacts/product-brief-tasky-distillate.md
documentCounts:
  briefs: 2
  research: 0
  brainstorming: 0
  projectDocs: 0
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: greenfield
workflowType: 'prd'
---

# Product Requirements Document - bmad-test

**Author:** Gio
**Date:** 2026-04-29

## Executive Summary

Tasky is a single-user, full-stack todo web application delivered as a **Phase 0 foundation build**: a deliberately minimal product, deployed end-to-end in a single day on self-hosted infrastructure, with zero third-party SaaS dependencies. The Phase 0 thesis is narrow and honest — *the todo space doesn't have a feature gap, it has a discipline gap* — and Phase 0 exists to prove the discipline before any commercial claim is made.

The user-facing product does four things and only four things: see your list, add a task, complete a task, delete a task. No login, no projects, no tags, no due dates, no notifications. The empty state is polished; everything else is functional. The application is reachable on the public internet, persists data through refresh and process restart, and works on mobile without horizontal scroll. Everything beyond that is explicitly out of scope for Phase 0.

Architecturally, Phase 0 preserves optionality for a future Phase 1+ wedge — **local-first, privacy-respecting, data-portable productivity** — without committing to it. A nullable `owner_id` column enables future multi-user without a rewrite. No proprietary data formats, no paywall-shaped feature flags, no third-party SDKs that would compromise data portability later. Full backup is `pg_dump`. The architecture earns the *right* to claim that positioning later; Phase 0 does not claim it now.

Acknowledged Phase 0 gaps, accepted as appropriate to scope: no automated backups, no uptime SLO, no monitoring, no incident plan, single-VPS point of failure, no auth or rate limiting. These are explicitly inadequate for any future commercial use and must be addressed before Phase 1.

### What Makes This Special

Phase 0 has **no commercial differentiation** — and the brief says so out loud. That honesty is itself the differentiator from a category whose incumbents drift toward bloat and paywall creep. What Phase 0 establishes are four discipline markers that earn the right to claim more later:

- **Stays minimal on purpose.** No schema fields reserved for premium features, no paywall scaffolding, no "modes for later." The product is conceptually whole rather than a free tier disguised as a product.
- **Velocity as discipline.** Brief-to-deployed in a single day is itself proof of restraint — you cannot bloat what you built in 24 hours. Same-day ship is the first concrete evidence of the minimalism thesis, not a logistics note.
- **Zero third-party SaaS dependencies.** No Vercel, Supabase, Auth0, Firebase, Stripe, or Cloudflare Workers. Postgres + Node only. Any VPS is a valid host. No platform can deprecate, reprice, or sunset Tasky out from under its users.
- **Boring tech, fast iteration.** React + Node + Postgres chosen for shipping speed and forkability, not novelty. Public GitHub repo with `docker-compose.yml` makes the implementation a forkable artifact at marginal cost.

The core insight: every incumbent eventually drifts toward bloat or paywall creep because their *architecture* enables it (premium schema fields, billing dependencies, multi-user data models). The wedge isn't a better feature — it's an architecture and posture that make drift structurally harder. Phase 0 does not prove this thesis; it earns the right to test it.

## Project Classification

- **Project Type:** Web application (React SPA frontend, Node REST API backend, Postgres storage). The documented REST API is a secondary product surface enabling curl/Shortcuts/cron use cases at zero additional cost, but the primary surface is the web app.
- **Domain:** General consumer productivity. No regulated-industry constraints (not healthcare, fintech, govtech, or edtech). Phase 1 privacy positioning is a *commercial wedge*, not a current compliance requirement.
- **Complexity:** Low. Single-table data model, single-user, CRUD-only, no auth, no integrations, no real-time, no AI. Constraint discipline (preserving Phase 1 optionality) is the high-context part; technical and regulatory complexity are genuinely low.
- **Project Context:** Greenfield. No existing system to integrate with or reconcile against. Architectural decisions made in Phase 0 set the foundation for any future phase.

## Success Criteria

Phase 0 success is **binary at end-of-day**: every Must-ship criterion is true, or Phase 0 is not done. The Should-ship and Nice-to-ship tiers are graceful-degradation buckets, not aspirational stretch goals. Phase 0 explicitly **does not measure** signups, retention, NPS, MRR, conversion, latency targets, or telemetry — those are Phase 1+ concerns.

### User Success

A first-time user opening the deployed URL can:

- See the app load and render the empty list state without explanation, instructions, or onboarding screen
- Type a task into the input and see it appear in the list within one frame (optimistic) or one network round-trip (fallback)
- Mark a task complete and see it become visually distinct from active tasks
- Delete a task and see it disappear
- Refresh the browser, close the tab, return later — and find their tasks intact
- Use the app on an iPhone-width viewport without horizontal scroll and with touch targets ≥44px

The user-success bar is *"a generic individual completes every core action without guidance."* No persona narrowing, no friction tolerance, no "users will figure it out." If a first-time user gets stuck, that's a Phase 0 failure.

### Business Success

Phase 0 has **no business success metrics by design.** No revenue, no signups, no retention, no growth — these are Phase 1+ concerns and measuring them in Phase 0 would corrupt the discipline thesis. The brief is explicit on this point and the PRD preserves it.

What Phase 0 *does* establish, that downstream business phases depend on:

- A deployed, working, public-internet artifact (precondition for any future user acquisition)
- A public GitHub repo with `docker-compose.yml` (latent distribution to the homelab/`/r/selfhosted` audience at marginal cost)
- An architecture that has not committed any decisions Phase 1 would need to undo (no third-party SaaS lock-in, no paywall scaffolding, no proprietary data formats)

**Day-2 informal signal (not a ship gate):** the builder uses Tasky to track at least one real personal task. If the builder doesn't reach for it, the discipline thesis hasn't earned anything and Phase 1 should be reconsidered before pursued.

### Technical Success

- Application is reachable on the public internet via HTTPS (TLS via Let's Encrypt or Caddy auto-TLS)
- Reverse proxy in front of the Node process; Postgres bound to localhost only
- Process supervised (systemd service or `docker compose` restart policy) — survives `kill -9` of the Node process
- Postgres data persists across container restart, host reboot, and `systemctl restart postgresql`
- Firewall configured: only ports 80, 443, and 22 open to the public internet
- Environment-based secret configuration (no secrets in repo, no secrets in compose file)
- `docker-compose.yml` brings the full stack up with one command from a clean clone

### Measurable Outcomes

| Outcome | Measurement | Target |
|---|---|---|
| Deployed end-to-end | URL returns 200 over HTTPS from external network | Pass |
| CRUD works without guidance | First-time-user walkthrough (real device, real network) | All four actions succeed without prompting |
| Survives refresh and restart | Add task → refresh browser; add task → `docker compose restart`; add task → `systemctl restart` host | Task present in all three cases |
| Empty state designed | Visual review against polished-empty-state criteria (typography, spacing, copy, no default placeholder text) | Subjective pass by builder |
| Mobile non-broken | Real iPhone test (not devtools): no horizontal scroll, all interactive elements ≥44px on touch | Pass |
| Repo published | Public GitHub repo exists with README (live demo URL, screenshot, philosophy paragraph, quickstart) and `docker-compose.yml` | Pass |
| Optimistic UI (Nice-to-ship) | Add/complete/delete renders before server response; reconciliation does not visibly flicker | Pass *or* gracefully cut |

## Product Scope

Scope is governed by the brief's **brutal cut order**, not by a feature wishlist. Any scope ambiguity defaults to **out**. Phase 0's discipline is what makes Phase 1 possible.

### MVP - Minimum Viable Product

Phase 0 *is* the MVP. There is no smaller increment that would still constitute "Tasky shipped."

**Must-ship (cannot cut):**

- Single-user, no authentication
- React frontend with list view, add input, complete toggle, delete action
- Node REST API with CRUD endpoints (list, create, toggle complete, delete)
- Postgres single-table schema: `tasks (id, description, completed, created_at, owner_id NULLABLE)`
- Deployed to self-hosted VPS with TLS, reverse proxy, supervised process, persistent Postgres volume
- `docker-compose.yml` enabling one-command self-host from a clean clone
- Public GitHub repo with README (demo URL, screenshot, philosophy paragraph, quickstart, API endpoint documentation)

**Should-ship (cut only if running long):**

- Designed empty state (polished — the only "polished" treatment in Phase 0)
- Responsive layout: viewport meta, no horizontal scroll on iPhone width, ≥44px touch targets
- README quality bar: live demo URL, screenshot, philosophy paragraph, quickstart

**Nice-to-ship (first to cut):**

- Optimistic UI with server reconciliation

**Brutal cut order if the day runs long** (drop in this exact sequence):

1. Optimistic UI → fall back to plain request/response with 150ms skeleton row (~2h saved)
2. Polished loading/error states → spinner + inline error string (~1h saved); empty state stays polished
3. Mobile polish → ensure no horizontal scroll only; defer touch refinement (~1h saved)

**Never cut under any circumstances:** persistent Postgres, deployed URL, core CRUD, refresh-survival.

### Growth Features (Post-MVP)

Phase 0 explicitly defers **all** of the following to Phase 1+. They are listed here only so future planning has a record of what was *considered and deferred*, not a roadmap commitment.

- Markdown / JSON export endpoint (Phase 0 backup is `pg_dump`)
- Automated backup and restore
- Authentication and multi-user (the nullable `owner_id` column is the only Phase 0 concession)
- Rate limiting and abuse protection
- Monitoring, uptime SLO, incident response
- Loading and error state polish beyond functional fallbacks
- Mobile polish beyond no-horizontal-scroll baseline

### Vision (Future)

Phase 1+ explores a **local-first, privacy-respecting, data-portable** evolution: offline-first sync, clean export (markdown, JSON, ICS), no third-party tracking, and pricing positioned honestly against incumbent paywall fatigue. Target positioning: *"your tasks, your data, your server, no upsell."*

Two-to-three-year successful state: a small, sustainable indie product with a quietly loyal user base in the Wunderlist-refugee / privacy-conscious / minimalist-aesthetic segments. Not a unicorn. Not the goal.

**Explicitly rejected as Phase 1+ wedges (do not re-propose):**

- AI auto-scheduling / AI assistant (crowded: Motion, Reclaim, Todoist AI)
- Calendar fusion (saturated: Amie, Sunsama, Akiflow, Motion)
- Team collaboration (owned: Superlist, Asana, ClickUp)
- Apple-ecosystem premium positioning (owned: Things 3)
- "Forkable reference implementation" as commercial wedge (considered, rejected)

## User Journeys

Phase 0 has **one functional user role** — *any individual with the URL.* The brief explicitly refuses persona narrowing for the product itself; the success bar is "a generic individual completes every core action without guidance." Inventing persona variety here would re-introduce the very feature-thinking Phase 0 is built to avoid.

The journeys below therefore cover **the same role across different contexts**: first-touch, daily reuse, builder-as-dogfood, and the latent self-hoster who finds the repo. There is no admin journey (no admin exists), no support journey (no support exists), and no separate API consumer journey (the REST API is a documented surface of the same product, exercised by the same individual via curl/Shortcuts/cron — covered as a variant in Journey 4).

### Journey 1: First-Time User — Open URL, Use It

**Who:** Anyone with the deployed URL. No assumed background, no onboarding, no account.

**Opening Scene:** They tap a link or paste the URL. They've used three other todo apps in the past two years and abandoned all of them. They are not expecting to be impressed.

**Rising Action:** The page loads. They see a designed empty state — not a generic blank list with placeholder text, but something that signals *"this is intentional, not lazy."* No signup prompt. No tour overlay. No "Welcome to [App Name]!" modal. There is an input field. They type *"buy milk"* and press Enter.

**Climax:** The task appears in the list within one frame (optimistic UI) or after a brief skeleton row (~150ms fallback if optimistic was cut). They tap the task. It becomes visually distinct as completed. They tap delete. It disappears. The whole interaction took under fifteen seconds and required no instruction.

**Resolution:** They close the tab. Tomorrow they open it again — out of curiosity, not commitment. The list is empty (they deleted everything). They start typing. The product has earned a second visit, which is more than most apps in this category get.

**Capabilities revealed:**
- Polished empty state rendering on first load
- Single-input task creation with immediate feedback
- Visually distinct active vs. completed states
- One-tap delete
- No authentication, no onboarding, no modal interruptions
- Mobile-viable input and touch targets

### Journey 2: Returning User — Refresh, Survive, Persist

**Who:** Same individual as Journey 1, second or third session.

**Opening Scene:** They opened Tasky three days ago, added six tasks, completed two. They closed the tab without thinking about it. Today they need to remember what they were supposed to do.

**Rising Action:** They open the URL. The list loads with all six tasks intact — four still active, two still showing as completed. They mark a third task complete. Mid-action, their network blips. They refresh.

**Climax:** Everything is still there. The completion they just made persisted. They add another task. Network is back. The task syncs. They never had to think about whether their data was safe.

**Resolution:** They close the tab. They restart their laptop. They reopen the URL the next day. List is intact. The product has now passed the *only* trust test that matters in this category: it didn't lose their data.

**Capabilities revealed:**
- Server-side persistence with no client-side data loss
- State recovery across browser close, tab close, network interruption
- No "session" concept to expire
- Backend survives `systemctl restart` and host reboot without losing data

### Journey 3: Builder Dogfood — The Phase 0 Verification Signal

**Who:** Gio (the builder), Day 2 after deploy.

**Opening Scene:** The deploy completed yesterday. The README is published, the screenshot is up, the Docker Compose file is committed. The builder closes the laptop, satisfied. The next morning, they need to remember to renew a domain that's expiring this week.

**Rising Action:** They reach for the nearest todo capture. There are options: Apple Reminders is one swipe away. A `.txt` file on the desktop. A draft Apple Notes. They pause. They open Tasky.

**Climax:** They type *"renew example.com domain Friday"* and close the tab. The action took the same number of seconds as Reminders would have. The deciding factor was not features — it was that opening Tasky did not feel like a chore relative to the alternatives. That is the discipline thesis confirming itself in miniature.

**Resolution:** A week later, the builder has used Tasky for ~40% of their personal task capture (not 100% — Reminders still wins for Siri integration). This is the *informal* Phase 0 success signal. If the builder doesn't reach for it at all, the discipline thesis hasn't earned anything and Phase 1 should be reconsidered before pursued.

**Capabilities revealed:**
- The product must *feel* lightweight in actual reach-for-it moments, not just measure lightweight on paper
- No friction barriers that incumbents lack (load time, login, navigation depth)
- Honest comparison: Tasky competes against the user's *current habit*, not against the next tier of feature-rich incumbents

### Journey 4: Self-Hoster — Discover, Fork, Deploy

**Who:** A `/r/selfhosted` regular. Already runs Pi-hole, Nextcloud, and a Tailscale mesh on a home server. Sees a link to the Tasky repo on Hacker News or in a self-hosting newsletter.

**Opening Scene:** They click the GitHub link. The README loads with a screenshot, a live demo URL, a one-paragraph philosophy statement, and a quickstart that starts with `git clone` and ends with `docker compose up -d`. No "Sign up for early access." No "Star us on GitHub before continuing."

**Rising Action:** They click the live demo URL. They add a task. They mark it done. They go back to the README. They scan the API endpoints section — *yes, plain REST, no auth.* They read the philosophy paragraph. It says what the brief says: minimal on purpose, no third-party SaaS, `pg_dump` is your backup. They check the `docker-compose.yml`. Postgres + Node. Two services. No Redis they don't need, no Auth0 they'll never configure.

**Climax:** They `git clone`, edit a `.env`, run `docker compose up -d` behind their existing Caddy reverse proxy on the home server. Eight minutes from clone to working. They put it behind their Tailscale exit node — single-user-no-auth is exactly right for that deployment pattern.

**Resolution:** They use it for two weeks. They don't need a feature. They don't write an issue. They quietly star the repo. This is the "free distribution at marginal cost" the brief describes — no acquisition spend, no pitch, just an audience that recognizes shape-of-thing-they-want when they see it.

**Capabilities revealed:**
- README is the marketing surface; quality matters
- `docker-compose.yml` must work from clean clone with one command
- API surface documented in README enables curl/Shortcuts/cron use cases without additional design effort
- Public GitHub repo is the distribution channel — no separate marketing site needed for Phase 0
- Single-user-no-auth is a *feature* for this audience, not a limitation

### Journey Requirements Summary

The four journeys collectively reveal a tight, non-overlapping capability set — and notably, **no capabilities outside the brief's must/should-ship lists.** The journeys validate scope rather than expand it.

| Capability area | Journeys revealing it | Phase 0 tier |
|---|---|---|
| Polished empty state | 1 | Should-ship |
| Single-input task creation, immediate feedback | 1, 2, 3 | Must-ship |
| Visually distinct active vs. completed | 1 | Must-ship |
| One-tap delete | 1 | Must-ship |
| Server-side persistence (refresh, restart, reboot) | 2 | Must-ship |
| No authentication, no onboarding | 1, 4 | Must-ship (by exclusion) |
| Mobile-viable layout and touch | 1, 3 | Should-ship |
| Optimistic UI (with skeleton-row fallback) | 1 | Nice-to-ship |
| Public deployed URL over HTTPS | 1, 2, 4 | Must-ship |
| Public GitHub repo with README + screenshot + philosophy + quickstart | 4 | Should-ship |
| `docker-compose.yml` for one-command self-host | 4 | Must-ship |
| Documented REST API enabling curl/Shortcuts/cron | 4 | Must-ship (documentation in README) |

**Notably absent from the journeys (and confirmed out of scope):** task editing, search, filtering, due dates, reminders, tags, projects, collaboration, sharing, settings, themes, accounts, password recovery, email anything, push anything. None of these appear in any journey because none of them are needed for the Phase 0 user to succeed.

## Innovation & Novel Patterns

**Skipped honestly.** Phase 0 is an explicit *anti-innovation* deliverable: the brief states *"Boring tech, fast iteration. React + Node + Postgres is conservative on purpose. Stack chosen for shipping and forkability, not novelty."* The web-app project type's innovation signals (new interaction patterns, WebAssembly use) are absent by design.

The closest thing to a novel claim — that *discipline-as-architecture* is a defensible commercial wedge — is positioning, not technical innovation, and is already documented in the Executive Summary's "What Makes This Special." Re-stating it here would be innovation theater.

If Phase 1+ pursues the local-first / data-portable wedge, novel patterns may emerge there (offline-first sync model, export-format design, honest pricing structure). Those belong in a Phase 1 PRD, not Phase 0.

## Web Application Specific Requirements

### Project-Type Overview

Tasky is a **single-page React application** served from a Node-based reverse-proxied origin, with all task data persisted in a single Postgres table behind a documented REST API. SPA (not MPA): there is one view (the list), no client-side router, no SSR, no static-site generation. The decision is downstream of the brief's minimalism mandate, not a performance optimization — there is no second page to route to.

The REST API is a **first-class secondary surface**: documented in the README so curl, iOS Shortcuts, cron jobs, and homelab automation can use it directly. It is not a separate product, but it is intentionally usable independently of the React UI.

### Technical Architecture Considerations

| Concern | Decision | Rationale |
|---|---|---|
| Architecture | SPA (React) + REST API (Node) + Postgres | Brief mandate; smallest-shippable shape |
| Rendering | Client-side only | One view, no SEO requirement, no shared-link use case |
| Routing | None (single view) | Nothing to route to |
| State management | Local component state, no global store | Single list, no cross-component sharing required |
| API style | REST, JSON, no auth | Matches brief; enables curl/Shortcuts/cron at zero cost |
| Optimistic updates | Yes (Nice-to-ship; cuttable) | Perceived performance; falls back to skeleton row |
| Error handling | Inline error string, no toast/modal | Functional, not polished — Should-ship tier only |
| Bundle size budget | No explicit target | Phase 0 has one screen; budget would be theater |
| Build tooling | Standard React tooling (Vite or CRA-equivalent) | Boring tech; Phase 0 does not invent build pipelines |

### Browser Support Matrix

The brief does not specify a browser matrix. Reasonable Phase 0 default consistent with the brief's "any individual with the URL" success bar:

- **Tier 1 (must work, tested):** Latest Chrome, latest Safari (desktop and iOS), latest Firefox
- **Tier 2 (should work, untested):** Latest Edge, Chromium-based Android browsers
- **Out of scope:** IE11, legacy Safari (<2 years old), Opera Mini, in-app webviews

If a Tier 1 browser breaks Tasky, that's a Phase 0 bug. Tier 2 issues are deferred.

### Responsive Design

**Hard requirements (Should-ship):**
- Viewport meta tag set (`width=device-width, initial-scale=1`)
- No horizontal scroll on iPhone-width viewport (verified on real device, not devtools)
- All interactive elements ≥44px touch target on mobile

**Out of scope for Phase 0:**
- Tablet-specific layout
- Landscape-specific layout
- High-DPI optimization beyond browser defaults
- Touch gestures (swipe-to-delete, pull-to-refresh)

The Phase 0 mobile bar is *"doesn't visibly break"* — not *"feels native."* Mobile polish is the third item in the brutal cut order.

### Performance Targets

The brief explicitly does not set performance targets in Phase 0 (*"Explicitly not Phase 0 success metrics: ... server P95 latency targets, real telemetry"*). Setting targets here would contradict the brief.

Reasonable *implicit* expectations consistent with "feels lightweight in actual reach-for-it moments" (Journey 3):

- App shell loads and renders empty state under typical broadband in under one second
- Optimistic add/complete/delete renders within one frame (~16ms) when optimistic UI is enabled
- Skeleton-row fallback (if optimistic UI cut) appears within ~150ms

These are **not** Phase 0 success criteria — they are sanity guardrails for the builder. No measurement infrastructure in Phase 0.

### SEO Strategy

**None.** Tasky is a single-user app behind a personal URL. There is nothing to index, no shareable content, no public-facing pages beyond the login-less list itself. The marketing surface is the **public GitHub repo and its README** — not the app URL.

Implications:

- No meta description or Open Graph tags required
- No `robots.txt` directives needed (default crawl behavior is fine — there is no content to discover)
- No sitemap
- The app URL may be (and probably should be) excluded from search indexing if behind Tailscale/Cloudflare Tunnel anyway

### Accessibility Level

The brief does not specify an accessibility target. Honest Phase 0 baseline:

- Semantic HTML (use `<button>` not `<div onClick>`, `<input>` not contenteditable, `<ul>`/`<li>` for the list)
- Keyboard operable (tab navigation works, Enter submits new task, Escape clears input)
- Visible focus states (browser defaults are acceptable Phase 0 — do not remove)
- Sufficient color contrast for active vs. completed states (WCAG AA contrast ratio ~4.5:1 for text)

**Out of scope for Phase 0:** ARIA live regions for task add/delete announcements, screen reader testing pass, full WCAG 2.1 AA audit, high-contrast mode, reduced-motion preferences. These are Phase 1+ if/when the audience expands beyond the builder.

### API Surface

The REST API is part of the product surface and documented in the README. Phase 0 endpoints:

| Method | Path | Purpose | Request body | Response |
|---|---|---|---|---|
| `GET` | `/api/tasks` | List all tasks | — | `200 [{...task}, ...]` |
| `POST` | `/api/tasks` | Create task | `{ description: string }` | `201 {...task}` |
| `PATCH` | `/api/tasks/:id` | Toggle complete | `{ completed: boolean }` | `200 {...task}` |
| `DELETE` | `/api/tasks/:id` | Delete task | — | `204` |

Task object shape: `{ id, description, completed, created_at, owner_id }`.

**Phase 0 explicitly does not include:**
- Authentication (intentional — brief mandate)
- Rate limiting (acknowledged operational gap)
- Versioning (`/api/v1/...` prefix is fine to add later if needed; Phase 0 does not commit)
- OpenAPI/Swagger spec (the README endpoint table *is* the documentation)
- A `PUT` endpoint for editing task description (task editing is out of scope)
- Pagination (single user, expected list size <1000)
- Filtering, sorting, or query parameters
- Webhooks or server-sent events
- A separate health-check endpoint (a successful `GET /api/tasks` is the health check)

### Implementation Considerations

- **Frontend bundle:** Standard React + minimal dependencies. No UI library required for one screen — a small stylesheet covers it. If Tailwind is already familiar to the builder, fine; otherwise, vanilla CSS is faster to ship.
- **API contract:** Frontend talks to `/api/*` on the same origin (no CORS). Reverse proxy routes `/api/*` to Node and everything else to the static React build.
- **Postgres schema migrations:** Single CREATE TABLE statement run on first boot. No migration framework required for Phase 0. Document the schema in the README so `pg_dump` recipients can recreate it.
- **Environment variables:** `DATABASE_URL`, `PORT`, `NODE_ENV`. No third-party service keys (none should exist).
- **Logging:** stdout/stderr to the supervisor (systemd journal or `docker compose logs`). No structured logging framework, no log shipping, no APM.
- **Healthchecks:** Compose-level healthcheck on Postgres (`pg_isready`) and Node (`GET /api/tasks` returning 200) acceptable; not a Phase 0 hard requirement.

## Project Scoping & Phased Development

**Note on scoping authority:** the brief already defines phasing (Phase 0 foundation build → Phase 1+ commercial exploration) and within-Phase-0 tiering (Must-ship / Should-ship / Nice-to-ship + a brutal cut order). The PRD inherits that scope structure rather than inventing a new one. The Product Scope section earlier in this document is the canonical scope — this section adds *strategic framing*, *risk analysis*, and *post-Phase-0 phasing* without redefining what's in or out.

### MVP Strategy & Philosophy

**MVP Approach:** *Problem-solving + experience MVP.* Phase 0 ships the smallest possible working surface that solves the user's core problem (capture, see, complete, delete a task) at a quality level the builder is willing to dogfood. It is not a *revenue MVP* (no monetization), not a *platform MVP* (no extensibility surface beyond a documented REST API), and not a *learning MVP* in the lean-startup sense (no measured hypotheses to validate against users).

What is being validated in Phase 0 is narrower and honest:

1. **The discipline thesis at builder scale** — can the builder ship a deliberately minimal product without scope drift in one day, on owned infra, with zero third-party SaaS?
2. **Architectural optionality** — does the Phase 0 codebase preserve the technical right to build the local-first / data-portable Phase 1 wedge without rewrite?

Neither validation involves external users. Both are answerable on Day 2 by the builder.

**Resource Requirements:** One builder (Gio), one day, one VPS already provisioned or being provisioned during Phase 0. No team. No additional roles. The brief's deployment-risk note flags this is the highest-risk single bullet (4–5h realistic budget for first-time-on-this-VPS path; 2h floor if experienced on the exact stack and VPS) — start it first, not last.

### Phase 0 Feature Set (this release)

The complete Phase 0 scope is documented in the **Product Scope** section above. Summary:

**Core User Journeys Supported:**
- Journey 1: First-time user opens URL and uses the app without guidance
- Journey 2: Returning user finds data intact across refresh, restart, and reboot
- Journey 3: Builder dogfood — informal Day-2 validation
- Journey 4: Self-hoster discovers repo and self-deploys via Docker Compose

**Must-Ship Capabilities (cannot cut):** Single-user no-auth React app, Node REST API (list/create/toggle/delete), Postgres single-table persistence, deployed VPS with TLS + reverse proxy + supervised process + persistent volume, `docker-compose.yml`, public GitHub repo with README.

**Should-Ship Capabilities (cuttable in order):** Polished empty state, mobile non-breakage (no horizontal scroll, ≥44px touch), README quality bar (live demo URL, screenshot, philosophy paragraph, quickstart).

**Nice-to-Ship Capabilities (cut first):** Optimistic UI with server reconciliation.

**Brutal cut order if running long:** optimistic UI → polished loading/error → mobile polish. **Never cut:** persistent Postgres, deployed URL, core CRUD, refresh-survival.

### Post-Phase-0 Features (deferred — not committed)

These are documented as *acknowledged-and-deferred*, not as a roadmap commitment. The brief is explicit that Phase 1 is *"a conversation for another day."*

**Phase 1 candidates (operational hardening — likely required before any external user use):**

- Automated backup and restore
- Uptime monitoring and basic incident response
- Rate limiting and abuse protection
- Authentication and multi-user (the nullable `owner_id` is the architectural enabler)
- Markdown / JSON export endpoint (the user-facing portability claim, distinct from `pg_dump`)

**Phase 1+ candidates (commercial wedge exploration — requires explicit Phase 1 PRD):**

- Local-first / offline sync model
- Honest-pricing positioning and billing infrastructure
- Domain, branding, real product name (replacing the "Tasky" codename)
- Distribution decisions (Show HN, /r/selfhosted, IndieHackers — currently rejected for Phase 0, deferred to Phase 1)

**Explicitly rejected as Phase 1+ wedges (do not re-propose without new evidence):**

- AI auto-scheduling / AI assistant
- Calendar fusion
- Team collaboration features
- Apple-ecosystem premium positioning
- "Forkable reference implementation" as commercial wedge

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| First-time VPS deploy consumes the day before app is built | High | Brief explicitly recommends starting deploy *first*, not last. 4–5h realistic budget for first-time-on-this-VPS, 2h floor if experienced. If deploy is not green by mid-day, cut Nice-to-ship and re-prioritize. |
| TLS / reverse proxy misconfiguration | Medium | Caddy auto-TLS is the lowest-friction path; falls back to Let's Encrypt + manual config. Validate end-to-end before building features. |
| Postgres persistence misconfigured (volume not mounted, container ephemeral) | Medium | Test refresh-survival explicitly before declaring done. `docker compose down && up` must preserve data. |
| Optimistic UI introduces sync bugs | Low | This is the first cut item; if any sync flakiness appears, drop optimistic UI immediately. |
| Browser-specific layout breakage on iPhone | Low | Real-device test required (not devtools). Catch before declaring Should-ship complete. |

**Market Risks:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Phase 0 has no commercial differentiation — could be perceived as "yet another todo demo" | High (but accepted) | Brief embraces this. README's philosophy paragraph and "Phase 0 / honest framing" voice are the distribution-tier mitigation. Do not regress to launch puffery. |
| Self-hoster audience does not discover the repo | High | Phase 0 does not budget for distribution; discovery is incidental, not pursued. Acceptable per brief. |
| Phase 1 wedge is unproven and may not materialize | Medium | Phase 0 architectural constraints preserve optionality without committing. If Phase 1 is never pursued, Phase 0 remains a working personal todo app and a forkable artifact — both are acceptable terminal states. |

**Resource Risks:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Builder runs out of time mid-day | Medium | Brutal cut order is pre-defined. No mid-day re-planning required — execute the cut order in sequence. |
| Builder's energy collapses before deploy completes | Medium | Deploy *first* (per brief), CRUD second, polish last. Worst-case outcome is "deployed app with rough edges" rather than "polished local-only app." |
| Builder writes a blog post / philosophy piece instead of shipping | Medium-low | Out of scope. Marketing surface = README only. |

## Functional Requirements

The capability contract for Phase 0. Every FR traces back to the brief's must/should/nice tiering and the four user journeys. Implementation-agnostic by design: each FR states *what capability exists*, not *how it's built*. Phase 1+ capabilities are explicitly excluded — see "Out of Scope" subsection.

Each FR is tagged with its scope tier: **[M]** Must-ship, **[S]** Should-ship, **[N]** Nice-to-ship.

### Task Management

- FR1: **[M]** A user can view a list of all their tasks on a single screen
- FR2: **[M]** A user can create a new task by entering a description and submitting
- FR3: **[M]** A user can toggle a task between active and completed states
- FR4: **[M]** A user can delete a task
- FR5: **[M]** A task displays its description and a visually distinct active-vs-completed state
- FR6: **[M]** A user can perform create/toggle/delete actions without page reload or navigation

### Persistence & State Recovery

- FR7: **[M]** The system persists every task to durable server-side storage immediately on create/toggle/delete
- FR8: **[M]** The system retains all tasks across browser tab close, browser restart, and device restart
- FR9: **[M]** The system retains all tasks across application process restart (e.g., `docker compose restart`, `systemctl restart`)
- FR10: **[M]** The system retains all tasks across host VPS reboot via persistent storage volume
- FR11: **[M]** The system has no client-only state that would be lost on refresh

### Access & Identity

- FR12: **[M]** Any individual with the deployed URL can use the application without authentication, account creation, or onboarding flow
- FR13: **[M]** The system stores task ownership metadata in a nullable form that preserves the architectural option to add multi-user identity later without schema rewrite

### REST API Surface

- FR14: **[M]** A client can retrieve the complete list of tasks via an HTTP GET endpoint returning JSON
- FR15: **[M]** A client can create a task via an HTTP POST endpoint accepting a JSON description
- FR16: **[M]** A client can toggle task completion via an HTTP PATCH endpoint accepting a JSON completed flag
- FR17: **[M]** A client can delete a task via an HTTP DELETE endpoint
- FR18: **[M]** All API endpoints are usable without authentication credentials, enabling curl, iOS Shortcuts, and cron consumption
- FR19: **[M]** All API endpoints return JSON request/response bodies on a documented same-origin path prefix
- FR20: **[M]** The API documentation surface (endpoint table, task object shape) is published in the repository README

### Empty State & First-Use Experience

- FR21: **[S]** The system renders a deliberately designed empty state on first load (not generic placeholder text)
- FR22: **[M]** The system displays no signup prompt, tour overlay, welcome modal, or interruption on first load
- FR23: **[M]** A first-time user can complete create/toggle/delete actions without external instruction or in-app guidance

### Mobile & Responsive Behavior

- FR24: **[S]** The system renders without horizontal scrolling on iPhone-width viewports
- FR25: **[S]** All interactive elements present a touch target of at least 44 pixels on mobile viewports
- FR26: **[S]** The system declares a viewport meta directive enabling mobile-appropriate scaling

### Perceived Performance

- FR27: **[N]** The system renders create/toggle/delete actions optimistically before server confirmation, with reconciliation on response
- FR28: **[N]** When optimistic rendering is unavailable or cut, the system displays a skeleton placeholder for in-flight create actions

### Error Surfacing

- FR29: **[M]** The system surfaces request failures to the user via an inline error string (no silent failures)
- FR30: **[M]** The system does not block subsequent user actions when a single request fails

### Deployment & Self-Hosting

- FR31: **[M]** The complete application stack can be brought up from a clean repository clone via a single `docker compose up` command
- FR32: **[M]** The Docker Compose configuration includes the Postgres service with a named persistent volume
- FR33: **[M]** The application is reachable at a publicly resolvable URL over HTTPS
- FR34: **[M]** The application runs behind a supervised process manager that restarts the application on crash and on host reboot

### Repository & Distribution Surface

- FR35: **[M]** A public repository hosts the application source code
- FR36: **[S]** The repository README contains a live demo URL, a screenshot of the running application, a one-paragraph philosophy statement, a quickstart sequence, and the API endpoint documentation
- FR37: **[M]** The repository contains the `docker-compose.yml` and any environment-variable example file required to deploy from a clean clone

### Schema & Data Shape

- FR38: **[M]** The system stores each task with a unique identifier, a description string, a completion flag, a creation timestamp, and a nullable owner identifier
- FR39: **[M]** The database schema is documented in the README at sufficient detail to recreate the schema from a `pg_dump` output

### Operational Baseline (Phase 0 floor only)

- FR40: **[M]** The application emits stdout and stderr logs to its supervisor (no structured logging framework or log shipping required)
- FR41: **[M]** The deployed application is verifiable as working by an external `GET /api/tasks` returning HTTP 200

### Out of Scope (explicitly not Functional Requirements in Phase 0)

The following are documented here so downstream roles (UX, architecture, epic breakdown) cannot accidentally treat their absence as oversight. Each is *acknowledged-and-deferred*, not forgotten:

- Task editing (no `PUT` endpoint, no in-place description edit)
- Task search, filtering, sorting, tagging, projects, due dates, reminders, recurrence
- Multi-user authentication, accounts, password recovery, sessions
- Sharing, collaboration, real-time multi-client sync
- Settings screen, themes, customization, preferences
- Markdown / JSON / ICS export endpoint (Phase 0 backup is `pg_dump`)
- Automated backup, restore, point-in-time recovery
- Rate limiting, abuse protection, CAPTCHA
- Email, push notifications, webhooks, server-sent events
- Pagination, infinite scroll (single-user, expected list size <1000)
- Offline-first sync, local-first storage model (Phase 1+ wedge candidate)
- Monitoring dashboards, uptime SLO, structured incident response
- API versioning prefix, OpenAPI/Swagger spec
- Tablet-specific layout, landscape-specific layout, touch gestures (swipe, pull-to-refresh)
- ARIA live regions, screen-reader testing pass, full WCAG 2.1 AA audit
- Dedicated health-check endpoint (`GET /api/tasks` is the health check)

**Capability contract reminder:** This list is binding. Any feature not above will not exist in Phase 0 unless explicitly added by amending this PRD.

## Non-Functional Requirements

NFRs in Phase 0 are deliberately sparse. The brief is explicit: *"Explicitly not Phase 0 success metrics: usage volume, retention, conversion, NPS, server P95 latency targets, real telemetry."* Documenting elaborate NFRs here would contradict the brief's discipline thesis and re-introduce the requirement bloat Phase 0 was built to refuse.

The NFRs below are limited to **categories with actual user-facing or operational consequence in Phase 0**. Categories explicitly excluded — and *why* — are listed at the end so downstream roles understand the omission is deliberate.

Each NFR is tagged with its scope tier: **[M]** Must-meet, **[S]** Should-meet, **[N]** Nice-to-meet.

### Performance (sanity guardrails, not measured targets)

The brief forbids formal performance targets in Phase 0. The values below are *builder-judgment guardrails* aligned with Journey 3's "feels lightweight in actual reach-for-it moments" — they are **not** Phase 0 success criteria and **not** instrumented.

- NFR1: **[S]** App shell loads and renders the empty state in under one second on typical broadband (judgment, not measured)
- NFR2: **[N]** Optimistic create/toggle/delete actions render within one frame (~16ms) when optimistic UI is enabled
- NFR3: **[S]** When optimistic UI is unavailable or cut, in-flight create actions surface a placeholder within ~150ms
- NFR4: **[M]** No action shall block the UI thread for longer than the user can perceive as "stuck" (qualitative; if it feels slow, it is)

### Reliability & Data Durability

This is the *one* NFR area where Phase 0 is uncompromising — it is the only trust test that matters in this product category (Journey 2).

- NFR5: **[M]** Zero task data loss across browser refresh, browser restart, device restart, application process restart, or host VPS reboot
- NFR6: **[M]** Database persistence is verified by an explicit test sequence (add task → `docker compose down && up` → task still present) before Phase 0 is declared complete
- NFR7: **[M]** Application supervisor restarts the application process automatically on crash and on host boot
- NFR8: **[S]** A successful response from the canonical API endpoint constitutes the operational health signal (no separate dashboard, monitor, or alert in Phase 0)

### Security (Phase 0 baseline only)

The brief excludes authentication and rate limiting from Phase 0. Security NFRs are therefore limited to the *floor* below which the deployment is irresponsible regardless of single-user scope.

- NFR9: **[M]** All traffic to the deployed application is served over HTTPS with a valid TLS certificate
- NFR10: **[M]** No third-party tracking, analytics, advertising, or telemetry SDK is included in the application bundle
- NFR11: **[M]** No secrets, credentials, or environment-variable values are committed to the public repository
- NFR12: **[M]** Database credentials and any application secrets are supplied via environment variables, not source code
- NFR13: **[S]** The application is deployable behind an additional access boundary (Tailscale, Cloudflare Tunnel, basic-auth at reverse proxy) at the operator's discretion without code modification

**Acknowledged Phase 0 security gaps** (deferred to Phase 1, documented honestly):

- No authentication on the application or the API — anyone with the URL can read, write, and delete all tasks
- No rate limiting — a single misbehaving client can saturate the database
- No abuse protection, CAPTCHA, or input-rate enforcement
- These gaps are acceptable for the Phase 0 deployment pattern (private URL, behind Tailscale or similar) and **block any external-user use** until Phase 1 hardening lands.

### Accessibility (baseline only)

The brief does not specify an accessibility target. Phase 0 commits to a semantic-HTML floor and no further. A full WCAG audit is Phase 1+ if/when audience expands.

- NFR14: **[M]** All interactive elements use semantic HTML (`<button>`, `<input>`, `<ul>`/`<li>`) — not `<div onClick>` substitutes
- NFR15: **[M]** All core actions (create, toggle, delete) are operable via keyboard alone (Tab navigation, Enter to submit, Escape to clear input)
- NFR16: **[M]** Browser-default focus indicators are preserved (not `outline: none`)
- NFR17: **[S]** Active-vs-completed task states meet WCAG AA contrast ratio (~4.5:1 for text)

### Usability

- NFR18: **[M]** A first-time user can complete the full create/toggle/delete loop without external instruction (validated by Journey 1 walkthrough on a real device, not devtools)
- NFR19: **[S]** No interaction requires more than one tap or one keystroke beyond the action's intrinsic input (no confirmation dialogs, no multi-step flows)

### Maintainability & Self-Hostability

- NFR20: **[M]** A self-hoster can clone the repository and reach a working application in under 15 minutes on a Linux host with Docker installed (Journey 4 budget — informally validated, not formally timed)
- NFR21: **[M]** The application stack runs as exactly two services (Node + Postgres) with no third-party SaaS dependencies required for operation
- NFR22: **[M]** The complete application can be backed up via `pg_dump` and restored via `psql`, with the schema documented in the README
- NFR23: **[S]** No dependency in the production stack requires a paid license, paid tier, or registration to operate

### Deferred Categories (intentionally excluded from Phase 0)

Documented here so downstream roles cannot mistake absence for oversight:

- **Scalability** — single-user, expected list size <1000, no concurrent-user scenario. Capacity planning would be theater.
- **Localization / Internationalization** — single-builder use; English-only.
- **Disaster Recovery / Business Continuity** — `pg_dump` is the manual recovery path; no automated DR is in Phase 0 scope.
- **Compliance** (GDPR, CCPA, SOC2, HIPAA) — no external user data, no commercial offering, no regulated data category. Becomes a real concern only at Phase 1+ commercial activation.
- **Observability** (APM, distributed tracing, structured logging, metrics dashboards) — stdout to supervisor is the entire observability surface in Phase 0.
- **SLO / SLA** — no users, no agreements, no error budget.
- **Browser-version compatibility matrix beyond "latest evergreen"** — see Browser Support Matrix; Phase 0 does not test or guarantee older browsers.
- **Audit logging** — no multi-actor system to audit.
- **Data retention policies** — no retention story other than "user deletes when they want to."

**NFR contract reminder:** As with FRs, this is binding. If an NFR area is missing here, it is *acknowledged-and-deferred* to Phase 1+, not an oversight.
