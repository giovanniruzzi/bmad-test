---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter-template
  - step-04-core-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
status: complete
completedAt: '2026-04-29'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-tasky.md
  - _bmad-output/planning-artifacts/product-brief-tasky-distillate.md
workflowType: 'architecture'
project_name: 'bmad-test'
user_name: 'Gio'
date: '2026-04-29'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## 1. Project Context Analysis

### 1.1 Requirements Overview

**Project type:** Greenfield, single-user, full-stack web application (Tasky — a personal todo list).

**Phase posture:** Phase 0 deliberately. The PRD is unusually prescriptive and includes a "discipline thesis": stay minimal on purpose, ship in a single day, and preserve Phase 1 optionality without building any of it. Every architectural decision must be checked against the question _"does this commit something Phase 1 would need to undo?"_

**Functional scope (from PRD — 41 FRs across 13 categories):**

- CRUD on a single `tasks` resource (create, list, toggle complete, delete).
- One screen, one component family, one resource type.
- API surface: `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`.
- Same-origin frontend + API. No CORS. No auth. No rate limiting (Phase 0 acknowledged gaps).
- Optimistic UI on all mutations.
- Persistence survives container restarts and a full `docker compose down && up`.

**Non-functional priorities (from PRD's M/S/N tiering):**

| Tier | Concern | Architectural implication |
|---|---|---|
| **MUST** | Data durability across restarts (NFR5–7) | Postgres on a named docker volume; schema bootstrapped on first boot; no in-memory state. |
| **MUST** | One-command deploy (NFR1) | `docker compose up -d` brings the full stack online; no manual steps. |
| **MUST** | TLS in production (NFR8) | Caddy auto-TLS via Let's Encrypt. |
| **MUST** | Public GitHub repo with README (NFR9) | First-class deliverable, not an afterthought. |
| **SHOULD** | Phase 1 optionality preserved | Nullable `owner_id` is the _only_ permitted multi-user scaffolding. Nothing else added "just in case." |
| **NOT** | Performance measurement | Explicitly out of scope. No instrumentation, no APM. |
| **NOT** | Comprehensive testing | One smoke test only. No unit-test pyramid. |

### 1.2 Scale & Complexity

- **Users:** 1 (the developer / Gio). No concurrency to design for.
- **Data volume:** Hundreds of rows over the project's lifetime. A single Postgres table with no indexes beyond the primary key is sufficient.
- **Read/write ratio:** Roughly balanced; both negligible.
- **Geographic distribution:** Single VPS, single region. No CDN, no edge.
- **Complexity classification:** **Low** (matches PRD frontmatter `complexity: low`).

The implication: anything that exists to handle scale (caching layers, read replicas, queue workers, message buses, ORMs, structured loggers, feature flags, observability stacks) is **architectural theater** at this scale and is rejected by default.

### 1.3 Technical Constraints & Dependencies

**Hard constraints (non-negotiable, from PRD):**

- Stack is pre-decided: **React + Node + Postgres**. No alternatives considered.
- **Zero third-party SaaS.** No Vercel, Netlify, Supabase, PlanetScale, Auth0, Firebase, Stripe, Cloudflare Workers, Sentry, Datadog. The point of the project is to demonstrate a self-owned stack.
- Single-table schema is fixed: `tasks (id, description, completed, created_at, owner_id NULLABLE)`. Documented in README.
- Single `CREATE TABLE` on first boot. **No migration framework** (Flyway, Liquibase, Prisma Migrate, db-migrate, etc. are all forbidden in Phase 0).
- Same-origin serving: Node serves `/api/*`; everything else is the static React build. No CORS configuration.
- `docker-compose.yml` must bring the full stack up with one command.
- Environment-based secrets. Never committed.
- TLS via Let's Encrypt (Caddy auto-TLS recommended in PRD).

**Soft constraints (workflow / context):**

- Skill level: intermediate. Decisions should be defensible without requiring deep specialist knowledge to operate.
- No time estimates anywhere in this document (workflow rule).
- Output language: English.

**External dependencies allowed:**

- Docker / Docker Compose (deployment runtime).
- A single VPS (DigitalOcean, Hetzner, Linode, etc. — provider is irrelevant; the architecture is portable).
- A domain name with DNS pointed at the VPS (for Let's Encrypt).
- The npm registry and Docker Hub (for pulling base images and packages at build time).

That is the entire third-party surface area. Everything else runs on the VPS.

### 1.4 Cross-Cutting Concerns

| Concern | Phase 0 stance | Rationale |
|---|---|---|
| **Authentication** | None. | PRD explicitly defers to Phase 1. Acknowledged gap. The `owner_id` column is nullable specifically so Phase 1 can add auth without a schema migration. |
| **Authorization** | None. | Single user; no concept of "other people's data" exists. |
| **Rate limiting / abuse prevention** | None. | Acknowledged gap. The app should not be linked publicly until Phase 1 adds a basic limiter. |
| **Logging** | `console.log` to stdout/stderr; aggregated by `docker compose logs`. | Anything more (Winston, Pino, structured JSON, log shipping) is theater for one user and four endpoints. |
| **Error handling** | Express error middleware returning `{error: string}` with appropriate HTTP status. Frontend shows a transient toast / inline error and reverts optimistic update. | Sufficient surface. No error-tracking SaaS (forbidden) and no self-hosted Sentry (over-investment). |
| **Validation** | Manual runtime checks in the Node handler (`typeof description === 'string'`, length cap, etc.). | Zod / Joi / Yup add a dependency for one endpoint family. Reconsider in Phase 1 when the API grows. |
| **Observability / metrics** | None. | PRD explicitly excludes performance measurement. No Prometheus, no Grafana, no OpenTelemetry. |
| **Backups** | Manual `pg_dump` if/when the user cares. | Acknowledged Phase 1 gap. Automated backup is correct future work, premature now. |
| **Secrets management** | `.env` file on the VPS, gitignored. `.env.example` in the repo. | Vault / Doppler / AWS Secrets Manager all violate the no-SaaS rule and are wildly disproportionate. |
| **CI/CD** | Manual `git pull && docker compose up -d --build` on the VPS. | GitHub Actions is allowed (it's not a SaaS dependency of the running app, just a build tool) but not required for Phase 0. README documents the manual flow. |
| **Health checks** | Docker Compose `healthcheck` on Postgres so the API waits for DB readiness before starting. | Necessary for first-boot reliability. Trivial to add. |

---

## 2. Starter Template Decision

### 2.1 Decision: **No monolithic starter.** Use Vite's official `react-ts` template for the frontend; scaffold the Node API by hand.

### 2.2 Options Considered

| Option | Verdict | Reasoning |
|---|---|---|
| **T3 stack (`create-t3-app`)** | Rejected | Bundles tRPC, Prisma, NextAuth, Tailwind. Each is a Phase 1-blocking commitment. Violates the discipline thesis. |
| **Next.js (`create-next-app`)** | Rejected | Replaces both React-as-SPA and Node/Express with a different architecture (RSC, route handlers, edge runtime assumptions). PRD specifies "React + Node" as separate concerns served same-origin via a reverse proxy — Next.js is a different shape. Also nudges toward Vercel. |
| **Remix / React Router v7 framework mode** | Rejected | Same shape mismatch as Next.js. PRD's stack is React-as-static-SPA + Node-as-API, not a unified meta-framework. |
| **Vite `react-ts` template + hand-rolled Express** | **✅ Chosen** | Matches PRD's stack exactly. Vite gives a modern, well-supported React build with zero opinions beyond bundling. Hand-rolling ~50 lines of Express is honest, transparent, and adds no Phase-1-blocking conventions. |
| **CRA (Create React App)** | Rejected | Deprecated by the React team in 2025. Vite is the current default. |
| **Bare `npm init` + manual Vite config** | Rejected | The official template _is_ the bare minimum, plus a working `tsconfig.json` and `index.html`. No reason to redo that work. |

### 2.3 Concrete Bootstrap Commands

```bash
# Frontend
npm create vite@latest web -- --template react-ts

# Backend (no template — hand-scaffolded)
mkdir api && cd api
npm init -y
npm install express pg
npm install -D typescript @types/node @types/express tsx
npx tsc --init
```

This is the entire scaffolding step. Everything else (Dockerfiles, compose file, Caddyfile, `db/init.sql`) is written by hand and committed once.

### 2.4 What the Starter Does NOT Include (Deliberately)

- No state management library (Redux, Zustand, Jotai). React's `useState` + `useOptimistic` is sufficient.
- No data-fetching library (TanStack Query, SWR). Four `fetch` calls do not justify it.
- No CSS framework (Tailwind, MUI, shadcn). One screen.
- No ORM (Prisma, Drizzle, TypeORM). Four SQL queries against one table.
- No validation library (Zod, Yup). Two input fields.
- No testing framework setup beyond a single Playwright smoke test.

Each of these is a defensible Phase 1 addition. None is justified in Phase 0.

---

## 3. Core Technology Decisions

The PRD pre-decided the headline stack. This section locks in the specific versions and the small remaining choices, with rationale.

### 3.1 Frontend

| Choice | Decision | Rationale |
|---|---|---|
| **UI library** | React 19.2 | Latest stable. Mandated by PRD. Native `useOptimistic` hook is exactly what the PRD's optimistic-UI requirement needs — removes any reason to add a data-fetching library. |
| **Build tool** | Vite 8.0 | Current default. Fast dev server, sensible production builds. |
| **Language** | TypeScript 5.x | The Vite template includes it; turning it off would be active work. Catches the shape-mismatch bugs that hand-rolled API + frontend pairs typically suffer. |
| **Styling** | Vanilla CSS (one `App.css` file) | One screen. PRD explicitly says vanilla is faster for this scope. Tailwind is correct in Phase 1 if the UI grows. |
| **State** | `useState` + `useOptimistic` | Native to React 19. No external library. |
| **Data fetching** | Native `fetch` wrapped in a 4-function `api.ts` module | Trivial surface. TanStack Query is correct in Phase 1 if caching/invalidation matters. |
| **Routing** | None | Single screen. React Router would be theater. |

### 3.2 Backend

| Choice | Decision | Rationale |
|---|---|---|
| **Runtime** | Node.js 24 LTS (Krypton) | Current Active LTS. Supported through 2027-04. Pin via `.nvmrc` and the Dockerfile base image. (Node 22 LTS is also acceptable; 24 is the more forward-looking pick with no downside for this project.) |
| **HTTP framework** | Express 5.1 | Now stable and the npm `express` default. Mandated stack. The dominant, boring choice — exactly what's wanted. Fastify would be premature optimization. |
| **Language** | TypeScript, run via `tsx` in dev and compiled to JS for production | Matches the frontend. `tsx` removes the dev-loop friction that historically pushed Node projects to plain JS. |
| **Database driver** | `pg` (raw node-postgres) | Four queries, one table. An ORM would add a dependency surface that Phase 1 would have to either keep or rip out. Raw SQL in a `db.ts` module is ~30 lines and has zero hidden behavior. |
| **Validation** | Manual (`typeof`, length checks) inside route handlers | Two input shapes. Reconsider Zod in Phase 1 when the API has more than four endpoints. |
| **Logging** | `console.log` / `console.error` to stdout | Captured by Docker. Pino/Winston is theater here. |

### 3.3 Database

| Choice | Decision | Rationale |
|---|---|---|
| **Engine** | PostgreSQL 17 | Current stable, supported through 2029-11. Mandated by PRD. v18 is also acceptable but 17 is the conservative pick. |
| **Schema bootstrap** | `db/init.sql` mounted into the Postgres container's `/docker-entrypoint-initdb.d/` | The official Postgres image runs scripts in this directory exactly once, on first volume initialization. Cleaner than app-side `CREATE TABLE IF NOT EXISTS` because it keeps schema concerns out of the application code. Satisfies the PRD's "single CREATE TABLE on first boot" requirement perfectly, and is genuinely zero-config. |
| **ID strategy** | `BIGSERIAL` (auto-incrementing 64-bit integer) | Simplest possible. UUID/ULID solve problems (distributed generation, opaque IDs in URLs) that don't exist for a single-user, single-DB app. Numeric IDs serialize cleanly as JSON numbers. |
| **Persistence** | Named Docker volume (`tasky_pgdata`) | Survives `docker compose down`. The PRD's data-durability requirement (NFR5–7) maps directly to this. |
| **Connection pooling** | `pg.Pool` with default settings | Built into the driver. PgBouncer is theater at one user. |
| **Backups** | Out of scope for Phase 0 (acknowledged) | Phase 1 work. |

#### Schema (locked)

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          BIGSERIAL PRIMARY KEY,
  description TEXT NOT NULL CHECK (length(description) > 0 AND length(description) <= 500),
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id    BIGINT NULL  -- Reserved for Phase 1 auth. Always NULL in Phase 0.
);
```

The `CHECK` on `description` length is a single line that prevents a class of garbage-input bugs and costs nothing.

### 3.4 Infrastructure & Deployment

| Choice | Decision | Rationale |
|---|---|---|
| **Container runtime** | Docker + Docker Compose | Mandated by PRD. |
| **Reverse proxy / TLS** | Caddy 2.x | PRD recommendation. Auto-TLS via Let's Encrypt with one Caddyfile directive. Single binary, no separate certbot cron job, no nginx config archaeology. |
| **Process supervision** | `restart: unless-stopped` in `docker-compose.yml` | All three services (web, api, db) restart on crash and on host reboot. No systemd unit needed. |
| **Build strategy** | Multi-stage Dockerfiles for both `api` and `web` | Final images contain only runtime artifacts. `web` final stage is a tiny static-file image; Caddy serves the built `dist/` directly via a bind mount or by copying into Caddy's working dir. |
| **Static asset serving** | Caddy serves `web/dist/` directly | Avoids a Node-as-static-server hop. Caddy is faster and simpler for static files. |
| **Secrets** | `.env` file on the VPS, loaded by Docker Compose; `.env.example` in the repo | Plain, boring, sufficient. |

#### Deployment Topology

```
                            Internet (HTTPS :443)
                                    │
                                    ▼
                             ┌─────────────┐
                             │   Caddy     │  (auto-TLS via Let's Encrypt)
                             │             │
                             │  /api/*  ───┼───► api:3000  (Node + Express)
                             │  /*      ───┼───► web/dist (static files)
                             └─────────────┘
                                    │
                                    ▼ (api → db, internal Docker network)
                             ┌─────────────┐
                             │ PostgreSQL  │
                             │   17        │
                             └─────────────┘
                                    │
                                    ▼
                          Named volume: tasky_pgdata
```

All four boxes (Caddy, api, web-static-volume, db) live in a single `docker-compose.yml`. The Docker network handles internal DNS (api reaches db at hostname `db`).

### 3.5 Testing

| Choice | Decision | Rationale |
|---|---|---|
| **Unit tests** | None in Phase 0 | Four endpoints, one component. PRD does not mandate. Would be theater. |
| **Integration tests** | None in Phase 0 | Same reasoning. |
| **End-to-end smoke test** | One Playwright test: "create a task, reload the page, see the task" | This is the deploy-survival test the PRD implicitly cares about most (durability). One test, one file, zero ongoing maintenance burden. |
| **Manual acceptance** | The PRD's acceptance criteria, walked through by hand on the deployed URL | Sufficient for a single-user app. |

---

## 4. Architectural Patterns & Conventions

### 4.1 Naming Conventions

| Layer | Convention | Example |
|---|---|---|
| Database (tables, columns) | `snake_case` | `tasks`, `created_at`, `owner_id` |
| API JSON | `camelCase` | `{ "id": 1, "createdAt": "2026-04-29T..." }` |
| URL paths | `kebab-case`, plural resource nouns | `/api/tasks`, `/api/tasks/:id` |
| TypeScript files | `kebab-case.ts` for modules, `PascalCase.tsx` for React components | `api.ts`, `db.ts`, `App.tsx` |
| TS types/interfaces | `PascalCase` | `Task`, `CreateTaskInput` |
| TS variables/functions | `camelCase` | `fetchTasks`, `pendingDelete` |
| Env variables | `SCREAMING_SNAKE_CASE` | `DATABASE_URL`, `PORT` |

The boundary mapping (snake_case DB → camelCase JSON) happens in exactly one place: the API response builder in the Express handler. Six lines of code. No mapping library.

### 4.2 API Design Conventions

- **Style:** REST. JSON request/response bodies.
- **Resource shape (response):**
  ```json
  { "id": 1, "description": "Buy milk", "completed": false, "createdAt": "2026-04-29T10:00:00.000Z" }
  ```
  `owner_id` is omitted from responses in Phase 0 (always null, no value to caller).
- **Collection responses:** Bare JSON array, not wrapped: `[{...}, {...}]`. A `{data: [...], meta: {...}}` envelope is correct in Phase 1 if pagination arrives; premature now.
- **Error responses:** `{ "error": "human-readable message" }` with appropriate HTTP status (400, 404, 500). No error codes or machine-readable error types — one client, one developer, plain English is enough.
- **Status codes:** 200 (GET, PATCH), 201 (POST), 204 (DELETE), 400 (validation), 404 (not found), 500 (unhandled).
- **Dates:** ISO 8601 strings in UTC. Never epoch numbers.
- **IDs:** JSON numbers (matches `BIGSERIAL`; safe up to 2^53 — fine for hundreds of rows).
- **Versioning:** None. `/api/v1/` would be theater. Add when Phase 1 breaks the contract.
- **Content type:** `application/json` only. No form-encoded fallback.

### 4.3 Frontend Patterns

- **Component style:** Function components with hooks. No class components.
- **Optimistic updates:** Use React 19's `useOptimistic` hook on mutations (toggle, delete, create). On API failure, the optimistic state is reverted automatically and an inline error is shown.
- **Data fetching:** A single `api.ts` module exports `fetchTasks`, `createTask`, `toggleTask`, `deleteTask`. Each is a thin `fetch` wrapper. No caching layer — `App.tsx` re-fetches on mount and after mutations. (Re-fetching after every mutation is wasteful at scale and exactly right at one user.)
- **Error display:** A single error-toast region at the top of the screen, controlled by component state. Three-second auto-dismiss.
- **Loading states:** Show "Loading…" on initial fetch. Mutations use optimistic UI, so no per-row spinners.

### 4.4 Backend Patterns

- **Project layout:** Flat. `src/server.ts` (Express setup + routes inline) + `src/db.ts` (pg.Pool + four query functions). No `controllers/`, `services/`, `repositories/` ceremony for ~50 lines of business logic.
- **Error handling:** A single Express error middleware at the bottom of the chain catches anything thrown in handlers, logs it, and returns `{error: "Internal server error"}` with status 500. Validation errors are thrown with a `.status = 400` property and a message.
- **Database access:** Parameterized queries only. Never string-interpolate user input. Use `pool.query('SELECT ... WHERE id = $1', [id])`.
- **Transactions:** Not needed. All four endpoints are single-statement.
- **Graceful shutdown:** Listen for `SIGTERM`, close the HTTP server and the pg pool. Twenty lines of standard boilerplate. Required for clean Docker stops.

### 4.5 Code Organization Principles

- **Co-locate, don't pre-categorize.** Routes, validation, and DB calls live next to each other in `server.ts` until there's enough code to justify splitting. There isn't.
- **Inline until it hurts.** No abstractions are added speculatively. The first time a piece of logic is duplicated, extract it. Not before.
- **Boundary mapping in one place.** Snake-case-to-camelCase happens at the Express response boundary. The DB layer speaks DB names; the HTTP layer speaks JSON names; nothing in between.
- **Comments explain _why_, not _what_.** The code is short enough that the "what" is self-evident. Reserve comments for non-obvious decisions (e.g., "owner_id is nullable for Phase 1 auth — see architecture.md §3.3").

---

## 5. Project Structure

### 5.1 Repository Layout

```
tasky/
├── README.md                  # Setup, deploy, schema, Phase 0 gaps. First-class deliverable (NFR9).
├── LICENSE                    # MIT or similar.
├── .gitignore                 # node_modules, dist, .env, *.log
├── .env.example               # POSTGRES_PASSWORD, DATABASE_URL, DOMAIN, etc. — no real values.
├── docker-compose.yml         # web (Caddy + static), api (Node), db (Postgres). One-command deploy.
├── Caddyfile                  # Reverse proxy: /api/* → api:3000, /* → static. Auto-TLS.
│
├── db/
│   └── init.sql               # CREATE TABLE tasks (...). Mounted into Postgres on first boot.
│
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile             # Multi-stage: build TS → run compiled JS on node:24-alpine.
│   └── src/
│       ├── server.ts          # Express app, 4 routes, error middleware, graceful shutdown.
│       └── db.ts              # pg.Pool + 4 query functions (listTasks, createTask, toggleTask, deleteTask).
│
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── Dockerfile             # Multi-stage: build with Vite → output dist/ (consumed by Caddy).
│   └── src/
│       ├── main.tsx           # React 19 root render.
│       ├── App.tsx            # The single screen. List + add form. Uses useOptimistic.
│       ├── api.ts             # fetchTasks, createTask, toggleTask, deleteTask.
│       └── App.css            # Vanilla CSS. One file.
│
└── e2e/
    ├── package.json
    └── tasks.spec.ts          # One Playwright test: create → reload → assert visible.
```

### 5.2 Mapping FRs to Files

| FR category | Lives in |
|---|---|
| Schema, persistence (FR-DB-*) | `db/init.sql`, `api/src/db.ts` |
| API endpoints (FR-API-*) | `api/src/server.ts` |
| UI rendering, forms (FR-UI-*) | `web/src/App.tsx`, `web/src/App.css` |
| Optimistic updates (FR-UX-*) | `web/src/App.tsx` (via `useOptimistic`) |
| Same-origin serving, TLS (NFR1, NFR8) | `Caddyfile`, `docker-compose.yml` |
| One-command deploy (NFR1) | `docker-compose.yml`, `README.md` |
| Public repo, README (NFR9) | `README.md` (top-level) |
| Schema docs (FR-DOC-*) | `README.md` §Schema, plus `db/init.sql` itself |

Every FR has a single, obvious home. There is no file whose purpose is unclear.

### 5.3 What's NOT in the Repo (Deliberately)

- No `migrations/` directory (single `init.sql`, no migration framework).
- No `tests/` tree (one e2e file, no unit tests).
- No `.github/workflows/` (manual deploy in Phase 0; CI is correct Phase 1 work).
- No `infra/` or `terraform/` (single VPS provisioned by hand).
- No `monitoring/`, `observability/`, `dashboards/`.
- No `docs/` beyond the top-level README (this architecture doc lives in `_bmad-output/`, not in the product repo).

If any of these appears in the Phase 0 codebase, it is a discipline-thesis violation and should be removed.

---

## 6. Validation Checklist

Completeness check against the bmad-create-architecture criteria:

- [x] **Project context understood** — PRD, brief, and distillate all loaded; constraints catalogued in §1.
- [x] **Requirements mapped** — Every FR category has a home in the file structure (§5.2).
- [x] **Scale/complexity classified** — Low; matches PRD frontmatter.
- [x] **Hard constraints respected** — React+Node+Postgres only; zero third-party SaaS; single table; no migration framework; same-origin; one-command deploy; env-based secrets.
- [x] **Starter template decision documented** — Vite `react-ts` + hand-rolled Express, with options-considered table.
- [x] **All core technology choices made** — Versions pinned (Node 24 LTS, Postgres 17, React 19.2, Vite 8, Express 5.1, Caddy 2.x).
- [x] **Database schema locked** — Concrete `CREATE TABLE` with constraints.
- [x] **API contract specified** — Endpoints, response shapes, error format, status codes, naming conventions.
- [x] **Frontend patterns specified** — `useOptimistic`, single `api.ts` module, no state library, vanilla CSS.
- [x] **Backend patterns specified** — Flat layout, parameterized queries, Express error middleware, graceful shutdown.
- [x] **Deployment topology defined** — Diagram + Caddy + Compose + named volume.
- [x] **Cross-cutting concerns addressed** — Each one has an explicit Phase 0 stance and rationale (§1.4).
- [x] **Phase 1 optionality preserved** — `owner_id NULL` is the only forward-looking commitment; every rejected option was rejected because it would constrain Phase 1.
- [x] **Project structure concrete** — Full tree with file purposes (§5.1).
- [x] **Acknowledged gaps documented** — Auth, rate limiting, automated backups, monitoring all explicitly noted as Phase 1 work, not architecture omissions.
- [x] **Document is implementation-ready** — A developer could open this and start typing code without needing to make further architectural decisions.

**Status: READY FOR IMPLEMENTATION.**

**Confidence: High.** The PRD's prescriptiveness eliminates the usual sources of architectural risk; the small remaining decisions (Vite vs CRA, raw `pg` vs ORM, Caddy vs nginx, ID strategy) all have clear right answers given the discipline thesis. The main residual risk is _drift_ during implementation — the temptation to add "just one small library" — which the §5.3 explicit-exclusions list is designed to anchor against.

### Acknowledged Phase 0 Gaps (intentional, not architectural omissions)

1. **No authentication.** App must not be linked publicly. Phase 1 work.
2. **No rate limiting.** Same caveat. Phase 1 work.
3. **No automated backups.** Manual `pg_dump` if/when the user cares. Phase 1 work.
4. **No monitoring or alerting.** Single user notices their own outages. Phase 1 work.
5. **No CI pipeline.** Manual `git pull && docker compose up -d --build` is documented in README. Phase 1 work.

Each of these is a deliberate Phase 0 trade-off recorded in the PRD. None is an oversight in this architecture.

---

_End of Architecture Decision Document._
