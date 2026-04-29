# Story 1.5: Docker Compose orchestration and production HTTPS deploy

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **⏱ Time budget — read before starting.** Soft target ~2 hours. **Hard alarm at 3 hours.** This story carries the largest single time-risk in the entire one-day plan. If you do not have a working public HTTPS URL by the 3-hour mark, **stop**, halt this story, and trigger the brutal-cut-order replan defined by the epic (cut Story 3.4 first, then 3.3, then 3.2, then 3.1) before resuming. Do NOT silently overrun. [Source: epics.md#Story 1.5 ("Time budget" / "Hard alarm at 3 hours")]
>
> **🧱 Consolidated by design — do NOT re-split.** This story is deliberately the merger of original 1.5 (compose) + 1.6 (production deploy). Splitting would let a "green local compose" hide a broken production deploy, defeating the discipline check this story exists to perform. [Source: epics.md#Story 1.5 ("Scope note")]

## Story

As the builder (and any future self-hoster of Tasky),
I want one `docker compose up -d` command to bring the full three-service stack online — both locally on my workstation and on a public VPS over HTTPS with a real Let's Encrypt certificate,
So that the brief's highest-risk single bullet (the deploy discipline) is proven end-to-end before any business logic is added in Epic 2.

## Acceptance Criteria

1. **`api/Dockerfile` is a multi-stage build using `node:24-alpine` for both stages.** Stage 1 (`builder`): `WORKDIR /app`, copy `package.json` + `package-lock.json`, run `npm ci` (full install including devDeps so `tsc` is available), copy `tsconfig.json` and `src/`, run `npm run build` (which is `tsc` per `api/package.json` line 8) producing `dist/`. Stage 2 (`runtime`): `WORKDIR /app`, copy `package.json` + `package-lock.json`, run `npm ci --omit=dev` (production deps only — `express`, `pg`), copy `--from=builder /app/dist ./dist`, set `ENV NODE_ENV=production`, `EXPOSE 3000`, `CMD ["node", "dist/server.js"]`. Do NOT copy source TypeScript into the runtime image. Do NOT install `tsx` in runtime. Do NOT use `npm install` (use `npm ci` for reproducible builds against the committed lockfile). Do NOT use `node:24` (the non-Alpine variant — ~5x larger, no Phase 0 benefit). The image MUST run as a non-root user — add `USER node` after the COPY steps in the runtime stage (the `node:*-alpine` images include a `node` user with UID 1000 by default). [Source: architecture.md#3.1 (Node 24 LTS Alpine), architecture.md#3.4 ("Multi-stage Dockerfiles for both api and web. Final images contain only runtime artifacts."), architecture.md#5.1 ("api/Dockerfile — Multi-stage: build TS → run compiled JS on node:24-alpine"), api/package.json (build/start scripts)]

2. **`web/Dockerfile` is a multi-stage build that produces the static `dist/` artifact for Caddy to serve.** Stage 1 (`builder`): `node:24-alpine`, `WORKDIR /app`, copy `package.json` + `package-lock.json`, `npm ci` (full install — `vite`, `typescript`, `@vitejs/plugin-react` are devDeps), copy `tsconfig*.json`, `vite.config.ts`, `index.html`, `public/`, `src/`, run `npm run build` (which is `tsc -b && vite build` per `web/package.json` line 8) producing `/app/dist`. Stage 2 (`runtime`): `caddy:2-alpine`, `COPY --from=builder /app/dist /srv` (Caddy's default `root` lookup path; the `Caddyfile` (AC #3) declares `root * /srv`), `COPY Caddyfile /etc/caddy/Caddyfile` (Caddy's default config path — Caddy auto-loads it on start with no flags). Do NOT copy `node_modules/` from the builder. Do NOT mount `web/dist/` from the host at runtime (`docker compose` users may not have run `npm run build` locally — the image MUST be self-contained). Do NOT include the source `web/` files in the runtime image. The runtime stage produces the single `web` service image that publishes ports 80/443 (per AC #4). [Source: architecture.md#3.4 ("web final stage is a tiny static-file image; Caddy serves the built dist/ directly... by copying into Caddy's working dir"), architecture.md#3.4 ("Static asset serving: Caddy serves web/dist/ directly. Avoids a Node-as-static-server hop"), architecture.md#5.1 ("web/Dockerfile — Multi-stage: build with Vite → output dist/ (consumed by Caddy)")]

3. **`Caddyfile` is created at the project root with exactly one site block for the env-substituted domain.** Contents (literal — this is the file to ship):

   ```
   {$DOMAIN} {
       encode gzip

       handle /api/* {
           reverse_proxy api:3000
       }

       handle {
           root * /srv
           try_files {path} /index.html
           file_server
       }
   }
   ```

   - `{$DOMAIN}` is Caddy's env-substitution syntax (NOT shell `$DOMAIN`; NOT Compose `${DOMAIN}`). Caddy reads the `DOMAIN` env var at startup and produces the site address (e.g., `tasky.example.com`). When `DOMAIN` is set to a public hostname with valid DNS, Caddy auto-provisions a Let's Encrypt cert (the first cold-start request takes 5–15 s while the ACME HTTP-01 challenge completes). When `DOMAIN` is `localhost` (or any non-public hostname Caddy detects), Caddy auto-issues an internal CA cert — useful for local sanity checks without ever changing the file.
   - **`handle /api/*` is path-PRESERVING.** Story 1.3's API mounts routes at `/api/tasks` (verified in `api/src/server.ts`). The wrong-looking-but-similar `handle_path /api/*` would STRIP the `/api` prefix before proxying — the API would then receive `GET /tasks` and return 404. Use `handle`, NOT `handle_path`.
   - `try_files {path} /index.html` enables SPA-style fallback so deep-links (none in Phase 0, but harmless) don't 404; when the requested path doesn't match a file in `/srv`, Caddy serves `/srv/index.html`.
   - `encode gzip` enables on-the-fly compression; Caddy negotiates with `Accept-Encoding`. (Brotli is also acceptable — `encode gzip zstd` — but stick to plain `gzip` for the locked skeleton.)
   - Do NOT add `tls` directive overrides, `tls internal`, or an explicit `acme_ca` URL. Do NOT add a `log` block (FR40 says `console.*` only — Caddy's default access log to stdout is fine; an explicit `log` block adds JSON formatting Phase 0 doesn't need).
   - Do NOT add HTTP-to-HTTPS redirect directives. Caddy auto-redirects port 80 → 443 once it has a cert, and serves an internal cert when `DOMAIN=localhost`. Manual redirects double up. [Source: architecture.md#3.4 ("Reverse proxy / TLS: Caddy 2.x. Auto-TLS via Let's Encrypt with one Caddyfile directive"), architecture.md#5.1 ("Caddyfile — Reverse proxy: /api/* → api:3000, /* → static. Auto-TLS"), api/src/server.ts#routes (paths are `/api/tasks`, NOT `/tasks`)]

4. **`docker-compose.yml` defines exactly three services — `web`, `api`, `db` — and one named volume.** Service shape:

   - **`db`**: image `postgres:17-alpine`. `restart: unless-stopped`. `environment`: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}` (required), `POSTGRES_DB: tasky` (literal — single Phase 0 database). `volumes`: `tasky_pgdata:/var/lib/postgresql/data` AND `./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro` (read-only mount). `healthcheck`: `test: ["CMD-SHELL", "pg_isready -U postgres -d tasky"]`, `interval: 5s`, `timeout: 3s`, `retries: 10`, `start_period: 5s`. **No `ports:` key** — db is reachable only on the internal Docker network at hostname `db`.
   - **`api`**: `build: ./api` (uses the AC #1 Dockerfile). `restart: unless-stopped`. `environment`: `DATABASE_URL: ${DATABASE_URL}`, `NODE_ENV: production`, `PORT: 3000`. `depends_on`: `db: { condition: service_healthy }` (waits for db's healthcheck to pass before starting). **No `ports:` key** — api is reachable only on the internal network at hostname `api:3000`. **No `volumes:` key** for code (the image is self-contained per AC #1).
   - **`web`**: `build: ./web` (uses the AC #2 Dockerfile). `restart: unless-stopped`. `environment`: `DOMAIN: ${DOMAIN}` (Caddy reads this — see AC #3). `ports`: `["80:80", "443:443"]` (the ONLY service publishing host ports). `depends_on`: `api` (no `condition` — Caddy will retry the upstream connection on its own; we just want startup ordering). `volumes`: `caddy_data:/data` AND `caddy_config:/config` (Caddy stores Let's Encrypt certs in `/data` — losing this volume forces re-issuance on next deploy). Define `caddy_data` and `caddy_config` as additional named volumes alongside `tasky_pgdata` in the top-level `volumes:` block.
   - **Top-level `volumes:`**: `tasky_pgdata:` (Postgres data — the FR32 named volume), `caddy_data:` (TLS certs — survives redeploy), `caddy_config:` (Caddy's runtime config cache).
   - **No top-level `networks:` block.** Compose creates a default bridge network named `<project>_default` and joins all services to it; internal DNS by service name (`db`, `api`, `web`) works out of the box.
   - **No `version:` key at the top.** The Compose v2 spec deprecates it; `docker compose` (the v2 plugin, the only one we target) ignores it with a warning.
   - **No `container_name:` overrides.** Let Compose generate them (`bmad-test-api-1`, etc.); a fixed `container_name` would prevent running two stacks side-by-side and is unnecessary.
   - **No `image:` key on `api` or `web`** (they `build:` locally; assigning `image:` would tag them but the local build is the source of truth). [Source: epics.md#Story 1.5 (full ACs), architecture.md#3.4, architecture.md#5.1, prd.md#FR31, FR32, FR34, NFR5, NFR6, NFR7]

5. **All secrets come from the `.env` file via Docker Compose's automatic env loading; nothing secret is hardcoded in any compose, Dockerfile, or Caddyfile.** Compose auto-loads `.env` from the directory the `docker compose` command runs in — values in `.env` are interpolated into `${VAR}` references inside `docker-compose.yml` BEFORE the file is parsed. The three vars consumed by this story are exactly the three already declared in `.env.example`: `POSTGRES_PASSWORD` (used by `db.environment`), `DATABASE_URL` (used by `api.environment` — must reference `db` as host, e.g., `postgres://postgres:<password>@db:5432/tasky`), and `DOMAIN` (used by `web.environment` for Caddy). Do NOT add new env vars. Do NOT use `env_file:` directives in services (Compose's automatic `.env` interpolation is sufficient and avoids the trap of leaking the entire `.env` to a single container's `process.env`). Do NOT commit a `.env` (it is in `.gitignore`). [Source: prd.md#NFR11, NFR12; .env.example (the 3 keys); .gitignore (`.env` listed)]

6. **`.env.example` is updated with inline guidance comments — but the keys themselves stay as the three already present (`POSTGRES_PASSWORD`, `DATABASE_URL`, `DOMAIN`).** Replace the current 3-line file with a commented version that explains each value and gives a copy-pasteable example for `DATABASE_URL` (showing the `db` hostname). Do NOT add any new keys. Do NOT include real secrets — `.env.example` is committed to the public repo. The locked code skeleton is in Dev Notes → "Locked code skeleton — `.env.example`". [Source: prd.md#NFR11; .env.example (existing 3 keys)]

7. **`docker compose up -d` from a clean clone (with a populated `.env`) brings all three services online and to a healthy state on a Linux/macOS host with Docker installed.** "Healthy" means: (a) `docker compose ps` shows all three services in state `running` (web/api) or `running (healthy)` (db); (b) `docker compose logs db` contains the line `database system is ready to accept connections`; (c) `docker compose logs api` contains the Story 1.3 startup line `API listening on port 3000`; (d) `docker compose logs web` contains a Caddy startup line such as `serving initial configuration`. The `db` healthcheck MUST pass before `api` starts; verify by checking `api` startup time is at least ~5 s after `db` (longer if `init.sql` runs on first boot). [Source: epics.md#Story 1.5 ("running `docker compose up -d` from a clean clone... brings the entire stack online"), prd.md#FR31]

8. **Volume persistence is verified: `docker compose down && docker compose up -d` preserves all task data — but `docker compose down -v` destroys it.** This is the FR32 / NFR5 / NFR6 contract. Concretely: insert a row, `down`, `up -d`, `GET /api/tasks` still returns the row. Then `down -v`, `up -d`, `GET /api/tasks` returns `[]` (the named volume was removed; init.sql re-ran on the fresh volume). The runtime verification recipe (Dev Notes) walks both paths. **Note:** full FR32 / NFR5 / NFR6 verification (all five restart scenarios — browser refresh, browser restart, device restart, app process restart, host VPS reboot) is Story 2.6's exclusive scope. This story verifies only the two compose-level scenarios above; the others are deferred. [Source: epics.md#Story 1.5 ("`docker compose down && docker compose up -d` preserves all task data"), prd.md#FR32, NFR5, NFR6; epics.md#Story 2.6 (full restart-scenario verification)]

9. **Local sanity check works WITHOUT a public domain by setting `DOMAIN=localhost` in `.env`.** With `DOMAIN=localhost`, Caddy detects the non-public hostname and issues an internal CA cert automatically (no Let's Encrypt round-trip). `curl -sk https://localhost/api/tasks` returns `200 []` (the `-k` flag accepts the self-signed cert). `curl -s http://localhost/api/tasks` is auto-redirected to HTTPS by Caddy. `curl -sk https://localhost/` returns the Tasky shell HTML. This is the dev/PR-loop verification path; the production verification (AC #10) requires a real domain. Do NOT bake `localhost` into the Caddyfile — `{$DOMAIN}` substitution is the entire mechanism. [Source: architecture.md#3.4 (Caddy auto-TLS); Caddy docs (auto-issues internal cert for `localhost` and `*.localhost`)]

10. **Public production deploy works on a VPS with a real domain.** This AC is the brief's "highest-risk single bullet" the entire story exists to prove. Concretely: on a Linux VPS (any provider) with Docker + Docker Compose v2 installed, with the `DOMAIN` env var set to a domain whose DNS A record points at the VPS's public IPv4 (and AAAA at IPv6 if present), and with ports 80 and 443 reachable from the public internet (firewall / security-group / ufw allow): `git clone <repo>`, populate `.env` (real `POSTGRES_PASSWORD`, real `DATABASE_URL` referencing `db` as host, real `DOMAIN`), `docker compose up -d`, wait ~30 s for Let's Encrypt issuance, then `curl -s https://<DOMAIN>/api/tasks` from a network OUTSIDE the VPS returns `200 []` with a `Content-Type` response header containing `application/json` (this satisfies FR41 — "external GET" — and MUST originate from outside the VPS, not from the VPS itself, to genuinely exercise the public path; do NOT pin the exact charset suffix — Express 5's `res.json()` may or may not append `; charset=utf-8` depending on version, and the contract is the media type, not the parameter). And `curl -sI https://<DOMAIN>/` returns `200 OK` with a valid Let's Encrypt cert chain (`openssl s_client -connect <DOMAIN>:443 -servername <DOMAIN> </dev/null 2>/dev/null | openssl x509 -noout -issuer` shows `O=Let's Encrypt`). Browser-loading `https://<DOMAIN>/` shows the empty Tasky shell (`<h1>Tasky</h1>`, `No tasks` placeholder per Story 1.4). [Source: epics.md#Story 1.5 (public HTTPS + external `GET /api/tasks`), prd.md#FR33, FR41, NFR9]

11. **`db` binds Postgres to the internal Docker network only — no host port exposure. Only the `web` (Caddy) service publishes host ports (80, 443).** Verify with `docker compose ps`: `db` and `api` show no `0.0.0.0:*` mappings; `web` shows `0.0.0.0:80->80/tcp` and `0.0.0.0:443->443/tcp` (or the IPv6 equivalents). On the VPS, `ss -tlnp | grep -E ':(80|443|3000|5432)'` shows ONLY 80 and 443 bound to the public interface; 3000 and 5432 do NOT appear (they are bound only inside Docker's internal bridge). This is the FR-NFR security boundary: db credentials in `.env` never need to be "strong" against external attackers because the db is unreachable externally; the API surface is the only thing exposed. [Source: epics.md#Story 1.5 ("db binds Postgres to the internal Docker network only"), prd.md#NFR12]

12. **`README.md` gets a new top-level `## Quickstart` section appended after the existing `## API` section (line 50).** The section MUST contain: a one-sentence intro framing this as the local-and-VPS path; a fenced bash block with the literal commands `git clone https://github.com/giovanniruzzi/bmad-test`, `cd bmad-test`, `cp .env.example .env`, `# edit .env — set POSTGRES_PASSWORD, DATABASE_URL, DOMAIN`, `docker compose up -d`; a 2–3 line note saying Caddy auto-issues TLS for any public domain whose DNS points at the host (Let's Encrypt for public domains, internal CA for `DOMAIN=localhost`); a one-line pointer that the local path uses `DOMAIN=localhost` and `curl -k https://localhost/api/tasks`. Do NOT replace or rewrite the existing `## Schema` or `## API` sections. Do NOT promote `Quickstart` above them in the document — append it. The full polished README (with screenshots, badges, troubleshooting, full endpoint table) is Story 3.3's scope. The locked Markdown for the new section is in Dev Notes → "Locked code skeleton — README Quickstart section". [Source: epics.md#Story 1.5 ("README.md is updated with a 'Quickstart' section"), epics.md#Story 3.3 (full README polish — out of scope here), prd.md#FR20 (API section already shipped by Story 1.3)]

13. **No new dependencies added to `api/package.json` or `web/package.json`.** No `dotenv`, `cross-env`, `pm2`, `nodemon`, `concurrently`, `wait-on`, `dockerode`, `@dotenvx/dotenvx`, or any other "deploy helper" gets installed. Compose handles env loading; the `node:24-alpine` image and `caddy:2-alpine` image have everything they need. The `api/package.json` and `web/package.json` files MUST be byte-identical between the start and end of this story. The corresponding `package-lock.json` files MUST also be unchanged (no `npm install` runs in either subdir). [Source: architecture.md#5.3 (no observability/process-supervisor add-ons in Phase 0)]

14. **No source-code edits inside `api/src/` or `web/src/`.** The API code (Story 1.3) and the frontend code (Story 1.4) are inputs to this story — they are containerized as-is. If a perceived bug is encountered (e.g., the API needs a `GET /healthz`), DO NOT add it in this story; either work around it with Caddy/Compose config or open it as a separate concern. Touching application code in a deploy story violates scope and risks regressing the verified Story 1.3/1.4 contracts. [Source: discipline thesis — story scope boundaries]

15. **`db/init.sql` is NOT modified.** It is mounted read-only (`:ro` per AC #4) into the db container. Story 1.2 owns the schema; this story consumes it. [Source: epics.md#Story 1.2 (schema ownership), epics.md#Story 1.5 ("./db/init.sql into /docker-entrypoint-initdb.d/")]

16. **Local verification recipe (mandatory, even if a real VPS will also be used):** before declaring done, run the full local recipe in Dev Notes → "Local verification recipe (AC #7, #8, #9, #11)". This validates the compose stack against `DOMAIN=localhost` end-to-end in a single shell session: cold start, internal-cert HTTPS, frontend shell renders, `GET /api/tasks` returns `200 []`, port exposure check, `down && up` data persistence, `down -v && up` data wipe. Capture the per-step outputs into Debug Log References.

17. **Production verification recipe (mandatory for AC #10):** execute the steps in Dev Notes → "Production verification recipe (AC #10)" against a real VPS with a real domain. If a VPS is not available at story-execution time, document this in Completion Notes and mark AC #10 as "deferred — local recipe (AC #16) all green; production deploy to be re-verified by the builder before Phase 0 sign-off." This is the ONLY AC for which deferral is acceptable, and the deferral creates a tracked debt against the Phase 0 completion gate, NOT against this story's `done` status — explicitly call out the deferral in the Change Log entry.

18. **`.gitignore` is NOT modified.** It already contains `.env` (line 3), `node_modules` (line 1), `dist` (line 2), `*.log` (line 4) — sufficient for this story. Do NOT add `.env.production`, `.caddy/`, `caddy_data/`, etc.; the Caddy data lives in named Docker volumes (AC #4), not on the host filesystem. [Source: .gitignore (existing)]

## Tasks / Subtasks

- [x] **Task 1: Create `api/Dockerfile`** (AC: #1)
  - [x] Confirm `git ls-files api/package-lock.json` returns the path (the lockfile is committed; `npm ci` requires it at build time and will fail with a confusing error if it is missing or gitignored).
  - [x] Create `/Users/gio/Source/bmad-test/api/Dockerfile` (does not currently exist).
  - [x] Paste the locked code from Dev Notes → "Locked code skeleton — `api/Dockerfile`" character-for-character.
  - [x] Confirm: two stages named `builder` and `runtime`; both use `node:24-alpine`; runtime uses `npm ci --omit=dev`; runtime copies `--from=builder /app/dist`; runtime sets `USER node`; runtime exposes 3000; CMD is `["node", "dist/server.js"]`.
  - [x] Confirm zero references to `tsx`, `nodemon`, `pm2`, `node:24` (non-Alpine), or `npm install` (use `npm ci`).

- [x] **Task 2: Create `web/Dockerfile`** (AC: #2)
  - [x] Confirm `git ls-files web/package-lock.json` returns the path (same reason as Task 1 — `npm ci` needs the committed lockfile).
  - [x] Create `/Users/gio/Source/bmad-test/web/Dockerfile` (does not currently exist).
  - [x] Paste the locked code from Dev Notes → "Locked code skeleton — `web/Dockerfile`" character-for-character. **Adjustment:** Since the compose `web` service uses `build.context: .` (project root) — required so Caddyfile can be copied — all stage-1 COPY paths are prefixed with `web/` (e.g., `COPY web/package.json web/package-lock.json ./`). The Dev Notes "Locked code skeleton — `web/Dockerfile`" sample shows bare paths (`COPY package.json ...`) which assume context is `./web`; that conflicts with the docker-compose.yml skeleton which explicitly mandates `context: .` for this service. The Dev Notes paragraph for `web/Dockerfile` calls this out: "Read this paragraph twice; it is the easiest thing to get wrong in this story." Verified: container builds successfully; static dist lands in `/srv`; Caddy serves it.
  - [x] Confirm: stage 1 uses `node:24-alpine` and runs `npm run build`; stage 2 uses `caddy:2-alpine` and copies the built `/app/dist` into `/srv` plus the project `Caddyfile` into `/etc/caddy/Caddyfile`; no `node_modules` is present in the runtime stage.

- [x] **Task 3: Create `Caddyfile`** at the project root (AC: #3)
  - [x] Create `/Users/gio/Source/bmad-test/Caddyfile` (does not currently exist).
  - [x] Paste the locked code from Dev Notes → "Locked code skeleton — `Caddyfile`" character-for-character.
  - [x] Confirm: site address is `{$DOMAIN}` (Caddy env-var syntax, NOT shell `$DOMAIN`); `handle /api/* { reverse_proxy api:3000 }` (path-PRESERVING — NOT `handle_path`); the static `handle` block has `root * /srv`, `try_files {path} /index.html`, `file_server`; `encode gzip` is present; no `tls`, no `log`, no manual HTTP→HTTPS redirect directives.

- [x] **Task 4: Create `docker-compose.yml`** at the project root (AC: #4, #5, #11)
  - [x] Create `/Users/gio/Source/bmad-test/docker-compose.yml` (does not currently exist).
  - [x] Paste the locked code from Dev Notes → "Locked code skeleton — `docker-compose.yml`" character-for-character.
  - [x] Confirm three services (`db`, `api`, `web`); confirm `db` and `api` have no `ports:` key; confirm `web` is the only service with `ports:` (publishing 80 and 443); confirm `db.healthcheck` uses `pg_isready -U postgres -d tasky`; confirm `api.depends_on.db.condition: service_healthy`; confirm `volumes:` block at the top with `tasky_pgdata`, `caddy_data`, `caddy_config`; confirm no `version:`, no `container_name:`, no top-level `networks:` block; confirm all secret values reference `${POSTGRES_PASSWORD}` / `${DATABASE_URL}` / `${DOMAIN}` (no literals).

- [x] **Task 5: Update `.env.example`** with inline guidance comments (AC: #6)
  - [x] Open `/Users/gio/Source/bmad-test/.env.example` (currently 3 lines: `POSTGRES_PASSWORD=`, `DATABASE_URL=`, `DOMAIN=`).
  - [x] Replace contents with the locked code from Dev Notes → "Locked code skeleton — `.env.example`".
  - [x] Confirm: only the same 3 keys (`POSTGRES_PASSWORD`, `DATABASE_URL`, `DOMAIN`); all values are EMPTY (no real secrets committed); inline `#` comments explain each key and provide a copy-pasteable `DATABASE_URL` example referencing `db` as host.
  - [x] Confirm `.env` itself is NOT created or committed (it is in `.gitignore`).

- [x] **Task 6: Append `## Quickstart` section to `README.md`** (AC: #12)
  - [x] Open `/Users/gio/Source/bmad-test/README.md` (currently 50 lines, ending with the FR20 stub blockquote on line 48 + blank line 49).
  - [x] Append the locked Markdown from Dev Notes → "Locked code skeleton — README Quickstart section" AFTER the existing trailing blank line.
  - [x] Confirm: the existing `## Schema` (line 7) and `## API` (line 21) sections are byte-identical; the new content begins with `## Quickstart` and is appended at the end; the existing FR20 blockquote on line 48 is preserved.
  - [x] `git diff README.md` should show ONLY additions at the end of the file (no edits, no deletions in the existing sections).

- [x] **Task 7: Local verification recipe (AC #16)** — execute Dev Notes → "Local verification recipe" end-to-end
  - [x] Pre-req: `docker --version` returns `>= 27.x`; `docker compose version` returns `>= v2.30.x`. If older Docker, upgrade (Phase 0 targets current stable Docker Engine). **Result:** Docker 29.4.0, Compose v5.1.1 — both well above floors.
  - [x] Create a local `.env` file (NOT committed) with: `POSTGRES_PASSWORD=devpw`, `DATABASE_URL=postgres://postgres:devpw@db:5432/tasky`, `DOMAIN=localhost`. (These are throwaway local-only values; do NOT commit `.env`.)
  - [x] Cold start: `docker compose up -d --build`. Wait ~15 s. Confirm `docker compose ps` shows db `(healthy)`, api `running`, web `running`. Note: on first cold boot with `DOMAIN=localhost`, Caddy logs `installing root certificate` and a warning about local trust — this is expected and harmless; do NOT flag it as an error. **Result:** all three containers `Up`, db `(healthy)`; Caddy logs the expected `installing root certificate` warning.
  - [x] Internal-cert HTTPS check: `curl -sk -o /dev/null -w '%{http_code}\n' https://localhost/` returns `200`. `curl -sk https://localhost/api/tasks` returns `[]`. `curl -s -o /dev/null -w '%{http_code}\n' http://localhost/` returns `308` or `301` (Caddy auto-redirect to HTTPS). **Result:** 200 / `[]` / 308 redirect to `https://localhost/`. ✅
  - [x] Frontend shell check: `curl -sk https://localhost/` body contains `<title>Tasky</title>` and the bundled JS/CSS hashes. **Result:** `<title>Tasky</title>` + `/assets/index-DY0bkENL.js` + `/assets/index--qwHxly2.css` present.
  - [x] Port exposure check: `docker compose ps --format 'table {{.Name}}\t{{.Ports}}'` — confirm `db` and `api` rows show no `0.0.0.0:*` mappings; `web` shows 80 and 443. On Linux, additionally run `ss -tlnp 2>/dev/null | grep -E ':(80|443|3000|5432) '` and confirm only 80 and 443 appear. On macOS (Docker Desktop), `ss` is not available — use `lsof -nP -iTCP:80 -iTCP:443 -iTCP:3000 -iTCP:5432 -sTCP:LISTEN` instead and confirm only 80 and 443 are bound. **Result:** `db` shows `5432/tcp` (internal only), `api` shows `3000/tcp` (internal only), `web` shows `0.0.0.0:80->80/tcp` + `0.0.0.0:443->443/tcp`. `lsof` for 3000/5432 returned nothing from Docker — only 80 and 443 bound on the host. (A pre-existing host nginx is also bound to 443 — unrelated to this stack.) ✅ AC #11.
  - [x] Persistence check: insert a row via `docker compose exec db psql -U postgres -d tasky -c "INSERT INTO tasks (description) VALUES ('persist-me');"`. Confirm `curl -sk https://localhost/api/tasks` returns one task with description `persist-me`. **Result:** row id=1 inserted; API returned `[{"id":1,"description":"persist-me","completed":false,"createdAt":"2026-04-29T21:02:15.440Z"}]`.
  - [x] `down && up` test: `docker compose down`. Confirm volumes survive (`docker volume ls` still shows `*_tasky_pgdata`). `docker compose up -d`. Wait ~10 s. `curl -sk https://localhost/api/tasks` returns the same `persist-me` row. ✅ AC #8. **Result:** all three named volumes (`bmad-test_tasky_pgdata`, `bmad-test_caddy_data`, `bmad-test_caddy_config`) survived the `down`; after `up -d`, the same `persist-me` row (with original `createdAt`) returned. ✅
  - [x] `down -v` test: `docker compose down -v`. Confirm `docker volume ls` no longer shows the `tasky_pgdata` volume. `docker compose up -d`. Wait ~10 s. `curl -sk https://localhost/api/tasks` returns `[]` (init.sql re-ran on fresh volume). ✅ AC #8 inverse path. **Result:** all three volumes removed; after `up -d` and ~18s wait (init.sql replays), API returned `[]`. ✅
  - [x] Tear down: `docker compose down -v`. Confirm `lsof -nP -iTCP:80 -iTCP:443 -sTCP:LISTEN 2>/dev/null` returns empty (or only non-Docker processes you knew about). **Result:** Docker no longer listening on 80/443; only the pre-existing host nginx remains.
  - [x] Capture all outputs into Debug Log References (the AC checks above produce concise, paste-friendly output — capture the whole sequence). **See Debug Log References below.**

- [x] **Task 8: Production verification recipe (AC #10, #17)** — execute Dev Notes → "Production verification recipe" against a real VPS
  - [ ] Pre-req: a Linux VPS (any provider — Hetzner, DigitalOcean, Vultr, Linode, Fly.io VM, etc.) reachable on a public IPv4. SSH access. Docker Engine + Docker Compose v2 installed. Firewall rules allow inbound 80 + 443 from anywhere.
  - [ ] Pre-req: a domain you control with an `A` record (and optionally `AAAA`) pointing at the VPS public IP. Wait for DNS propagation (`dig +short <DOMAIN>` returns the VPS IP from at least one external resolver such as `8.8.8.8` and `1.1.1.1`).
  - [ ] On the VPS: `git clone https://github.com/giovanniruzzi/bmad-test && cd bmad-test`. (Or your fork, if Story 1.5 is still on a feature branch.)
  - [ ] On the VPS: `cp .env.example .env`, then edit `.env` to set a strong `POSTGRES_PASSWORD`, a matching `DATABASE_URL=postgres://postgres:<password>@db:5432/tasky`, and `DOMAIN=<your-domain>`.
  - [ ] On the VPS: `docker compose up -d --build`. Wait ~30 s for the Let's Encrypt ACME HTTP-01 challenge to complete (Caddy logs the issuance — `docker compose logs web | grep -i certificate`).
  - [ ] From a network OUTSIDE the VPS (your laptop, a phone hotspot, https://reqbin.com — anything not on the VPS itself): `curl -s -o /dev/null -w '%{http_code}\n' https://<DOMAIN>/` returns `200`. `curl -s https://<DOMAIN>/api/tasks` returns `[]`. ✅ AC #10 + AC #41.
  - [ ] Cert chain check (any host): `echo | openssl s_client -connect <DOMAIN>:443 -servername <DOMAIN> 2>/dev/null | openssl x509 -noout -issuer -subject -dates` shows issuer containing `Let's Encrypt`, subject CN `<DOMAIN>`, and `notAfter` ~90 days out. ✅ AC #10 / NFR9.
  - [ ] Browser load: open `https://<DOMAIN>/` in a clean profile (no overrides). Address bar shows the lock icon (no warning). Page renders `<h1>Tasky</h1>` plus the `No tasks` placeholder (Story 1.4 shell). DevTools → Network → `GET /api/tasks` returns `200` with body `[]`. Console: zero errors.
  - [x] If a VPS is NOT available at story-execution time: SKIP this task, mark AC #17 as deferred per its own deferral clause, document in Completion Notes, and add a `Production verification — deferred to <date / sign-off gate>` entry to the Change Log. **Result:** No VPS / public domain available in the development environment. Per AC #17's explicit deferral clause: AC #10 and the production-side substeps of Task 8 are **deferred to the Phase 0 completion gate**. Local recipe (Task 7 / AC #16) is fully green; the produced compose stack is identical to what would deploy on a VPS — the only differences are (a) `DOMAIN` value (`localhost` → real domain) and (b) Caddy issuer (internal CA → Let's Encrypt, controlled by Caddy's hostname detection, not by any code change). Deferral is tracked in the Change Log entry below.

- [x] **Task 9: Final integrity check before declaring done** (AC: all)
  - [x] `git status` shows the following changes and ONLY these: `api/Dockerfile` (added), `web/Dockerfile` (added), `Caddyfile` (added), `docker-compose.yml` (added), `.env.example` (modified), `README.md` (modified). Nothing else changed by this story. **Result:** confirmed (the story file itself + sprint-status.yaml + the pre-existing `.playwright-mcp/` are not story payload).
  - [x] `git diff api/package.json api/package-lock.json web/package.json web/package-lock.json` shows zero output (per AC #13). **Result:** zero output. ✅
  - [x] `git diff api/src/ web/src/ db/init.sql` shows zero output (per AC #14, #15). **Result:** zero output. ✅
  - [x] `git diff .gitignore` shows zero output (per AC #18). **Result:** zero output. ✅
  - [x] `.env` is NOT in `git status` (it is gitignored; if it appears, fix the gitignore — but per AC #18 the gitignore is already correct). **Result:** the throwaway `.env` from the verification recipe was deleted at teardown; not in `git status`.
  - [x] No real secrets in any committed file. `git grep -E '(POSTGRES_PASSWORD|DATABASE_URL|DOMAIN) *= *[^ ]' -- ':!*.example' ':!_bmad/' ':!_bmad-output/' ':!.agents/'` returns zero matches outside `.env.example` (which has empty values). **Result:** zero leaks (the `_` underscore in pathspec exclusions triggered git's pathspec-magic warning on this shell; re-running with simple exclusions confirmed no leaks). ✅
  - [ ] Commit with a message such as `feat(deploy): docker compose stack with caddy auto-tls and quickstart README (Story 1.5)`. Do not push (manual builder action, same convention as Stories 1.1 / 1.2 / 1.3 / 1.4). **Note:** Per project convention (Stories 1.1–1.4), the commit is a manual builder action performed after review — left for Gio.

## Dev Notes

### Locked code skeleton — `api/Dockerfile`

[Source: architecture.md#3.1, architecture.md#3.4, architecture.md#5.1, api/package.json (build/start scripts)]

Multi-stage build. Stage 1 compiles TS to JS using devDeps (`tsc` lives in `typescript`); stage 2 ships only production deps + the compiled `dist/` on a minimal runtime image. The runtime image runs as the non-root `node` user (UID 1000) baked into the Alpine image.

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- Stage 1: build TypeScript to dist/ ----
FROM node:24-alpine AS builder
WORKDIR /app

# Copy lockfile + manifest first for cache-friendly layer
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# After this, /app/dist/server.js exists and is the entrypoint.

# ---- Stage 2: minimal runtime ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production deps only — no tsx, no typescript, no @types/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Pull the compiled JS from the builder
COPY --from=builder /app/dist ./dist

# node:*-alpine ships a `node` user (UID 1000) — drop privileges
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Notes for the reader (do NOT add as comments to the file beyond what is already there):

- **Why two `npm ci` invocations (one full, one `--omit=dev`):** the builder needs `typescript` to run `tsc`, but the runtime image must NOT ship `typescript` / `@types/*` / `tsx`. Two separate installs are the canonical multi-stage Node pattern. Layer caching keeps it cheap as long as `package-lock.json` doesn't change.
- **Why `USER node`:** running Node as root in a container is a needless privilege; a container escape (extremely unlikely but cheap to defend against) would land as root on the host filesystem of the volume mount. UID 1000 is sufficient.
- **Why no `HEALTHCHECK`:** the API does not have a `/healthz` endpoint (Story 1.3 deliberately skipped it). Caddy will retry the upstream connection on its own; Compose's `depends_on` for `web → api` is enough for startup ordering. Adding a healthcheck without a route would require `wget`/`curl` in the runtime image — needless dependency surface.
- **Why no `dumb-init` / `tini`:** `node` itself is a competent PID 1 in modern Node versions; signal handling for SIGTERM works correctly (Story 1.3 verified the SIGINT/SIGTERM graceful-shutdown handler). `tini` is a fix for older Node; not needed.

### Locked code skeleton — `web/Dockerfile`

[Source: architecture.md#3.4, architecture.md#5.1, web/package.json (build script `tsc -b && vite build`)]

Stage 1 builds the Vite app to `/app/dist` using the same `node:24-alpine` toolchain as the API. Stage 2 is `caddy:2-alpine` — a tiny image (~45 MB) — with the built static files in `/srv` and the project `Caddyfile` at `/etc/caddy/Caddyfile`.

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- Stage 1: build the Vite app ----
FROM node:24-alpine AS builder
WORKDIR /app

# Lockfile + manifest first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Project sources + configs needed for `tsc -b && vite build`
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src
RUN npm run build
# After this, /app/dist/index.html and /app/dist/assets/* exist.

# ---- Stage 2: Caddy serving the static dist + reverse-proxying /api ----
FROM caddy:2-alpine AS runtime

# Static site root expected by the Caddyfile
COPY --from=builder /app/dist /srv

# Reverse-proxy + auto-TLS config
COPY Caddyfile /etc/caddy/Caddyfile
```

Notes for the reader (do NOT add as comments to the file beyond what is already there):

- **Why `caddy:2-alpine` and not `nginx:alpine`:** Architecture §3.4 picked Caddy explicitly for one-line auto-TLS via Let's Encrypt. nginx requires certbot + cron for renewal, plus a more verbose config. Caddy is the architectural decision.
- **Why `/srv` (not `/usr/share/caddy` or `/var/www`):** the Caddyfile (AC #3) declares `root * /srv`. The path is arbitrary as long as the Caddyfile and the COPY agree. `/srv` is the FHS-canonical "data for services" location; matches Caddy's own docs examples.
- **Why no `WORKDIR`:** the Caddy image's `ENTRYPOINT` is `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile` (the image default). It does not depend on CWD.
- **Why `COPY Caddyfile /etc/caddy/Caddyfile`:** the build context for the `web` service in `docker-compose.yml` is `./web` (the `web/` subdirectory). To copy the **project-root** `Caddyfile` from inside `web/Dockerfile`, the build context must be the **project root** — see the `docker-compose.yml` skeleton: `web.build` is `{ context: ., dockerfile: web/Dockerfile }`, NOT `./web`. This is the critical divergence from `api`'s build (`api.build: ./api`). Read this paragraph twice; it is the easiest thing to get wrong in this story.
- **Why no `EXPOSE 80 443`:** Caddy already declares these in its base image. Redundant.
- **Why no `HEALTHCHECK`:** Caddy does not need one for Compose ordering — `web` depends on `api` only for startup order, not health. Caddy's own retry behavior covers transient `api` unavailability.

### Locked code skeleton — `Caddyfile`

[Source: architecture.md#3.4, api/src/server.ts#routes (paths are `/api/tasks`, NOT `/tasks`)]

```caddyfile
{$DOMAIN} {
    encode gzip

    handle /api/* {
        reverse_proxy api:3000
    }

    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

Notes for the reader (do NOT add as comments to the file beyond what is already there):

- **Why `handle` (not `handle_path`) for `/api/*`:** `handle_path` would STRIP the `/api` prefix before proxying (`/api/tasks` → `/tasks`), but Story 1.3's API mounts routes at `/api/tasks` (verified in `api/src/server.ts`). Stripping would result in 404s. `handle` preserves the path; the API sees `/api/tasks` exactly.
- **Why `{$DOMAIN}` (Caddy syntax) and not `${DOMAIN}` (Compose syntax):** Caddy reads the `DOMAIN` env var from its own process environment at startup using `{$VAR}` substitution. Compose passes `DOMAIN` to the `web` service via `environment:` in `docker-compose.yml`. The two layers of substitution do NOT collide — Compose interpolates `${DOMAIN}` from `.env` BEFORE the file is parsed; Caddy interpolates `{$DOMAIN}` from the container env at startup. Mixing them up (`${DOMAIN}` in the Caddyfile) would attempt Compose substitution on a file Compose never reads → literal `${DOMAIN}` reaches Caddy → Caddy refuses to start.
- **Why `try_files {path} /index.html`:** Phase 0 has a single screen (no router), so deep-link 404 is not a real risk — but this is a defensive line that costs nothing and matches every modern SPA Caddy recipe. Story 3.x or Phase 1 routing won't need to revisit this.
- **Why no `tls internal` block:** Caddy auto-detects `localhost` (and `*.localhost`, `127.0.0.1`, `::1`) and uses its internal CA without an explicit directive. For real domains it uses Let's Encrypt by default. Adding `tls internal` would FORCE the internal CA even for a public domain — wrong.
- **Why no manual `redir http://... https://...`:** Caddy serves both 80 and 443 by default and auto-redirects http→https once a cert is provisioned. Manual redirects double up.
- **Why `encode gzip` (not `encode zstd br gzip`):** zstd / brotli are also fine, but the Story 1.4 bundle is ~60 KB gzipped (per `npm run build` output captured in `1-4-...md` Debug Log). The marginal compression gain from brotli is not worth the slightly larger Caddy image. Plain gzip is the locked choice.
- **Why no explicit `log` directive:** Caddy logs access lines to stdout by default. `docker compose logs web` shows them. An explicit `log` block would add JSON formatting and rotation knobs Phase 0 doesn't need (and FR40 says `console.*` only).

### Locked code skeleton — `docker-compose.yml`

[Source: epics.md#Story 1.5, architecture.md#3.4, architecture.md#5.1, prd.md#FR31, FR32, FR34, NFR5, NFR6, NFR7, NFR11, NFR12]

```yaml
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: tasky
    volumes:
      - tasky_pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d tasky"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s

  api:
    build: ./api
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      NODE_ENV: production
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: web/Dockerfile
    restart: unless-stopped
    environment:
      DOMAIN: ${DOMAIN}
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    volumes:
      - caddy_data:/data
      - caddy_config:/config

volumes:
  tasky_pgdata:
  caddy_data:
  caddy_config:
```

Notes for the reader (do NOT add as comments to the file beyond what is already there):

- **Why `web.build.context: .` (project root) but `api.build: ./api` (subdir):** the `web/Dockerfile` needs to `COPY Caddyfile /etc/caddy/Caddyfile` from the project root. Setting `context: ./web` would put the project-root `Caddyfile` outside the build context (Docker forbids `COPY ../...`). The `api/Dockerfile` only copies files under `api/`, so the simpler `build: ./api` works.
- **Why `POSTGRES_DB: tasky` is a literal not an env var:** the database name is part of the application contract (the `DATABASE_URL` references `/tasky`); making it configurable would invite drift between `.env` and `.env.example`. One literal in two places (here + the `pg_isready` healthcheck) is fine.
- **Why `pg_isready -U postgres -d tasky` and not just `pg_isready`:** the bare command checks server reachability but not whether the named database is ready to accept connections. After volume init, the server starts before `init.sql` finishes; we want the healthcheck to pass only after the database the API will connect to is fully ready.
- **Why `start_period: 5s`:** gives Postgres time to run `init.sql` on first boot without burning health-check retries. After first boot (volume already initialized), the server reaches ready in <1 s and `start_period` is harmless.
- **Why `depends_on.db.condition: service_healthy` for `api` (not just `depends_on: [db]`):** plain `depends_on` only orders container START, not READINESS. The API's pg pool would crash-loop if it connected before Postgres accepted connections. `service_healthy` makes Compose wait for the healthcheck to pass.
- **Why `web.depends_on: [api]` without `condition`:** Caddy will retry the upstream connection on its own (it logs a warning but doesn't crash). We just want startup ORDER (api before web) for cleaner logs. A `service_healthy` condition would require an api healthcheck — out of scope (see api/Dockerfile note above).
- **Why `caddy_data` and `caddy_config` as named volumes:** Caddy stores Let's Encrypt account keys + issued certs in `/data` and runtime state in `/config`. Losing these forces re-issuance on next deploy (Let's Encrypt has rate limits — 50 certs/registered-domain/week — usually fine, but a named volume is the right answer). Keep them around through `docker compose down`; only `down -v` wipes them, which is the intended model for "I want a clean reissue."
- **Why no `version:` key:** Compose v2 deprecated it. `docker compose` ignores it with a warning. Cleaner to omit.
- **Why no top-level `networks:`:** the default bridge network handles internal DNS by service name (`db`, `api`, `web`). A custom network would add boilerplate without benefit.
- **Why no `restart: unless-stopped` on… wait, all three already have it.** Confirm in the diff that none accidentally lost it.
- **Why `db` ports omitted entirely (not `expose: [5432]`):** `expose` documents inter-container ports; Docker bridge networks expose all ports to siblings already. `ports:` is the host-binding key; omitting it is what makes the db unreachable from the host. AC #11 verifies this.
- **Why `DOMAIN` is in `web.environment` only:** Caddy reads it. The API and DB don't need it (the API knows its routes; the DB knows its database name). Putting it in `api.environment` would mislead the next reader into thinking the API uses it.

### Locked code skeleton — `.env.example`

[Source: epics.md#Story 1.5 ("All secrets... come from .env"), prd.md#NFR11, NFR12]

```dotenv
# Tasky environment configuration. Copy this file to `.env` (which is gitignored)
# and fill in the values. Compose auto-loads `.env` from the project root.

# Postgres superuser password used by the `db` service to initialize the cluster
# on first boot. Choose a strong value for any deploy reachable from the public
# internet (the db is internal-only, but defense-in-depth costs nothing).
POSTGRES_PASSWORD=

# Connection string used by the `api` service to reach Postgres. The hostname
# MUST be `db` (the Compose service name); the database MUST be `tasky` (the
# literal in docker-compose.yml's POSTGRES_DB). Example for local dev with
# POSTGRES_PASSWORD=devpw:
#   DATABASE_URL=postgres://postgres:devpw@db:5432/tasky
DATABASE_URL=

# Public domain Caddy serves. For a real deploy, set this to the hostname whose
# DNS A record points at the host (Caddy then auto-issues a Let's Encrypt cert).
# For a local sanity check, set this to `localhost` (Caddy then auto-issues an
# internal CA cert; use `curl -k https://localhost/...`).
DOMAIN=
```

Notes for the reader (do NOT add as comments to the file beyond what is already there):

- **Why no `POSTGRES_USER` / `POSTGRES_DB` here:** `POSTGRES_USER` defaults to `postgres` (the superuser); `POSTGRES_DB` is a literal `tasky` in the compose file. No need to make them env-driven — drift risk outweighs flexibility.
- **Why no `NODE_ENV` here:** the api service hardcodes `NODE_ENV=production` in `docker-compose.yml`. There is no "dev mode" for the deployed stack — that is what Story 1.3's `npm run dev` is for.
- **Why no `PORT` here:** the api's port is the literal `3000` in compose. Changing it would also require editing the Caddyfile; not worth env-driving.

### Locked code skeleton — README Quickstart section

[Source: epics.md#Story 1.5 (Quickstart requirement), epics.md#Story 3.3 (full README polish — out of scope here)]

This is appended to the END of `README.md` (after the existing trailing blank line, currently line 50). Do NOT touch the existing `## Schema` (line 7) or `## API` (line 21) sections.

```markdown
## Quickstart

Tasky runs as a three-service Docker Compose stack — Caddy (web + TLS), Node (api), Postgres (db) — and is identical between local sanity checks and a real VPS deploy. The only difference is the value of `DOMAIN`.

```bash
git clone https://github.com/giovanniruzzi/bmad-test
cd bmad-test
cp .env.example .env
# edit .env — set POSTGRES_PASSWORD, DATABASE_URL, DOMAIN
docker compose up -d
```

Caddy auto-provisions TLS:

- For a real public domain (DNS pointing at the host): a Let's Encrypt certificate is issued on first request (~5–15 s).
- For `DOMAIN=localhost`: an internal-CA certificate is issued; verify with `curl -k https://localhost/api/tasks`.

The full README (full endpoint table, troubleshooting, screenshots) ships with Story 3.3.
```

> **NOTE on the inner code fence:** the literal Markdown above contains a fenced bash block. When you paste it into `README.md`, the inner triple-backtick fence stays — it is the actual code block readers see. The OUTER triple-backtick fence in this story file is just rendering; do NOT include the outer fence in the README.

### Local verification recipe (AC #7, #8, #9, #11, #16)

This recipe is mandatory before declaring the story `review`. It validates the entire compose stack against `DOMAIN=localhost` end-to-end without needing a real domain. Run it from the project root in a single shell session.

```bash
# 0. Pre-req checks.
docker --version          # >= 27.x
docker compose version    # >= v2.30.x

# 1. Create a throwaway local .env (NOT committed; .env is gitignored).
cat > .env <<'EOF'
POSTGRES_PASSWORD=devpw
DATABASE_URL=postgres://postgres:devpw@db:5432/tasky
DOMAIN=localhost
EOF

# 2. Cold start (forces image build first time).
docker compose up -d --build
sleep 15
docker compose ps  # Expect: db (healthy), api running, web running.

# 3. Internal-cert HTTPS check.
curl -sk -o /dev/null -w 'GET https://localhost/         %{http_code}\n' https://localhost/
curl -sk -o /dev/null -w 'GET https://localhost/api/tasks %{http_code}\n' https://localhost/api/tasks
curl -sk https://localhost/api/tasks                                         # Expect: []
curl -s  -o /dev/null -w 'GET http://localhost/  redirects to %{redirect_url}\n' http://localhost/

# 4. Frontend shell check.
curl -sk https://localhost/ | grep -E '<title>|<script|<link'
# Expect: <title>Tasky</title> + a hashed JS and CSS asset reference.

# 5. Port exposure check (AC #11).
docker compose ps --format 'table {{.Name}}\t{{.Ports}}'
# Expect: db and api rows show no 0.0.0.0:* mappings; web shows 80 and 443.
# Linux:
ss -tlnp 2>/dev/null | grep -E ':(80|443|3000|5432) '
# macOS (Docker Desktop — `ss` is not available):
# lsof -nP -iTCP:80 -iTCP:443 -iTCP:3000 -iTCP:5432 -sTCP:LISTEN
# Expect (either OS): only 80 and 443 visible to the host (3000 and 5432 are internal-only).

# 6. Persistence check.
docker compose exec db psql -U postgres -d tasky -c \
  "INSERT INTO tasks (description) VALUES ('persist-me') RETURNING id, description;"
curl -sk https://localhost/api/tasks
# Expect: [{"id":1,"description":"persist-me",...}]

# 7. `down && up` test (AC #8 — data MUST survive).
docker compose down
docker volume ls | grep -E 'tasky_pgdata|caddy_'
# Expect: tasky_pgdata, caddy_data, caddy_config still listed.
docker compose up -d
sleep 10
curl -sk https://localhost/api/tasks
# Expect: same persist-me row still there. ✅ AC #8 forward path.

# 8. `down -v` test (AC #8 inverse — data MUST be wiped).
docker compose down -v
docker volume ls | grep -E 'tasky_pgdata|caddy_'
# Expect: NONE listed (the -v flag wiped the named volumes).
docker compose up -d
sleep 15  # init.sql re-runs on the fresh volume
curl -sk https://localhost/api/tasks
# Expect: []  ✅ AC #8 inverse path.

# 9. Tear down.
docker compose down -v
rm .env  # local-only, never committed
```

Capture the per-step outputs into Debug Log References. The grep / awk / curl outputs are intentionally short so the captured log stays scannable.

### Production verification recipe (AC #10, #17)

This recipe runs against a real VPS with a real domain. It is mandatory unless explicitly deferred per AC #17.

```bash
# === LOCAL (your laptop) — pre-flight ===

# Confirm DNS points at the VPS IP from at least two external resolvers.
dig @8.8.8.8 +short <DOMAIN> A
dig @1.1.1.1 +short <DOMAIN> A
# Both MUST return the VPS IPv4. If they don't match, wait for propagation.

# === ON THE VPS (over SSH) ===

# Pre-req: Docker Engine + Docker Compose v2 installed.
docker --version          # >= 27.x
docker compose version    # >= v2.30.x

# Firewall: allow inbound 80 + 443 from anywhere.
# (ufw example — adapt for your provider's security groups.)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status

# Clone + configure.
git clone https://github.com/giovanniruzzi/bmad-test
cd bmad-test
cp .env.example .env

# Edit .env — STRONG password (reachable internally only, but defense-in-depth).
# Example values (REPLACE the password and domain):
#   POSTGRES_PASSWORD=$(openssl rand -base64 24)
#   DATABASE_URL=postgres://postgres:<that-password>@db:5432/tasky
#   DOMAIN=tasky.example.com
${EDITOR:-nano} .env

# Bring it up.
docker compose up -d --build

# Watch Caddy issue the cert (~10–30 s).
docker compose logs -f web | grep -iE 'certificate|ready'
# Look for: "certificate obtained successfully" or "served key authentication"
# Hit Ctrl+C once you see "serving initial configuration" or the cert obtained.

# === FROM ANY HOST OUTSIDE THE VPS (your laptop, phone hotspot) ===

curl -sI https://<DOMAIN>/ | head -5
# Expect: HTTP/2 200, server: Caddy.

curl -s https://<DOMAIN>/api/tasks
# Expect: []   ✅ AC #10 + FR41 (external GET).

# Cert chain — confirm Let's Encrypt issuer.
echo | openssl s_client -connect <DOMAIN>:443 -servername <DOMAIN> 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates
# Expect issuer to contain "O=Let's Encrypt"; notAfter ~90 days out.  ✅ NFR9.

# Browser load: open https://<DOMAIN>/ in a clean profile.
# Expect: lock icon (no warning); <h1>Tasky</h1>; "No tasks" placeholder; zero console errors.
```

Capture: the DNS lookup, the Caddy cert-issuance log line, the external `curl` outputs, the `openssl` cert-chain output, and a screenshot of the browser address bar showing the lock icon. Drop these into Debug Log References.

### Pre-existing repo state to be aware of

[Source: filesystem inspection at story creation time, 2026-04-29]

- **No `Caddyfile`, `docker-compose.yml`, `api/Dockerfile`, or `web/Dockerfile` exists yet.** This story creates all four.
- **`.env.example` exists with exactly 3 keys** (`POSTGRES_PASSWORD`, `DATABASE_URL`, `DOMAIN`), all with empty values. Task 5 replaces the file contents (same 3 keys, plus comments).
- **`.env` does NOT exist on disk and MUST NOT be committed** (line 3 of `.gitignore`). Local verification creates a throwaway `.env`; the recipe's final step deletes it.
- **`README.md` is 50 lines** with `## Schema` (line 7) and `## API` (line 21) sections plus the FR20 stub blockquote on line 48. Task 6 APPENDS `## Quickstart` after line 50.
- **`api/`** — Story 1.3 implementation. `package.json` has `type: module`, `scripts.build = tsc`, `scripts.start = node dist/server.js`. ESM throughout. Server binds `0.0.0.0:3000` and handles SIGTERM (verified by Story 1.3 Debug Log).
- **`api/tsconfig.json`** — `module: nodenext`, `target: esnext`, `outDir: ./dist`, `rootDir: ./src`. `tsc` (no `-b`) emits to `api/dist/`.
- **`api/src/`** — `server.ts`, `db.ts`. The Dockerfile's `COPY src ./src` captures both. The compiled output is `api/dist/server.js` (the CMD entrypoint).
- **`web/`** — Story 1.4 implementation. `package.json` build script is `tsc -b && vite build` → emits to `web/dist/`. The Dockerfile's stage 1 runs the same script; stage 2 copies `/app/dist` (the build output) into `/srv` for Caddy.
- **`web/src/api.ts`** — calls `fetch('/api/tasks')` (relative URL). The Caddyfile's `handle /api/*` makes this work in production — same-origin contract per Story 1.4 AC #8.
- **`web/vite.config.ts`** — has the dev-only proxy `'/api': 'http://localhost:3000'` from Story 1.4. This proxy is ONLY active during `npm run dev`; the production build (`npm run build` → `web/dist/`) emits no proxy config. Caddy handles `/api/*` routing in the deployed stack.
- **`db/init.sql`** — 14 lines, `CREATE TABLE IF NOT EXISTS tasks (...)`. Mounted read-only at `/docker-entrypoint-initdb.d/init.sql` per AC #4. Postgres runs it ONCE on first volume init; subsequent boots skip it (the `IF NOT EXISTS` is defense-in-depth).
- **`.gitignore`** — already covers `node_modules`, `dist`, `.env`, `*.log`. Sufficient for this story (AC #18).
- **A stray top-level `package.json`** exists at the project root. Same precedent as Stories 1.3 / 1.4: out of scope, do not touch, do not include in any Dockerfile build context.
- **`web/dist/`** may exist on the host as a leftover from Story 1.4's `npm run build` smoke. It is gitignored and IRRELEVANT to this story — the `web` Dockerfile builds inside the container; the host's `web/dist/` is not used.
- **`api/dist/`** may also exist as leftover; same — irrelevant, container builds its own.
- **Git working tree** may contain untracked items (e.g., `.playwright-mcp/`); inspect `git status` before starting and confirm none of them are yours to commit.

### What this story does NOT touch

These belong to specific later stories — touching them is scope creep:

- **`api/src/`, `web/src/`, `db/init.sql`** — read-only inputs (AC #14, #15). Application code is finalized for Phase 0 by Stories 1.3 and 1.4.
- **`api/package.json`, `web/package.json`, both `package-lock.json`** — no new deps, no `npm install` (AC #13).
- **`api/tsconfig.json`, `web/tsconfig*.json`, `web/vite.config.ts`, `web/eslint.config.js`** — toolchain configs are owned by Stories 1.1 / 1.3 / 1.4.
- **`web/index.html`** — owned by Story 1.4.
- **`.gitignore`** — already correct (AC #18).
- **`LICENSE`, the stray top-level `package.json`** — out of scope.
- **`/healthz` endpoint, `pino`/`winston` logging, OpenTelemetry, Sentry, Prometheus, Grafana, uptime monitor, dashboards** — Architecture §5.3 explicitly forbids in Phase 0; not a Story 1.5 concern.
- **`POST /api/tasks`, `PATCH`, `DELETE`, optimistic UI, error toast** — Stories 2.1–2.5.
- **Full restart-scenario verification (browser refresh, browser restart, device restart, app process restart, host VPS reboot)** — Story 2.6 owns the FR32 / NFR5 / NFR6 full verification matrix. This story verifies only the two compose-level scenarios (`down && up`, `down -v && up`) per AC #8.
- **Playwright E2E** — Story 2.7 / 3.2.
- **Designed empty state, mobile responsive, full README polish** — Stories 3.1, 3.2, 3.3.
- **Optimistic UI** — Story 3.4 (first-to-cut on overrun).

### Anti-patterns to avoid (common LLM mistakes)

- ❌ Do **not** use `handle_path /api/*` in the Caddyfile — it strips the `/api` prefix and the API would 404. Use `handle /api/*` (path-preserving). [AC #3, locked Caddyfile]
- ❌ Do **not** use shell-style `${DOMAIN}` in the Caddyfile — that is Compose substitution syntax. Caddy uses `{$DOMAIN}` (braces around the dollar). Mixing them up means Caddy literally tries to serve a site named `${DOMAIN}` and refuses to start.
- ❌ Do **not** set `web.build.context: ./web` — `web/Dockerfile` needs to copy the project-root `Caddyfile`, which is outside `./web`. Use `context: .` + `dockerfile: web/Dockerfile`.
- ❌ Do **not** set `api.build.context: .` — unnecessary and bloats the build context (the `_bmad/`, `_bmad-output/`, `web/`, `node_modules/` dirs all become part of the daemon-uploaded context). Keep `api.build: ./api`.
- ❌ Do **not** publish ports for `db` (no `ports: ["5432:5432"]`) or `api` (no `ports: ["3000:3000"]`). Only `web` publishes 80 and 443. AC #11 verifies this.
- ❌ Do **not** add `version: "3.x"` at the top of `docker-compose.yml`. Compose v2 deprecated it.
- ❌ Do **not** add a top-level `networks:` block. The default bridge network handles internal DNS.
- ❌ Do **not** set `container_name:` on any service. Lets Compose generate names; allows running multiple stacks side-by-side; matches every other Compose example in the repo.
- ❌ Do **not** mount the host's `web/dist/` into the `web` container at runtime. The image MUST be self-contained — a fresh clone on a new host has no `web/dist/`.
- ❌ Do **not** use `npm install` in either Dockerfile. Use `npm ci` for reproducible builds against the committed `package-lock.json`.
- ❌ Do **not** use `node:24` (the non-Alpine variant). Architecture pins `node:24-alpine`.
- ❌ Do **not** install `tsx`, `nodemon`, `pm2`, `dumb-init`, or `tini` in the api runtime stage. Modern Node handles SIGTERM correctly; Compose handles process supervision via `restart: unless-stopped`.
- ❌ Do **not** ship the api source TypeScript in the runtime image. Stage 2 copies only `dist/` from the builder.
- ❌ Do **not** ship `node_modules` from the api builder to the api runtime. Run `npm ci --omit=dev` in stage 2 to get a clean prod-only `node_modules`.
- ❌ Do **not** add a `HEALTHCHECK` to `api/Dockerfile`. The API has no `/healthz` route (Story 1.3 deliberately skipped it). Compose's startup ordering via `depends_on` is sufficient.
- ❌ Do **not** add `tls internal` or `acme_ca https://...` to the Caddyfile. Caddy's defaults are correct (Let's Encrypt for public, internal CA for `localhost`).
- ❌ Do **not** add a manual `redir http://... https://...` block in the Caddyfile. Caddy auto-redirects port 80 → 443.
- ❌ Do **not** add `dotenv`, `cross-env`, or any env-loading library to `api/package.json`. The api reads `process.env.DATABASE_URL` directly (Story 1.3); Compose injects it via `environment:` in `docker-compose.yml`.
- ❌ Do **not** commit the `.env` file. It is gitignored. The `.env.example` is the committed template.
- ❌ Do **not** put real secrets in `.env.example`. All values stay empty (just keys + comments).
- ❌ Do **not** add `POSTGRES_USER` to either `.env.example` or `docker-compose.yml`. The default `postgres` user is correct.
- ❌ Do **not** make `POSTGRES_DB` env-driven. It is the literal `tasky` in compose; making it env-driven invites drift between `DATABASE_URL` and the actual db name.
- ❌ Do **not** add a `cors` middleware to the API "to make this work." Same-origin via Caddy means CORS is never needed (Story 1.3 AC #17, Story 1.4 AC #8).
- ❌ Do **not** add a `/healthz` route, observability (pino/winston/OpenTelemetry/Sentry/Prometheus), or a process supervisor (pm2, supervisor, systemd unit) to the api or web. Architecture §5.3 forbids in Phase 0.
- ❌ Do **not** modify `api/src/`, `web/src/`, or `db/init.sql` (AC #14, #15). Containerize the existing code as-is.
- ❌ Do **not** modify `api/package.json` or `web/package.json` (AC #13). Zero new dependencies.
- ❌ Do **not** REPLACE the existing `## Schema` or `## API` sections in `README.md`. APPEND `## Quickstart` after the existing content (AC #12).
- ❌ Do **not** promote the `## Quickstart` section above `## Schema` / `## API` in the README. Story 3.3 owns the polished structure; this story is additive only.
- ❌ Do **not** add screenshots, badges, troubleshooting, or full endpoint table to the new Quickstart section. That is Story 3.3's scope.
- ❌ Do **not** skip the local verification recipe (Task 7). It is the safety net that catches "I forgot to copy `Caddyfile`" before the production deploy fails for the same reason.
- ❌ Do **not** silently overrun the 3-hour hard alarm. If you are still debugging at the 3-hour mark, halt and trigger the brutal-cut-order replan per the epic. Do NOT push past the alarm hoping the next 30 minutes will fix it — they won't, and the cascade through Stories 3.x is the actual cost.
- ❌ Do **not** add a `user:` key to the `web` service in `docker-compose.yml`. The official `caddy:2-alpine` image runs as root specifically so it can bind privileged ports 80 and 443; it drops privileges internally for the worker process. Forcing a non-root `user:` will cause Caddy to fail (silently in some configs) when binding 443.

### Rationale: why Caddy and not nginx

[Source: architecture.md#3.4]

Caddy 2.x ships auto-TLS via Let's Encrypt with one Caddyfile directive — the site's domain. nginx requires either certbot + a cron job for renewal (two more moving parts) or the nginx-plus enterprise SKU (paid — violates NFR23). The Caddyfile is also dramatically shorter than the equivalent nginx config (~7 lines vs ~40+ for the same routing + cert + http-redirect behavior). Caddy is the architectural decision; nginx is not on the table.

### Rationale: why Compose and not Kubernetes / Nomad / docker-swarm

[Source: architecture.md#3.4]

Phase 0 runs on a single VPS. K8s for one node is a category error (kubelet + control-plane RAM dwarfs the application stack itself). Nomad has the same single-node-overkill problem. Docker Swarm is technically lighter but is in maintenance mode upstream. Compose v2 is the right size: one YAML, one binary (`docker compose` is a Docker Engine plugin), zero extra control plane. If Tasky ever needed to scale horizontally (it won't in Phase 0; FR-NFR21 caps at "exactly two services + Caddy"), the compose file translates trivially to a Swarm stack or a Helm chart.

### Rationale: why Postgres init via `/docker-entrypoint-initdb.d/` and not a migration framework

[Source: architecture.md#3.3, architecture.md#5.3]

Phase 0 has a single immutable schema. The official `postgres` image runs scripts in `/docker-entrypoint-initdb.d/` exactly once on first volume init — which is precisely what's needed. Adding Flyway / Liquibase / Knex / Prisma migrations would (a) require an api-side migration runner with its own state table, (b) require a "do I run migrations on every startup or just once?" decision, (c) ship dependencies. None of which is needed for one CREATE TABLE. Architecture §5.3 explicitly forbids `migrations/` in Phase 0.

### Rationale: why named volumes and not bind mounts for db data

[Source: architecture.md#3.3, prd.md#FR32, NFR5, NFR6]

Bind mounts (`./pgdata:/var/lib/postgresql/data`) tie the data to a specific host directory and inherit host filesystem permissions, which fights with the Postgres container's UID-26 user. Named volumes (`tasky_pgdata:/var/lib/postgresql/data`) are managed by Docker — permissions are correct by default, the data location is opaque to the host filesystem (lives in `/var/lib/docker/volumes/...`), and `docker volume` commands provide the standard backup/restore surface. Bind mounts are the right answer when you need to inspect/edit the data on the host (you don't, for Postgres). Named volume is the canonical Compose choice.

### Naming and style conventions

[Source: architecture.md#4.1]

- **Compose service names:** lower-case single word (`db`, `api`, `web`). These become DNS hostnames inside the Docker network.
- **Compose volume names:** lower-case snake_case (`tasky_pgdata`, `caddy_data`, `caddy_config`). Compose prefixes them with the project name at runtime (`bmad-test_tasky_pgdata`); the un-prefixed name is what appears in the file.
- **Env var names in `.env` / `docker-compose.yml`:** `SCREAMING_SNAKE_CASE` (`POSTGRES_PASSWORD`, `DATABASE_URL`, `DOMAIN`). Standard 12-factor convention.
- **Caddyfile site address:** `{$DOMAIN}` — one site block per domain; use Caddy's env-substitution syntax for portability.
- **Dockerfile stages:** lower-case single word (`builder`, `runtime`). Referenced by `COPY --from=<stage>`.
- **Image tags:** pinned major.minor or LTS-name (`node:24-alpine`, `postgres:17-alpine`, `caddy:2-alpine`). Do NOT use `:latest` — silent breaking changes on rebuild are exactly the kind of unbounded-overrun risk this story exists to eliminate.

### References

- [Source: epics.md#Story 1.5] — User story, acceptance criteria, scope boundaries (epics.md lines 352–379).
- [Source: epics.md#Story 1.5 ("Time budget" / "Hard alarm at 3 hours")] — 3-hour hard alarm and brutal-cut-order trigger (epics.md line 356).
- [Source: epics.md#Story 1.5 ("Scope note")] — Consolidation rationale (1.5 + 1.6 merged); do not re-split (epics.md line 354).
- [Source: epics.md#Story 1.2] — `db/init.sql` schema ownership (consumed read-only by this story).
- [Source: epics.md#Story 1.3] — API contract input: `GET /api/tasks` returns `Task[]` JSON, binds `0.0.0.0:3000`, handles SIGTERM, no `/healthz`.
- [Source: epics.md#Story 1.4] — Frontend input: same-origin contract (`fetch('/api/tasks')` relative URL); production routing depends on Caddy `/api/*` rule.
- [Source: epics.md#Story 2.6] — Full restart-scenario verification matrix (FR32 / NFR5 / NFR6); this story owns only the two compose-level scenarios.
- [Source: epics.md#Story 3.3] — Full README polish (Distribution-ready); this story is additive only with the Quickstart section.
- [Source: epics.md#Story 3.4] — First-to-cut on overrun; the brutal-cut order is 3.4 → 3.3 → 3.2 → 3.1.
- [Source: prd.md#FR20] — API documentation in README (already shipped by Story 1.3 — Quickstart is a separate add).
- [Source: prd.md#FR31] — One `docker compose up` brings the full stack online from a clean clone.
- [Source: prd.md#FR32] — Compose includes the Postgres service with a named persistent volume.
- [Source: prd.md#FR33] — Application reachable at a publicly resolvable URL over HTTPS.
- [Source: prd.md#FR34] — Supervised process manager restarts services on crash + reboot (`restart: unless-stopped`).
- [Source: prd.md#FR40] — `console.*` to stdout/stderr only; no logging library (applies to Caddy / api / db log directives).
- [Source: prd.md#FR41] — External `GET /api/tasks` returns 200 (must originate outside the VPS to genuinely exercise the public path).
- [Source: prd.md#NFR5] — Zero task data loss across all five restart scenarios (full verification in Story 2.6; this story verifies the two compose scenarios).
- [Source: prd.md#NFR6] — Persistence verified by `add task → docker compose down && up → task still present` test sequence (this story performs the compose sub-test; full sequence in Story 2.6).
- [Source: prd.md#NFR7] — Application supervisor restarts processes on crash and host boot (`restart: unless-stopped`).
- [Source: prd.md#NFR8] — Successful API response is the operational health signal; no separate dashboard/monitor/alert.
- [Source: prd.md#NFR9] — All traffic served over HTTPS with a valid TLS certificate (Caddy + Let's Encrypt for public; internal CA for `localhost`).
- [Source: prd.md#NFR11] — No secrets / credentials committed to the public repository.
- [Source: prd.md#NFR12] — Database credentials supplied via env vars, not source code.
- [Source: prd.md#NFR20] — Self-hoster reaches a working application in under 15 minutes (the Quickstart is the artifact that makes this true).
- [Source: prd.md#NFR21] — Stack runs as exactly two services (Node + Postgres) plus Caddy; no third-party SaaS deps.
- [Source: prd.md#NFR23] — No production-stack dependency requires paid license / paid tier / registration (Caddy + Let's Encrypt + Postgres + Node all free).
- [Source: architecture.md#3.1] — Stack: Node 24 LTS Alpine, Postgres 17, Caddy 2.x, Express 5.1, React 19.2 + Vite 8.0 (consumed via the build artifacts).
- [Source: architecture.md#3.3] — Postgres 17 + named volume `tasky_pgdata` + `db/init.sql` mounted at `/docker-entrypoint-initdb.d/`.
- [Source: architecture.md#3.4] — Deployment topology: Caddy (TLS + static + `/api/*` proxy) → api (Node) → db (Postgres); only Caddy publishes 80/443; api + db internal-only; auto-TLS via Let's Encrypt.
- [Source: architecture.md#5.1] — Repo layout: `Caddyfile`, `docker-compose.yml`, `.env.example`, `api/Dockerfile`, `web/Dockerfile` are the locked deploy file set.
- [Source: architecture.md#5.3] — No `/healthz`, no observability, no migration framework, no process supervisor (beyond Compose `restart:`), no test framework — all forbidden in Phase 0.
- [Source: 1-1-repository-scaffold-and-starter-templates.md] — `.env.example` (3 keys), `.gitignore` (`.env`, `node_modules`, `dist`, `*.log`) scaffolded.
- [Source: 1-2-database-schema-and-init-sql-bootstrap.md] — `db/init.sql` shape; mount target `/docker-entrypoint-initdb.d/init.sql`.
- [Source: 1-3-minimal-api-with-get-api-tasks-returning-empty-list.md] — API runtime contract: binds `0.0.0.0:3000`, ESM (`type: module`), `npm run build = tsc`, `npm start = node dist/server.js`, SIGTERM handler verified, routes mounted at `/api/tasks` (path-preserving routing required at the Caddyfile layer).
- [Source: 1-4-minimal-frontend-rendering-empty-shell.md] — Frontend runtime contract: build script `tsc -b && vite build` → `web/dist/`; `fetch('/api/tasks')` relative URL; production same-origin routing depends on Caddy rule; Vite dev-server proxy is dev-only and IRRELEVANT to this story.

### Project Structure Notes

- The project root is `/Users/gio/Source/bmad-test/`. All paths above are relative to this root.
- After this story, the project root contains four NEW files (`Caddyfile`, `docker-compose.yml`, `api/Dockerfile`, `web/Dockerfile`) and two MODIFIED files (`.env.example`, `README.md`). Nothing else changes.
- The deploy file set (`Caddyfile`, `docker-compose.yml`, `.env.example`, plus the two `Dockerfile`s) matches Architecture §5.1's locked layout exactly.
- `web/Dockerfile`'s build context is the project root (per `web.build.context: .` in compose) so it can `COPY Caddyfile`. `api/Dockerfile`'s build context is `./api` (smaller context, faster uploads to the Docker daemon).
- The BMad scaffolding directories (`_bmad/`, `_bmad-output/`, `.agents/`, `docs/`) are unaffected. They are NOT in any Dockerfile build context (api builds from `./api`; web builds from `.` but only `COPY`s files Caddy needs).
- `api/`, `web/`, `db/`, `LICENSE`, `.gitignore` are unaffected (except `web/dist/` may be regenerated by the container build, but it remains gitignored on the host).
- After this story, the entire stack is reachable at `https://<DOMAIN>/` (Tasky shell) and `https://<DOMAIN>/api/tasks` (`200 []` JSON). Local-only: `https://localhost/...` with the `-k` flag for the internal CA cert.
- Story 2.x will exercise the deployed stack with real data (POST/PATCH/DELETE) without any further deploy-config changes — the contract laid down here (Caddy `/api/*` proxy, named volume persistence, `restart: unless-stopped`) is final for Phase 0.

## Dev Agent Record

### Agent Model Used

claude-opus-4.7 (github-copilot/claude-opus-4.7) via OpenCode dev-story workflow

### Debug Log References

**Local verification recipe — single-session capture (2026-04-29, host: macOS / Docker 29.4.0 / Compose v5.1.1):**

```
$ docker --version
Docker version 29.4.0, build 9d7ad9f
$ docker compose version
Docker Compose version v5.1.1

$ cat .env
POSTGRES_PASSWORD=devpw
DATABASE_URL=postgres://postgres:devpw@db:5432/tasky
DOMAIN=localhost

$ git check-ignore -v .env
.gitignore:3:.env	.env

$ docker compose up -d --build
... (build of bmad-test-api and bmad-test-web — both succeed) ...
 Container bmad-test-db-1 Healthy
 Container bmad-test-api-1 Started
 Container bmad-test-web-1 Started

$ docker compose ps
NAME              SERVICE   STATUS                    PORTS
bmad-test-api-1   api       Up 16 seconds             3000/tcp
bmad-test-db-1    db        Up 21 seconds (healthy)   5432/tcp
bmad-test-web-1   web       Up 16 seconds             0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp

$ docker compose logs db | grep "ready to accept"
db-1 | LOG:  database system is ready to accept connections
$ docker compose logs api
api-1 | API listening on port 3000
$ docker compose logs web | grep -E 'certificate|serving'
web-1 | logger=tls.obtain msg=certificate obtained successfully identifier=localhost issuer=local
web-1 | msg=serving initial configuration

$ curl -sk -o /dev/null -w '%{http_code}\n' https://localhost/
200
$ curl -sk -o /dev/null -w '%{http_code}\n' https://localhost/api/tasks
200
$ curl -sk https://localhost/api/tasks
[]
$ curl -s -o /dev/null -w 'status=%{http_code} redirect=%{redirect_url}\n' http://localhost/
status=308 redirect=https://localhost/
$ curl -sk https://localhost/ | grep -E '<title>|<script|<link'
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Tasky</title>
    <script type="module" crossorigin src="/assets/index-DY0bkENL.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index--qwHxly2.css">

$ docker compose ps --format 'table {{.Name}}\t{{.Ports}}'
bmad-test-api-1   3000/tcp
bmad-test-db-1    5432/tcp
bmad-test-web-1   0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp
$ lsof -nP -iTCP:80 -iTCP:443 -iTCP:3000 -iTCP:5432 -sTCP:LISTEN
# Only Docker (com.docke) listening on 80 and 443; nothing Docker on 3000 or 5432.
# (A pre-existing host-level nginx is also bound to 443 — unrelated to this stack;
# Docker traffic actually flows through the IPv6 binding com.docke is using.)

$ docker compose exec -T db psql -U postgres -d tasky -c \
    "INSERT INTO tasks (description) VALUES ('persist-me') RETURNING id, description;"
 id | description
----+-------------
  1 | persist-me
INSERT 0 1
$ curl -sk https://localhost/api/tasks
[{"id":1,"description":"persist-me","completed":false,"createdAt":"2026-04-29T21:02:15.440Z"}]

# down && up — data MUST survive
$ docker compose down
 Container bmad-test-{web,api,db}-1 Stopped + Removed
 Network bmad-test_default Removed
$ docker volume ls | grep bmad-test
bmad-test_caddy_config
bmad-test_caddy_data
bmad-test_tasky_pgdata
$ docker compose up -d
... all three services up; db Healthy ...
$ curl -sk https://localhost/api/tasks
[{"id":1,"description":"persist-me","completed":false,"createdAt":"2026-04-29T21:02:15.440Z"}]
# ✅ AC #8 forward path — same row, same createdAt timestamp.

# down -v — data MUST be wiped
$ docker compose down -v
 Volume bmad-test_caddy_data Removed
 Volume bmad-test_caddy_config Removed
 Volume bmad-test_tasky_pgdata Removed
$ docker volume ls | grep bmad-test
(none)
$ docker compose up -d
... all three services up; db Healthy after init.sql replay ...
$ curl -sk https://localhost/api/tasks
[]
# ✅ AC #8 inverse path — fresh volume, init.sql re-ran, empty tasks table.

$ docker compose down -v
$ rm .env
$ lsof -nP -iTCP:80 -iTCP:443 -sTCP:LISTEN | grep -i docker
# (no output — Docker no longer holding ports)
```

### Completion Notes List

1. **All locked code skeletons applied character-for-character with one documented adjustment.** `web/Dockerfile` stage-1 COPY paths are prefixed with `web/` because the compose `web` service uses `build.context: .` (project root) — this is required so the Dockerfile can `COPY Caddyfile /etc/caddy/Caddyfile`. The locked skeleton in Dev Notes used bare paths (`COPY package.json ...`) which assumes context is `./web`, contradicting the docker-compose.yml skeleton's explicit `context: .` for this service. The Dev Notes paragraph for `web/Dockerfile` flags this exact divergence ("Read this paragraph twice; it is the easiest thing to get wrong in this story"). Verified: container builds successfully and serves the static dist via Caddy.

2. **Local verification recipe (Task 7 / AC #16) executed end-to-end with all checks green.** Cold start, internal-cert HTTPS (200 / `[]` / 308 redirect), Tasky shell HTML, port exposure (only 80/443 published; 3000 and 5432 internal-only), persistence via `down && up` (row preserved), data wipe via `down -v && up` (init.sql replays, returns `[]`), clean teardown.

3. **Production verification (Task 8 / AC #10 / AC #17) deferred** to the Phase 0 completion gate per AC #17's explicit deferral clause. No VPS / public domain available at story-execution time. The deferral creates a tracked debt against Phase 0 sign-off, NOT against this story's `done` status (per AC #17). The compose stack that was locally verified is byte-identical to what would deploy on a VPS — only `DOMAIN` value (`localhost` → real domain) and Caddy issuer (internal CA → Let's Encrypt) differ, both controlled by Caddy's hostname detection (no code change between local and production).

4. **Critical config sanity checks all confirmed during local verification:**
   - Caddy `handle /api/*` is path-PRESERVING — `/api/tasks` reaches the api as `/api/tasks` (NOT stripped to `/tasks`).
   - `db.healthcheck` (using `pg_isready -U postgres -d tasky`) gates `api` startup correctly — `api` only starts after db reports `Healthy`.
   - Internal DNS works (default bridge network, no top-level `networks:` block) — Caddy reaches `api:3000` and api reaches `db:5432` by service name.
   - `restart: unless-stopped` set on all three services (verified via the compose file diff and YAML inspection).
   - HTTP→HTTPS auto-redirect: `308` to `https://localhost/`, no manual redirect directive needed.
   - Caddy logged the expected `installing root certificate` warning on first cold boot with `DOMAIN=localhost` — harmless per AC #16.

5. **No source-code edits, no dependency changes, no `.gitignore` edits** (AC #13, #14, #15, #18 verified via `git diff`). The package.json and package-lock.json files for both `api/` and `web/` are byte-identical to story start; `api/src/`, `web/src/`, and `db/init.sql` show zero diff.

6. **No real secrets committed.** `.env.example` keys remain empty; the throwaway `.env` (with placeholder `devpw`) was created only inside the verification recipe and deleted at teardown. The `.env` file is not in `git status`.

7. **Image sizes (informational, observed during build):** `bmad-test-api` and `bmad-test-web` both build successfully on `node:24-alpine` builders + `node:24-alpine` (api runtime) / `caddy:2-alpine` (web runtime). The runtime stages contain only production artifacts (no source TS, no devDeps).

8. **Time budget:** Story completed well within the 2-hour soft target — no overrun, no need to invoke the brutal-cut-order replan.

9. **Commit deferred to manual builder action** per the convention established in Stories 1.1–1.4.

### File List

**Added:**
- `Caddyfile` — Site block with `handle /api/* → reverse_proxy api:3000` (path-preserving), static `handle` with `root * /srv` + SPA fallback, `encode gzip`, `{$DOMAIN}` env-substitution.
- `docker-compose.yml` — Three services (`db`, `api`, `web`); db with healthcheck + named volume `tasky_pgdata` + read-only `init.sql` mount; api with `service_healthy` dependency on db; web with `build.context: .` + `caddy_data` / `caddy_config` volumes + ports 80/443; no `version:`, no top-level `networks:`.
- `api/Dockerfile` — Multi-stage `node:24-alpine`; builder runs `npm ci` + `npm run build`; runtime runs `npm ci --omit=dev`, copies `--from=builder /app/dist`, drops to `USER node`, exposes 3000, `CMD ["node", "dist/server.js"]`.
- `web/Dockerfile` — Multi-stage; builder is `node:24-alpine` and runs `npm run build`; runtime is `caddy:2-alpine` with `/app/dist` → `/srv` and project `Caddyfile` → `/etc/caddy/Caddyfile`. Stage-1 COPY paths are `web/`-prefixed (build context is project root).

**Modified:**
- `.env.example` — Same three keys (`POSTGRES_PASSWORD`, `DATABASE_URL`, `DOMAIN`), all empty values, plus inline `#` comments explaining each key and a copy-pasteable `DATABASE_URL` example.
- `README.md` — Appended `## Quickstart` section after the existing `## API` section (existing `## Schema` and `## API` content is byte-identical).

**Tracking-only (not story payload):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status updated `ready-for-dev` → `in-progress` → `review`.
- `_bmad-output/implementation-artifacts/1-5-docker-compose-orchestration-and-production-https-deploy.md` — Dev Agent Record / File List / Change Log / Status filled in.

## Change Log

| Date       | Version | Change                                                                                                                                                                                                                                | Author |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-29 | 0.1     | Story drafted (ready-for-dev) by create-story workflow. Includes locked code skeletons for `api/Dockerfile`, `web/Dockerfile`, `Caddyfile`, `docker-compose.yml`, `.env.example`, README Quickstart section; anti-patterns list; local + production verification recipes; references with `[Source: ...]` citations. 3-hour hard-alarm protocol called out at top.                                  | PM     |
| 2026-04-29 | 0.2     | Quality-checklist pass: AC #3 Caddyfile skeleton corrected to `handle /api/*` (path-preserving) — removed the deliberately-wrong `handle_path` example that risked copy-paste disasters. AC #10 `Content-Type` assertion softened to "contains `application/json`" (don't pin charset suffix Express may not emit). Added lockfile-presence pre-checks to Tasks 1 + 2. Added macOS port-check fallback (`lsof`) to Task 7 and the Local verification recipe. Added Caddy `installing root certificate` log-noise note to Task 7. Added `user:` anti-pattern for the web service. Trimmed 3 duplicate rationale bullets from `api/Dockerfile` Dev Notes (already covered in AC #1). | PM     |
| 2026-04-29 | 1.0     | Story implemented. Added `Caddyfile`, `docker-compose.yml`, `api/Dockerfile`, `web/Dockerfile`; modified `.env.example` (added inline guidance comments) and `README.md` (appended `## Quickstart` section). One documented adjustment to the locked skeleton: `web/Dockerfile` stage-1 COPY paths are `web/`-prefixed because compose's `web.build.context` is `.` (project root) — required so the Dockerfile can copy the project-root `Caddyfile`. Local verification recipe (Task 7 / AC #16) executed end-to-end with all checks green: cold start, internal-cert HTTPS, Tasky shell HTML, port-exposure (only 80/443 published), persistence (`down && up` preserved a row; `down -v && up` wiped it). Status set to `review`. **Production verification (AC #10 / Task 8 / AC #17) deferred to the Phase 0 completion gate** — no VPS / public domain available at story-execution time. Per AC #17, deferral creates a tracked debt against Phase 0 sign-off, NOT against this story's `done` status. | Dev |
