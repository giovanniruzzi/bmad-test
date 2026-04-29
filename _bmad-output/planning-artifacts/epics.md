---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# bmad-test - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bmad-test (Tasky), decomposing the requirements from the PRD and Architecture into implementable stories. No UX Design Specification exists for this project; UX-related requirements are captured within the PRD's FRs (mobile/responsive, empty state, accessibility) and within the Architecture's frontend pattern decisions.

**Scope:** 3 epics, 16 stories total — Epic 1 (5 stories), Epic 2 (7 stories), Epic 3 (4 stories).

**How to read this document:** Stories are sequenced; do not skip. Each story's **Given** clause cites its prerequisite story or epic. Tier markers `[M]` / `[S]` / `[N]` on requirements mean **Must-ship** / **Should-ship** / **Nice-to-ship** — per the PRD's brutal cut order.

## Requirements Inventory

### Functional Requirements

**Task Management**

- FR1: **[M]** A user can view a list of all their tasks on a single screen
- FR2: **[M]** A user can create a new task by entering a description and submitting
- FR3: **[M]** A user can toggle a task between active and completed states
- FR4: **[M]** A user can delete a task
- FR5: **[M]** A task displays its description and a visually distinct active-vs-completed state
- FR6: **[M]** A user can perform create/toggle/delete actions without page reload or navigation

**Persistence & State Recovery**

- FR7: **[M]** The system persists every task to durable server-side storage immediately on create/toggle/delete
- FR8: **[M]** The system retains all tasks across browser tab close, browser restart, and device restart
- FR9: **[M]** The system retains all tasks across application process restart (e.g., `docker compose restart`, `systemctl restart`)
- FR10: **[M]** The system retains all tasks across host VPS reboot via persistent storage volume
- FR11: **[M]** The system has no client-only state that would be lost on refresh

**Access & Identity**

- FR12: **[M]** Any individual with the deployed URL can use the application without authentication, account creation, or onboarding flow
- FR13: **[M]** The system stores task ownership metadata in a nullable form that preserves the architectural option to add multi-user identity later without schema rewrite

**REST API Surface**

- FR14: **[M]** A client can retrieve the complete list of tasks via an HTTP GET endpoint returning JSON
- FR15: **[M]** A client can create a task via an HTTP POST endpoint accepting a JSON description
- FR16: **[M]** A client can toggle task completion via an HTTP PATCH endpoint accepting a JSON completed flag
- FR17: **[M]** A client can delete a task via an HTTP DELETE endpoint
- FR18: **[M]** All API endpoints are usable without authentication credentials, enabling curl, iOS Shortcuts, and cron consumption
- FR19: **[M]** All API endpoints return JSON request/response bodies on a documented same-origin path prefix
- FR20: **[M]** The API documentation surface (endpoint table, task object shape) is published in the repository README

**Empty State & First-Use Experience**

- FR21: **[S]** The system renders a deliberately designed empty state on first load (not generic placeholder text)
- FR22: **[M]** The system displays no signup prompt, tour overlay, welcome modal, or interruption on first load
- FR23: **[M]** A first-time user can complete create/toggle/delete actions without external instruction or in-app guidance

**Mobile & Responsive Behavior**

- FR24: **[S]** The system renders without horizontal scrolling on iPhone-width viewports
- FR25: **[S]** All interactive elements present a touch target of at least 44 pixels on mobile viewports
- FR26: **[S]** The system declares a viewport meta directive enabling mobile-appropriate scaling

**Perceived Performance**

- FR27: **[N]** The system renders create/toggle/delete actions optimistically before server confirmation, with reconciliation on response
- FR28: **[N]** When optimistic rendering is unavailable or cut, the system displays a skeleton placeholder for in-flight create actions

**Error Surfacing**

- FR29: **[M]** The system surfaces request failures to the user via an inline error string (no silent failures)
- FR30: **[M]** The system does not block subsequent user actions when a single request fails

**Deployment & Self-Hosting**

- FR31: **[M]** The complete application stack can be brought up from a clean repository clone via a single `docker compose up` command
- FR32: **[M]** The Docker Compose configuration includes the Postgres service with a named persistent volume
- FR33: **[M]** The application is reachable at a publicly resolvable URL over HTTPS
- FR34: **[M]** The application runs behind a supervised process manager that restarts the application on crash and on host reboot

**Repository & Distribution Surface**

- FR35: **[M]** A public repository hosts the application source code
- FR36: **[S]** The repository README contains a live demo URL, a screenshot of the running application, a one-paragraph philosophy statement, a quickstart sequence, and the API endpoint documentation
- FR37: **[M]** The repository contains the `docker-compose.yml` and any environment-variable example file required to deploy from a clean clone

**Schema & Data Shape**

- FR38: **[M]** The system stores each task with a unique identifier, a description string, a completion flag, a creation timestamp, and a nullable owner identifier
- FR39: **[M]** The database schema is documented in the README at sufficient detail to recreate the schema from a `pg_dump` output

**Operational Baseline**

- FR40: **[M]** The application emits stdout and stderr logs to its supervisor (no structured logging framework or log shipping required)
- FR41: **[M]** The deployed application is verifiable as working by an external `GET /api/tasks` returning HTTP 200

### NonFunctional Requirements

**Performance (sanity guardrails, not measured targets)**

- NFR1: **[S]** App shell loads and renders the empty state in under one second on typical broadband (judgment, not measured)
- NFR2: **[N]** Optimistic create/toggle/delete actions render within one frame (~16ms) when optimistic UI is enabled
- NFR3: **[S]** When optimistic UI is unavailable or cut, in-flight create actions surface a placeholder within ~150ms
- NFR4: **[M]** No action shall block the UI thread for longer than the user can perceive as "stuck"

**Reliability & Data Durability**

- NFR5: **[M]** Zero task data loss across browser refresh, browser restart, device restart, application process restart, or host VPS reboot
- NFR6: **[M]** Database persistence is verified by an explicit test sequence (add task → `docker compose down && up` → task still present) before Phase 0 is declared complete
- NFR7: **[M]** Application supervisor restarts the application process automatically on crash and on host boot
- NFR8: **[S]** A successful response from the canonical API endpoint constitutes the operational health signal

**Security (Phase 0 baseline only)**

- NFR9: **[M]** All traffic to the deployed application is served over HTTPS with a valid TLS certificate
- NFR10: **[M]** No third-party tracking, analytics, advertising, or telemetry SDK is included in the application bundle
- NFR11: **[M]** No secrets, credentials, or environment-variable values are committed to the public repository
- NFR12: **[M]** Database credentials and any application secrets are supplied via environment variables, not source code
- NFR13: **[S]** The application is deployable behind an additional access boundary (Tailscale, Cloudflare Tunnel, basic-auth) at the operator's discretion without code modification

**Accessibility (baseline only)**

- NFR14: **[M]** All interactive elements use semantic HTML (`<button>`, `<input>`, `<ul>`/`<li>`) — not `<div onClick>` substitutes
- NFR15: **[M]** All core actions (create, toggle, delete) are operable via keyboard alone (Tab navigation, Enter to submit, Escape to clear input)
- NFR16: **[M]** Browser-default focus indicators are preserved (not `outline: none`)
- NFR17: **[S]** Active-vs-completed task states meet WCAG AA contrast ratio (~4.5:1 for text)

**Usability**

- NFR18: **[M]** A first-time user can complete the full create/toggle/delete loop without external instruction (validated by Journey 1 walkthrough on a real device)
- NFR19: **[S]** No interaction requires more than one tap or one keystroke beyond the action's intrinsic input (no confirmation dialogs, no multi-step flows)

**Maintainability & Self-Hostability**

- NFR20: **[M]** A self-hoster can clone the repository and reach a working application in under 15 minutes on a Linux host with Docker installed
- NFR21: **[M]** The application stack runs as exactly two services (Node + Postgres) with no third-party SaaS dependencies required for operation (Caddy adds a third reverse-proxy service per Architecture §3.4 — acceptable extension of this constraint)
- NFR22: **[M]** The complete application can be backed up via `pg_dump` and restored via `psql`, with the schema documented in the README
- NFR23: **[S]** No dependency in the production stack requires a paid license, paid tier, or registration to operate

### Additional Requirements

Technical and infrastructure requirements derived from the Architecture document that affect implementation:

- **Starter template (Architecture §2):** Frontend scaffolded via official Vite `react-ts` template (`npm create vite@latest web -- --template react-ts`). Backend scaffolded by hand (`mkdir api && npm init -y && npm install express pg && npm install -D typescript @types/node @types/express tsx`). This affects Epic 1 Story 1.
- **Locked stack versions (Architecture §3):** React 19.2, Vite 8.0, TypeScript 5.x, Node.js 24 LTS, Express 5.1, PostgreSQL 17, Caddy 2.x. Pin via `.nvmrc` and Dockerfile base images.
- **Schema bootstrap mechanism (Architecture §3.3):** `db/init.sql` mounted into the Postgres container's `/docker-entrypoint-initdb.d/` directory. No migration framework. Schema is the locked `CREATE TABLE` from Architecture §3.3 with a `CHECK` constraint enforcing description length 1–500 chars and `BIGSERIAL` primary key.
- **Same-origin serving (Architecture §3.4):** Caddy reverse proxy routes `/api/*` to the Node container and serves `/*` from the static React `dist/` build. No CORS configuration in the API.
- **Deployment topology (Architecture §3.4):** Three services in `docker-compose.yml`: `web` (Caddy serving static + reverse proxy), `api` (Node + Express), `db` (Postgres 17). Named volume `tasky_pgdata`. All services use `restart: unless-stopped`. Internal Docker network for `api → db` connectivity (db hostname is `db`).
- **Multi-stage Dockerfiles (Architecture §3.4):** Both `api` and `web` use multi-stage Dockerfiles producing minimal runtime images.
- **Auto-TLS (Architecture §3.4):** Caddy auto-TLS via Let's Encrypt configured by Caddyfile directive. Requires a domain name with DNS pointed at the VPS.
- **Healthcheck (Architecture §1.4):** Docker Compose `healthcheck` on Postgres so the API waits for DB readiness on first boot.
- **Graceful shutdown (Architecture §4.4):** Node API listens for `SIGTERM`, closes the HTTP server and the `pg.Pool` cleanly. Required for clean Docker stops.
- **Naming convention boundary (Architecture §4.1):** DB columns use `snake_case` (`created_at`, `owner_id`); API JSON uses `camelCase` (`createdAt`); mapping happens exactly once at the Express response builder. `owner_id` is always omitted from API responses in Phase 0.
- **Validation approach (Architecture §3.2, §4.4):** Manual runtime checks (`typeof description === 'string'`, length 1–500) inside route handlers. No Zod/Joi/Yup. Validation errors returned as `{error: string}` with HTTP 400.
- **Error response shape (Architecture §4.2):** All API errors returned as `{ "error": "human-readable message" }` with status codes 400/404/500. No machine-readable error codes.
- **End-to-end smoke test (Architecture §3.5):** One Playwright test: "create a task → reload page → assert task is still visible." Lives in `e2e/tasks.spec.ts`. This is the only automated test in Phase 0.
- **Repository structure (Architecture §5.1):** Locked monorepo layout with top-level `api/`, `web/`, `db/`, `e2e/`, `Caddyfile`, `docker-compose.yml`, `.env.example`, `README.md`, `LICENSE`, `.gitignore`.
- **Public GitHub repo (Architecture §5.1):** Repository must be publicly hosted on GitHub with MIT (or similar permissive) LICENSE.
- **Secrets in `.env` only (Architecture §3.4, §1.4):** `.env.example` committed with no real values; actual `.env` lives only on the VPS and is gitignored. Loaded by Docker Compose.

### UX Design Requirements

No UX Design Specification document exists for this project. UX-related requirements are captured in the PRD's functional requirements (FR21–FR26 for empty state, mobile, responsive) and accessibility NFRs (NFR14–NFR17), and in the Architecture's frontend pattern decisions (vanilla CSS, single `App.css`, error toast region, "Loading…" indicator on initial fetch). No separate UX-DR list is created.

### FR Coverage Map

Each FR maps to exactly one epic (FR20 splits across two by design — stub vs. full content). Contiguous ranges of FRs that are co-located in the same epic and same story cluster are grouped on a single row for readability.

| FR | Epic | Brief description |
|---|---|---|
| FR1 | Epic 2 | View list of tasks |
| FR2 | Epic 2 | Create task |
| FR3 | Epic 2 | Toggle task |
| FR4 | Epic 2 | Delete task |
| FR5 | Epic 2 | Distinct active-vs-completed visual state |
| FR6 | Epic 2 | No reload/navigation for CRUD |
| FR7–FR11 | Epic 2 | Persistence + state recovery across all restart scenarios |
| FR12 | Epic 1 | No-auth posture established at deploy time |
| FR13 | Epic 1 | Nullable `owner_id` in schema |
| FR14–FR17 | Epic 2 | The four REST endpoints with real behavior |
| FR18 | Epic 2 | API usable without auth (curl/Shortcuts/cron) |
| FR19 | Epic 1 | Same-origin path prefix (Caddy routing) |
| FR20 | Epic 1 (stub) + Epic 3 (full content) | API endpoint table in README |
| FR21 | Epic 3 | Designed empty state |
| FR22 | Epic 1 | No signup/tour/modal on first load (established in shell) |
| FR23 | Epic 3 | First-time-user can act without instruction (depends on FR21) |
| FR24–FR26 | Epic 3 | Mobile/responsive + viewport meta |
| FR27–FR28 | Epic 3 | Optimistic UI + skeleton fallback |
| FR29–FR30 | Epic 2 | Inline error surfacing, non-blocking |
| FR31 | Epic 1 | One-command `docker compose up` |
| FR32 | Epic 1 | Postgres named volume |
| FR33 | Epic 1 | HTTPS public URL |
| FR34 | Epic 1 | Supervised process |
| FR35 | Epic 1 | Public repo exists |
| FR36 | Epic 3 | README quality bar |
| FR37 | Epic 1 | Compose + `.env.example` committed |
| FR38 | Epic 1 | Task schema with all fields |
| FR39 | Epic 1 | README schema docs |
| FR40 | Epic 1 | Stdout logs |
| FR41 | Epic 1 | `GET /api/tasks` returns 200 |

### NFR Coverage Map

| NFR | Epic | Story | Brief description |
|---|---|---|---|
| NFR1 | Epic 1 | 1.4 | App shell renders empty state in <1s (judgment, verified at story 1.4) |
| NFR2 | Epic 3 | 3.4 | Optimistic actions render within ~16ms |
| NFR3 | Epic 3 | 3.4 | Skeleton placeholder within ~150ms (fallback) |
| NFR4 | Epic 2 | 2.5 | No UI-thread blocking during error handling |
| NFR5 | Epic 1 + Epic 2 | 1.5 + 2.6 | Zero data loss across all restart scenarios |
| NFR6 | Epic 2 | 2.6 | Explicit `compose down/up` test passes |
| NFR7 | Epic 1 + Epic 2 | 1.5 + 2.6 | Supervisor restart on crash and host boot |
| NFR8 | Epic 1 | 1.5 | Successful API response = operational health signal |
| NFR9 | Epic 1 | 1.5 | HTTPS with valid TLS certificate |
| NFR10 | Epic 1 | 1.4 | No third-party tracking SDKs |
| NFR11 | Epic 1 | 1.5 | No secrets committed to repo |
| NFR12 | Epic 1 | 1.5 | Secrets via env variables only |
| NFR13 | Epic 3 | 3.3 | Documented as deployable behind extra access boundary |
| NFR14 | Epic 2 | 2.2, 2.3, 2.4 | Semantic HTML for all interactive elements |
| NFR15 | Epic 2 | 2.2, 2.3, 2.4 | Keyboard-operable for all core actions |
| NFR16 | Epic 2 | 2.2 | Browser-default focus indicators preserved |
| NFR17 | Epic 3 | 3.1 | WCAG AA contrast for active/completed states |
| NFR18 | Epic 2 + Epic 3 | 2.2 + 3.1 | First-time user can complete loop without instruction |
| NFR19 | Epic 2 | 2.2, 2.3, 2.4 | No confirmation dialogs |
| NFR20 | Epic 1 | 1.5 | <15-min self-host on Linux + Docker |
| NFR21 | Epic 1 | 1.5 | Two services + Caddy (no third-party SaaS) |
| NFR22 | Epic 1 + Epic 3 | 1.2 + 3.3 | `pg_dump`-restorable schema documented in README |
| NFR23 | Epic 1 | 1.5 | No paid licenses in production stack |

## Epic List

### Epic 1: Deployable Foundation — Stack, Schema, and Production Host

A self-hoster (and the builder) can clone the repo, run one command, and reach a working HTTPS URL serving an empty Tasky shell. The stack is alive on the public internet before any feature exists. This addresses the brief's highest-risk item ("first-time VPS deploy") first, establishing the deploy discipline that the rest of Phase 0 depends on.

**FRs covered:** FR12, FR13, FR19, FR20 (stub), FR22, FR31, FR32, FR33, FR34, FR35, FR37, FR38, FR39, FR40, FR41

**NFRs addressed:** NFR5–NFR8 (durability + supervisor restart), NFR9–NFR12 (HTTPS, no third-party SDKs, env-only secrets), NFR20 (15-min self-host), NFR21 (two services + Caddy), NFR22 (`pg_dump`-restorable schema docs), NFR23 (no paid licenses)

**Implementation notes:**
- Story 1.1 must address the Vite `react-ts` + hand-scaffolded Express starter per Architecture §2.
- Delivers the public URL, healthcheck-style `GET /api/tasks` returning `[]`, the schema, the Caddyfile, multi-stage Dockerfiles, `.env.example`, LICENSE, and a stub README. No CRUD UI yet.
- The deployed empty shell IS the first end-to-end value: it proves deployment discipline before any feature is built.

### Epic 2: Task CRUD — End-to-End Vertical Slice

Any individual with the URL can create, view, toggle, and delete tasks; data survives every restart scenario. This is the product. Functionality before polish. The brutal cut order's "never cut" items live entirely in this epic (persistent Postgres, core CRUD, refresh-survival).

**FRs covered:** FR1–FR11, FR14–FR18, FR29, FR30

**NFRs addressed:** NFR4 (no UI-thread blocking), NFR14–NFR16 (semantic HTML, keyboard operable, default focus), NFR18 (first-time-user success), NFR19 (no confirmation dialogs)

**Implementation notes:**
- Stories ordered: API endpoints first (vertical-slice ready) → frontend list/add/toggle/delete → persistence verification (the `docker compose down && up` sequence per NFR6) → Playwright smoke test.
- All four CRUD actions touch `server.ts`, `db.ts`, `App.tsx`, `App.css` — kept within one epic to avoid file churn.

### Epic 3: Distribution-Ready Polish — Empty State, Mobile, README

The app is presentable to a first-time user (designed empty state, mobile-viable) and discoverable to a self-hoster (README quality bar, screenshot, philosophy paragraph, API docs). This is the Should-ship/Nice-to-ship tier — first to be cut if the day runs long, per the brutal cut order.

**FRs covered:** FR20 (full content), FR21, FR23, FR24–FR28, FR36

**NFRs addressed:** NFR1–NFR3 (perceived performance guardrails), NFR13 (deployable behind extra access boundary — README mention), NFR17 (WCAG AA contrast)

**Implementation notes:**
- Stories ordered to match the brutal cut order in reverse (most-cuttable last): empty state polish → mobile/responsive → README quality bar → optimistic UI (Nice-to-ship, first to cut).
- This epic is last on purpose: if the day runs long, stories within this epic are dropped in cut order without affecting Epics 1 and 2.

## Epic 1: Deployable Foundation — Stack, Schema, and Production Host

A self-hoster (and the builder) can clone the repo, run one command, and reach a working HTTPS URL serving an empty Tasky shell. The stack is alive on the public internet before any feature exists. This addresses the brief's highest-risk item ("first-time VPS deploy") first, establishing the deploy discipline that the rest of Phase 0 depends on.

### Story 1.1: Repository scaffold and starter templates

As the builder,
I want the monorepo file structure scaffolded with the official Vite `react-ts` template for the frontend and a hand-scaffolded Express + TypeScript backend,
So that all subsequent stories have a consistent place to add code without further structural decisions.

**Acceptance Criteria:**

**Given** an empty repository directory
**When** I run `npm create vite@latest web -- --template react-ts` and the manual `api/` scaffolding sequence (`mkdir api && cd api && npm init -y && npm install express pg && npm install -D typescript @types/node @types/express tsx && npx tsc --init`)
**Then** the repository contains the locked file tree from Architecture §5.1: top-level `README.md`, `LICENSE` (MIT or similar permissive), `.gitignore`, `.env.example`, plus directories `api/`, `web/`, `db/`, `e2e/`
**And** `web/` contains a working Vite React 19.2 + TypeScript app that runs via `npm run dev`
**And** `api/` contains `package.json`, `tsconfig.json`, and `src/` with `server.ts` and `db.ts` placeholder files
**And** the `.gitignore` excludes `node_modules`, `dist`, `.env`, and `*.log`
**And** the `.env.example` file exists with placeholder keys (`POSTGRES_PASSWORD=`, `DATABASE_URL=`, `DOMAIN=`) and no real values
**And** the `README.md` exists as a stub with project name and a one-line description (full content added in later stories)
**And** the local repository is initialized with `git init` and the LICENSE file is committed
**And** *(Builder action — human step):* the local repository is pushed to a new public GitHub repository; the remote URL is recorded in the README stub

### Story 1.2: Database schema and `init.sql` bootstrap

As the builder,
I want the `tasks` table schema defined as a single `CREATE TABLE` statement that Postgres runs automatically on first boot,
So that no migration framework is needed and the schema is reproducible from a `pg_dump` recipient.

**Acceptance Criteria:**

**Given** the repository scaffold from Story 1.1
**When** I create `db/init.sql`
**Then** the file contains a `CREATE TABLE IF NOT EXISTS tasks` statement matching Architecture §3.3 exactly: `id BIGSERIAL PRIMARY KEY`, `description TEXT NOT NULL CHECK (length(description) > 0 AND length(description) <= 500)`, `completed BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `owner_id BIGINT NULL`
**And** the `owner_id` column is nullable and includes a SQL comment noting it is reserved for Phase 1 auth (FR13)
**And** the `README.md` is updated with a "Schema" section that documents every column (name, type, nullability, purpose) at sufficient detail to recreate the schema from a `pg_dump` output
**And** no migration framework (Flyway, Prisma Migrate, db-migrate, etc.) is added to the project dependencies

### Story 1.3: Minimal API with `GET /api/tasks` returning empty list

As any client (the frontend, curl, or a self-hoster verifying deployment),
I want a working `GET /api/tasks` endpoint that returns a JSON array,
So that the API process is provably alive and connected to Postgres before any CRUD logic is built.

**Acceptance Criteria:**

**Given** the scaffold from Story 1.1 and the schema from Story 1.2
**When** I implement `api/src/server.ts` with Express 5.1 and `api/src/db.ts` with `pg.Pool`
**Then** `server.ts` exposes one route `GET /api/tasks` that queries the `tasks` table and returns a JSON array (empty `[]` when no rows exist), with HTTP status 200 and `Content-Type: application/json`
**And** the API listens on the port specified by the `PORT` env variable (default 3000)
**And** the API connects to Postgres using the `DATABASE_URL` env variable
**And** the API blocks startup until the Postgres connection is established
**And** the API logs startup, request errors, and shutdown events to stdout/stderr via plain `console.log` / `console.error` (no Winston/Pino) — covers FR40
**And** the API installs an Express error middleware that returns `{ "error": "Internal server error" }` with HTTP 500 for any unhandled exception
**And** the API listens for `SIGTERM`, closes the HTTP server and the `pg.Pool` cleanly, and exits with code 0
**And** the API path prefix `/api/` is documented as the same-origin contract (FR19)
**And** the `README.md` includes a stub "API" section listing `GET /api/tasks` (full endpoint table added in Epic 3, Story 3.3) — covers FR20 stub

### Story 1.4: Minimal frontend rendering empty shell

As a first-time visitor to the deployed URL,
I want the page to load and render a Tasky shell with no signup prompt, tour overlay, or welcome modal,
So that the no-auth, no-onboarding posture is established at the UI level before any features exist.

**Acceptance Criteria:**

**Given** the Vite scaffold from Story 1.1 and the working API from Story 1.3
**When** I open the deployed (or locally served) URL in a browser
**Then** the page renders a minimal shell containing the app title "Tasky" and a list area
**And** the page calls `GET /api/tasks` on mount via a `fetchTasks` function in `web/src/api.ts`
**And** when the API returns an empty array, the list area displays plain placeholder text (e.g., "No tasks") — the *designed* empty state is deferred to Epic 3, Story 3.1
**And** no signup form, login button, modal dialog, tour overlay, cookie banner, or marketing interruption appears on first load — covers FR22
**And** no authentication credential, account UI, or session concept exists in the frontend code — covers FR12 (no-auth posture at UI level)
**And** the shell uses semantic HTML at the structural level (`<main>`, `<h1>`, `<ul>`) — full semantic compliance for interactive elements is verified in Epic 2 stories
**And** the frontend talks to `/api/*` on the same origin (no CORS, no absolute API URL hardcoded)

### Story 1.5: Docker Compose orchestration and production HTTPS deploy

**Scope note:** This story is deliberately consolidated (originally drafted as 1.5 + 1.6). Dockerfiles, Caddy config, Compose orchestration, and the first production HTTPS deploy are kept together because they are a single end-to-end discipline check — the brief's highest-risk bullet — and splitting them would let a "green local compose" hide a broken production deploy. Do not re-split.

As the builder (and any self-hoster),
I want one `docker compose up` command to bring the full stack online, both locally and on a public VPS over HTTPS,
So that the deploy discipline is proven end-to-end before any business logic is added — addressing the brief's highest-risk single bullet first.

**Acceptance Criteria:**

**Given** the API from Story 1.3, the frontend from Story 1.4, and the schema from Story 1.2
**When** I author `api/Dockerfile`, `web/Dockerfile`, `Caddyfile`, and `docker-compose.yml`
**Then** `api/Dockerfile` is multi-stage: builds TypeScript with a Node 24 LTS Alpine builder image, then runs the compiled JS on a minimal Node 24 LTS Alpine runtime
**And** `web/Dockerfile` is multi-stage: builds the Vite app, producing a `dist/` directory consumed by Caddy via a shared volume or build-time COPY into Caddy's working directory
**And** `docker-compose.yml` defines exactly three services — `web` (Caddy 2.x serving `web/dist` and reverse-proxying `/api/*` to `api:3000`), `api` (Node + Express on port 3000, internal-only), and `db` (Postgres 17) — all with `restart: unless-stopped` — covers FR34
**And** the `db` service mounts a named volume `tasky_pgdata` at `/var/lib/postgresql/data` — covers FR32
**And** the `db` service mounts `./db/init.sql` into `/docker-entrypoint-initdb.d/` so the schema is created on first volume initialization
**And** the `db` service has a `healthcheck` using `pg_isready`, and the `api` service `depends_on: db` with `condition: service_healthy`
**And** the `Caddyfile` configures auto-TLS via Let's Encrypt for the domain specified by the `DOMAIN` env variable, routes `/api/*` to `api:3000`, and serves all other paths from the static `web/dist`
**And** the `db` service binds Postgres to the internal Docker network only (no port exposure to the host), and only Caddy publishes ports 80 and 443 to the host
**And** all secrets (DB password, etc.) come from the `.env` file via Docker Compose env loading; no secrets are hardcoded in any compose, Dockerfile, or Caddyfile — covers NFR11, NFR12
**And** running `docker compose up -d` from a clean clone (with a populated `.env`) on a Linux host with Docker installed brings the entire stack online — covers FR31
**And** running `docker compose down && docker compose up -d` preserves all task data via the named volume — covers NFR5, NFR6 — verified in Epic 2 with real data
**And** when deployed to a VPS with the `DOMAIN` DNS pointed at the host, the public URL serves the empty Tasky shell over HTTPS with a valid Let's Encrypt certificate — covers FR33, NFR9
**And** an external `GET https://<domain>/api/tasks` from a network outside the VPS returns HTTP 200 with body `[]` — covers FR41 — full external verification
**And** the `README.md` is updated with a "Quickstart" section: `git clone` → edit `.env` → `docker compose up -d` (full README polish in Epic 3, Story 3.3)

## Epic 2: Task CRUD — End-to-End Vertical Slice

Any individual with the URL can create, view, toggle, and delete tasks; data survives every restart scenario. This is the product. Functionality before polish. The brutal cut order's "never cut" items live entirely in this epic (persistent Postgres, core CRUD, refresh-survival).

### Story 2.1: Create task — `POST /api/tasks` endpoint

As any client (frontend, curl, iOS Shortcut, cron),
I want to create a new task by sending a JSON description to the API,
So that programmatic capture works at zero additional cost beyond the documented REST surface.

**Acceptance Criteria:**

**Given** the API skeleton from Story 1.3
**When** I add a `POST /api/tasks` route handler in `api/src/server.ts` and a `createTask(description: string)` query function in `api/src/db.ts`
**Then** the endpoint accepts a JSON request body of shape `{ "description": string }`
**And** the endpoint validates that `description` is a string with length 1–500 characters using manual `typeof` and length checks (no Zod/Joi/Yup) — covers Architecture §4.4 validation approach
**And** validation failures return HTTP 400 with body `{ "error": "<human-readable message>" }` (e.g., "description must be a non-empty string ≤500 chars")
**And** successful creates return HTTP 201 with the created task as JSON, shape `{ "id": number, "description": string, "completed": false, "createdAt": "<ISO 8601 UTC>" }` — `owner_id` is omitted from the response per Architecture §4.2
**And** the DB insert uses a parameterized query (`$1` placeholder, never string interpolation)
**And** the boundary mapping from snake_case (`created_at`) to camelCase (`createdAt`) happens exactly once in the response builder — covers Architecture §4.1
**And** the endpoint is callable without authentication — covers FR18
**And** invoking `curl -X POST -H 'Content-Type: application/json' -d '{"description":"buy milk"}' https://<domain>/api/tasks` returns 201 with the new task and a subsequent `GET /api/tasks` returns the task in the array

### Story 2.2: List and create tasks in the UI

As any individual with the URL,
I want to see my list of tasks and add a new one by typing a description and pressing Enter,
So that I can capture and review tasks without page reload, navigation, or instruction.

**Acceptance Criteria:**

**Given** the empty shell from Story 1.4 and the create endpoint from Story 2.1
**When** I extend `web/src/App.tsx` to render the task list and an input form
**Then** on mount the app calls `fetchTasks` and displays each task's description in a `<ul><li>` list (semantic HTML — covers NFR14)
**And** the page renders an `<input type="text">` text field and a `<button type="submit">` Add button inside a `<form>` element
**And** pressing Enter while the input is focused submits the form (Enter key submits — covers NFR15)
**And** submitting the form calls `createTask(description)` from `web/src/api.ts` and on success appends the returned task to the list
**And** after a successful create, the input field is cleared and the focus remains on the input
**And** Escape pressed in the focused input clears the input value — covers NFR15
**And** the description is trimmed; empty or whitespace-only submissions are silently ignored (no validation error needed for whitespace UX — server-side 400 is the safety net)
**And** no page reload, navigation, or full-page refresh occurs during create — covers FR6
**And** browser-default focus indicators are visible on `<input>` and `<button>` (no `outline: none` rule in CSS — covers NFR16)
**And** no confirmation dialog or multi-step flow is required to create a task — covers NFR19

### Story 2.3: Toggle task completion — `PATCH /api/tasks/:id` and UI

As any individual with the URL,
I want to mark a task complete (and unmark it) with a single tap or keystroke,
So that I can track progress through my list without confirmation friction.

**Acceptance Criteria:**

**Given** the list rendering from Story 2.2
**When** I add a `PATCH /api/tasks/:id` route in `server.ts`, a `toggleTask(id, completed)` query in `db.ts`, and a checkbox/toggle UI element next to each task
**Then** the API endpoint accepts a JSON body `{ "completed": boolean }` and validates that `completed` is a boolean (returns 400 otherwise)
**And** the endpoint validates that `:id` is a positive integer (returns 400 otherwise)
**And** the endpoint returns HTTP 404 with `{ "error": "task not found" }` when the id does not exist
**And** the endpoint returns HTTP 200 with the updated task in camelCase JSON on success
**And** the DB update uses a parameterized query
**And** in the UI, each task list item renders a semantic `<input type="checkbox">` for completion state — covers NFR14
**And** clicking the checkbox immediately calls `toggleTask(id, !currentCompleted)` and updates the visible state on success
**And** completed tasks render with a visually distinct style versus active tasks (e.g., strikethrough text, lower opacity, or muted color) — covers FR5
**And** the active-vs-completed visual distinction relies on more than color alone (text-decoration, opacity, etc.) so the contrast difference is perceptible — full WCAG AA contrast verification is in Epic 3, Story 3.1
**And** the checkbox is keyboard-operable: Tab navigates to it, Space toggles it — covers NFR15
**And** no confirmation dialog appears — covers NFR19
**And** invoking `curl -X PATCH -H 'Content-Type: application/json' -d '{"completed":true}' https://<domain>/api/tasks/<id>` succeeds for an existing task

### Story 2.4: Delete task — `DELETE /api/tasks/:id` and UI

As any individual with the URL,
I want to delete a task with a single tap,
So that I can clear completed or unwanted items without navigating to a separate screen.

**Acceptance Criteria:**

**Given** the toggle behavior from Story 2.3
**When** I add a `DELETE /api/tasks/:id` route in `server.ts`, a `deleteTask(id)` query in `db.ts`, and a Delete button next to each task
**Then** the API endpoint validates `:id` is a positive integer (returns 400 otherwise)
**And** the endpoint returns HTTP 404 with `{ "error": "task not found" }` when the id does not exist
**And** the endpoint returns HTTP 204 with no body on successful delete
**And** the DB delete uses a parameterized query
**And** in the UI, each task list item renders a semantic `<button type="button">` labeled "Delete" (or with an accessible `aria-label="Delete task"` if icon-only) — covers NFR14
**And** clicking the Delete button immediately calls `deleteTask(id)` and removes the task from the visible list on success
**And** the Delete button is keyboard-operable: Tab navigates to it, Enter or Space activates it — covers NFR15
**And** no confirmation dialog appears before delete — covers NFR19 — out-of-scope: undo
**And** invoking `curl -X DELETE https://<domain>/api/tasks/<id>` returns 204 and a subsequent `GET /api/tasks` no longer contains that task

### Story 2.5: Error surfacing for failed mutations

As any individual using the app,
I want to see a clear inline message when a create/toggle/delete request fails,
So that I am never left wondering whether my action succeeded silently and so subsequent actions are not blocked.

**Acceptance Criteria:**

**Given** the CRUD UI from Stories 2.2, 2.3, 2.4
**When** any API mutation (`createTask`, `toggleTask`, `deleteTask`) returns a non-2xx response or rejects (network failure)
**Then** an inline error region (a single error-toast/banner near the top of the screen, controlled by component state) displays a human-readable error message — covers FR29
**And** the error message uses the API's `{ "error": "..." }` body when present, falling back to a generic "Something went wrong" for network failures
**And** the error message auto-dismisses after ~3 seconds (per Architecture §4.3) or can be dismissed via a close button
**And** the failed mutation does not block subsequent user actions: the input field, checkboxes, and delete buttons remain interactive — covers FR30
**And** the failed mutation does not leave the UI in an inconsistent state: the UI either re-fetches `GET /api/tasks` or simply does not apply the failed change locally
**And** *(forward reference):* Story 3.4 will extend this story by adding optimistic-state revert on failure; this story's AC stands alone without optimistic UI
**And** errors are reported via inline string only — no `alert()`, no modal dialog, no browser notification — covers FR29's "inline error string" mandate
**And** no UI thread blocking occurs longer than the user could perceive as "stuck" during error handling — covers NFR4

### Story 2.6: Persistence verification across restart scenarios

As the builder,
I want an explicit, scripted test sequence that proves task data survives every restart scenario the PRD requires,
So that the durability claim (the *one* trust test that matters in this category) is verified before Phase 0 is declared complete — and the result is reproducible by any self-hoster.

**Acceptance Criteria:**

**Given** a deployed stack from Epic 1 with full CRUD from Stories 2.1–2.5
**When** I execute the persistence verification sequence documented in the README
**Then** scenario 1 (browser refresh) passes: add a task → refresh the browser tab → task is present — covers FR8
**And** scenario 2 (browser close) passes: add a task → close the browser entirely → reopen and navigate to the URL → task is present — covers FR8
**And** scenario 3 (Docker compose restart) passes: add a task → run `docker compose restart` → task is present after services come back up — covers FR9
**And** scenario 4 (Docker compose down/up) passes: add a task → run `docker compose down && docker compose up -d` → task is present after services come back up — covers NFR6 — the explicit PRD-mandated test
**And** scenario 5 (host VPS reboot) passes: add a task → reboot the VPS host → task is present after the host comes back up and Caddy/api/db restart automatically — covers FR10, FR34, NFR7
**And** no client-only state (e.g., values held only in `useState` without server persistence) would be lost on refresh — covers FR11
**And** the README includes a "Persistence verification" subsection documenting the five scenarios so any self-hoster can reproduce the test

*Note: the automated Playwright smoke test for scenario 1 is implemented in Story 2.7 and is owned exclusively by that story.*

### Story 2.7: Playwright smoke test in `e2e/`

As the builder,
I want a single Playwright test that automates the most critical durability scenario,
So that the smoke test from Architecture §3.5 exists as a runnable artifact that future Phase 1 work can extend.

**Acceptance Criteria:**

**Given** the `e2e/` directory scaffolded in Story 1.1 and the working CRUD from Stories 2.1–2.5
**When** I implement `e2e/tasks.spec.ts` with `e2e/package.json` declaring Playwright as the only dependency
**Then** running `npm test` (or `npx playwright test`) from the `e2e/` directory executes the test
**And** the test navigates to the running app URL (configurable via env variable, defaulting to `http://localhost`)
**And** the test creates a task with a unique description (e.g., `"smoke-test-${Date.now()}"`)
**And** the test reloads the page
**And** the test asserts the task is still visible in the list
**And** the test cleans up by deleting the created task at the end
**And** the test exits with code 0 on pass, non-zero on fail
**And** no other automated tests (unit, integration) are added — the single smoke test is the entire automated test surface in Phase 0 per Architecture §3.5
**And** the README includes a one-line note on how to run the smoke test

## Epic 3: Distribution-Ready Polish — Empty State, Mobile, README

The app is presentable to a first-time user (designed empty state, mobile-viable) and discoverable to a self-hoster (README quality bar, screenshot, philosophy paragraph, API docs). This is the Should-ship/Nice-to-ship tier — first to be cut if the day runs long, per the brutal cut order.

### Story 3.1: Designed empty state

As a first-time visitor,
I want the empty state to feel deliberately designed rather than blank or accidental,
So that the app signals intentionality and earns my willingness to type a first task without onboarding instructions.

**Acceptance Criteria:**

**Given** the placeholder "No tasks" text from Story 1.4 and the working CRUD from Epic 2
**When** I update `web/src/App.tsx` and `web/src/App.css` to render a designed empty state
**Then** when the task list is empty, the app renders a deliberately styled empty state — not generic placeholder text — with intentional typography, spacing, and copy that signals "this is intentional, not lazy" — covers FR21
**And** the empty state contains no signup prompt, no tour overlay, no marketing language — covers FR22 — preserved from Story 1.4
**And** a first-time user can identify how to create a task from the empty state alone, without external instruction — covers FR23, NFR18 — the input field is visible and obviously interactive
**And** the empty state copy is concise (e.g., a single short sentence) and matches the discipline-first voice of the brief
**And** active-vs-completed task styling meets WCAG AA contrast ratio (~4.5:1 for text) — verified by visual inspection or a color-contrast checker — covers NFR17
**And** the empty state styling lives in `web/src/App.css` (vanilla CSS, single file — Architecture §3.1)
**And** no UI library (Tailwind, MUI, shadcn) is added to the project dependencies

### Story 3.2: Mobile and responsive behavior

As any individual opening the app on an iPhone,
I want the app to render without horizontal scroll and with comfortably-sized touch targets,
So that mobile use is viable without a dedicated mobile design pass.

**Acceptance Criteria:**

**Given** the polished empty state from Story 3.1 and the working CRUD from Epic 2
**When** I update `web/index.html` and `web/src/App.css` for responsive behavior
**Then** the `<head>` of `index.html` contains `<meta name="viewport" content="width=device-width, initial-scale=1">` — covers FR26
**And** opening the deployed URL on a real iPhone-width viewport (verified on a real device, not browser devtools per PRD §Responsive Design) shows no horizontal scroll — covers FR24
**And** all interactive elements (the add input, Add button, each task's checkbox, each task's Delete button) present a touch target of at least 44 pixels in their smallest dimension on mobile viewports — covers FR25
**And** the layout uses CSS that adapts to viewport width (e.g., max-width container with side padding, no fixed pixel widths that would overflow narrow viewports)
**And** the styling lives in `web/src/App.css` (single vanilla CSS file)
**And** out of scope for this story (deferred per PRD §Responsive Design): tablet-specific layout, landscape-specific layout, swipe gestures, pull-to-refresh

### Story 3.3: README quality bar — full content for distribution

As a self-hoster discovering the repo on Hacker News or `/r/selfhosted`,
I want the README to present a live demo URL, a screenshot, a one-paragraph philosophy statement, a quickstart, and a complete API endpoint table,
So that I can evaluate, deploy, and use the app without leaving the GitHub page.

**Acceptance Criteria:**

**Given** the stub README updated incrementally through Epics 1 and 2
**When** I finalize `README.md` for distribution
**Then** the README contains a live demo URL pointing to the deployed Tasky instance — covers FR36
**And** the README contains a screenshot of the running application embedded near the top — covers FR36
**And** the README contains a one-paragraph philosophy statement that matches the brief's discipline-thesis voice — minimal on purpose, no third-party SaaS, `pg_dump` is the backup — covers FR36
**And** the README contains a quickstart sequence that begins with `git clone` and ends with a working app via `docker compose up -d` — covers FR36 — including the `.env` setup step
**And** the README contains a complete API endpoint table listing all four endpoints (`GET`, `POST`, `PATCH`, `DELETE` for `/api/tasks`) with method, path, request body shape, response body shape, and status codes — covers FR20 full content
**And** the README documents the task object JSON shape (`{ "id", "description", "completed", "createdAt" }`) and notes that `owner_id` is reserved for Phase 1 auth and not exposed in API responses
**And** the README contains the schema documentation from Story 1.2 (verified still present)
**And** the README mentions that the app is deployable behind Tailscale, Cloudflare Tunnel, or basic-auth at the operator's discretion without code modification — covers NFR13
**And** the README contains an "Acknowledged Phase 0 gaps" section listing: no authentication, no rate limiting, no automated backups, no monitoring — and notes these block external-user use until Phase 1
**And** the README references `pg_dump` as the backup mechanism and includes a one-line restore command via `psql` — covers NFR22
**And** the README is written in plain Markdown that renders correctly on github.com
**And** no third-party tracking/analytics SDK is referenced or included anywhere in the README's example code — covers NFR10 — preserved as documentation discipline

### Story 3.4: Optimistic UI with server reconciliation (Nice-to-ship — first to cut)

As any individual using the app,
I want create/toggle/delete actions to render instantly before the server confirms,
So that the app feels lightweight in actual reach-for-it moments and the perceived latency does not exceed what an `Apple Reminders`-tier app provides.

**Acceptance Criteria:**

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
