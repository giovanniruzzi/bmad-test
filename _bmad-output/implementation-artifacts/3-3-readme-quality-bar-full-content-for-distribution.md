# Story 3.3: README quality bar — full content for distribution

Status: review

## Story

As a self-hoster discovering the repo on Hacker News or `/r/selfhosted`,
I want the README to present a live demo URL, a screenshot, a one-paragraph philosophy statement, a quickstart, and a complete API endpoint table,
So that I can evaluate, deploy, and use the app without leaving the GitHub page.

## Acceptance Criteria

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

## Dev Notes

### Architectural alignment & locked decisions

1. **`README.md` is REWRITTEN in full** — this is the distribution-ready version. The existing 91-line README (verified via `Read` of the current file state) is the stub from Stories 1.2 and 2.1. The dev MUST preserve every piece of accurate information already present (the schema table, the API table seed, the quickstart's Caddy/TLS notes) while extending and reorganizing into the final structure locked in Dev Note #6. The rewrite is NOT a strip-and-restart — it's a section-by-section build-up that respects the prior content as ground truth. [Source: README.md (current state, 91 lines), epics.md#Story 3.3 ACs]

2. **The TARGET reader is a self-hoster** — specifically, the persona described in PRD Journey 4 ("the latent self-hoster who finds the repo"). They land on the GitHub page from Hacker News, /r/selfhosted, or a similar discovery surface. Their evaluation flow (PRD lines 244-247): (a) read the philosophy → decide if the project's values align with theirs, (b) click the live demo URL → confirm the app actually works, (c) scan the API endpoint table → confirm it's plain REST and matches their integration intent, (d) skim the quickstart → decide if they can deploy it in <15 min, (e) skim the docker-compose.yml in the repo → confirm no surprise services. The README MUST optimize for this scan-and-decide pattern: short paragraphs, scannable headings, code blocks for commands, a table for endpoints. NO marketing prose, NO testimonials, NO "why we built this" autobiography, NO competitor comparisons. [Source: prd.md lines 244-247 (Journey 4), prd.md#NFR20 (15-minute clone-to-working budget)]

3. **The README MUST render correctly on github.com** (AC #11). This means: standard CommonMark + GitHub-Flavored Markdown only. Specifically supported: ATX headings (`#`, `##`, `###`), unordered lists (`-`), ordered lists (`1.`), tables (pipe-syntax), fenced code blocks with language tags (`` ```bash ``, `` ```json ``, `` ```sql ``), inline code (`` `code` ``), bold (`**bold**`), italic (`*italic*`), blockquotes (`>`), links (`[text](url)`), images (`![alt](path)`). NOT supported / forbidden: HTML `<details>` is supported by GitHub but DO NOT use it (collapses content scanability hurts); HTML `<center>` is deprecated; HTML `<br>` is acceptable inside table cells if needed but prefer markdown line-breaks otherwise; mermaid/plantuml diagrams are supported but OUT OF SCOPE for this story. NO LaTeX/math, NO custom anchor IDs, NO raw HTML tag soup. [Source: AC #11, GitHub Flavored Markdown Spec]

4. **The screenshot is REQUIRED** (AC #2 — "embedded near the top"). It must show the running application with at least 2-3 sample tasks visible (so the empty state is NOT the screenshot — the populated list is). The screenshot lives at `docs/screenshot.png` (NEW file in the `docs/` directory; the directory MAY already exist if Story 3.2 chose Form A and created `docs/mobile-verification.png`). The screenshot is referenced in the README via `![Screenshot of Tasky showing a task list](docs/screenshot.png)` — relative path, descriptive alt text. The image SHOULD be a desktop-browser screenshot (not mobile — the mobile verification artifact is a separate concern owned by Story 3.2). Resolution: 1200-1800px wide is ideal for GitHub's content-width rendering. Format: PNG (lossless; small UI screenshots compress well). File size target: < 500 KB (use `pngquant` or similar if needed; do NOT exceed 1 MB). DO NOT use a JPEG (text in screenshots compresses poorly with lossy formats). DO NOT use an animated GIF or video. [Source: AC #2, GitHub image rendering]

5. **The live demo URL is REQUIRED** (AC #1 — "live demo URL pointing to the deployed Tasky instance"). The dev MUST: (a) confirm the deployed URL from Story 1.5 is still reachable, (b) embed it in the README as a top-of-document link AND in the Quickstart section. The exact URL is the value of the `DOMAIN` env var used in the Story 1.5 deploy (e.g., `https://tasky.example.com`). IF no real public deploy exists at story-start (e.g., the Story 1.5 deploy was rolled back, or the domain has expired), the dev MUST document this in Completion Notes and use the placeholder `https://<your-tasky-domain>` while flagging that the README needs a real URL before publication; the story can still ship with the placeholder + the documented gap, but this is a regression from FR36's intent. [Source: AC #1, FR36, Story 1.5 (deploy artifact)]

6. **The locked README structure** (top-to-bottom section order) is EXACTLY:

    ```
    # Tasky

    [one-line tagline]
    [live demo URL link]
    [screenshot]

    ## Philosophy

    [single paragraph — the discipline-thesis voice]

    ## Quickstart

    [git clone → cp .env.example .env → edit → docker compose up -d → reach app]
    [Caddy TLS notes — preserved from current README]

    ## API

    [endpoint table — 4 rows]
    [task object JSON shape]
    [example requests/responses for each endpoint]
    [validation rules + error format]

    ## Schema

    [the existing schema table from Story 1.2 — preserved verbatim]

    ## Persistence verification

    [the section established by Story 2.6 — preserved verbatim]
    [Story 2.7's smoke-test note — preserved if present]
    [Story 3.2's Form B mobile-verification line — preserved if present]

    ## Backup and restore

    [pg_dump command + psql restore command]

    ## Acknowledged Phase 0 gaps

    [no auth, no rate limiting, no automated backups, no monitoring]
    [deployable behind Tailscale / Cloudflare Tunnel / basic-auth note]

    ## Repository

    [link to repo, license-or-no-license note]
    ```

    The dev MUST follow this section order exactly. Sub-headings (`###`) within a section are permitted at the dev's discretion as long as they aid scannability; do NOT add new top-level (`##`) sections beyond this list. [Source: AC #1-11, structural design optimized for Journey 4 scan flow]

7. **The Philosophy paragraph** (AC #3) is a SINGLE paragraph (no bullet list, no sub-headings, no second paragraph). It MUST express, in roughly 4-6 sentences, the brief's discipline thesis: minimal on purpose; the four interactions (see/add/complete/delete) are the entire product; no auth, no projects, no tags, no due dates, no notifications in Phase 0; self-hosted on the operator's own VPS; backup is `pg_dump`; no third-party SaaS in the stack. The voice MUST match the brief — direct, terse, opinionated, no hedge words like "we feel" or "we believe", no marketing superlatives like "blazing fast" or "delightful", no calls to action like "join our community". The paragraph is descriptive of what the project IS, not promotional. The dev MUST author this paragraph (the brief's exact wording is in `_bmad-output/planning-artifacts/prd.md` if available; otherwise the dev paraphrases faithfully). [Source: AC #3, prd.md (discipline thesis voice references), epics.md#Story 3.3 AC ("brief's discipline-thesis voice")]

8. **The Quickstart section** (AC #4) preserves the existing quickstart content from the current README (lines 72-87) AS THE BASE and adds: (a) explicit `.env.example` step (already present — verify), (b) explicit mention of the Postgres password generation (e.g., `openssl rand -base64 32` for `POSTGRES_PASSWORD`), (c) explicit mention of the `DATABASE_URL` format (`postgres://USER:PASS@db:5432/tasky`), (d) the working URL after deploy (`https://<DOMAIN>`). The Caddy TLS notes (Let's Encrypt for public domains, internal-CA for `localhost`) MUST be preserved. The quickstart MUST achieve the NFR20 budget: a competent self-hoster can clone, configure, and reach a working app in under 15 minutes. [Source: AC #4, README.md lines 72-87 (current quickstart), prd.md#NFR20]

9. **The API endpoint table** (AC #5) MUST list ALL FOUR endpoints with full detail. The columns: `Method`, `Path`, `Request body`, `Response body`, `Status codes`. The four rows:

    | Method | Path | Request body | Response body | Status codes |
    | --- | --- | --- | --- | --- |
    | GET | `/api/tasks` | — | Array of `Task` objects | `200 OK` |
    | POST | `/api/tasks` | `{ "description": string }` | The created `Task` | `201 Created`, `400 Bad Request` |
    | PATCH | `/api/tasks/:id` | `{ "completed": boolean }` (and/or `{ "description": string }` if Story 2.3 supports it) | The updated `Task` | `200 OK`, `400 Bad Request`, `404 Not Found` |
    | DELETE | `/api/tasks/:id` | — | empty body | `204 No Content`, `404 Not Found` |

    The dev MUST verify the actual API behavior matches each row by referencing Stories 2.1 (POST), 2.3 (PATCH), 2.4 (DELETE) and the current `api/src/server.ts`. If any divergence exists (e.g., DELETE returns 200 with the deleted task body instead of 204 with empty), update the table to match REALITY — the table documents the implementation, not aspirational behavior. The PATCH row's request body — if Story 2.3 only accepts `{ "completed": boolean }` and not `{ "description": string }` — should reflect that exactly; do NOT document fields the API doesn't accept. [Source: AC #5, FR20, Stories 2.1/2.3/2.4 + api/src/server.ts (verification)]

10. **The Task object JSON shape** (AC #6) MUST be documented as a code block immediately after the endpoint table:

    ```json
    {
      "id": 1,
      "description": "Buy milk",
      "completed": false,
      "createdAt": "2026-04-29T10:00:00.000Z"
    }
    ```

    Followed by a bullet list explaining each field:
    - `id` — number — server-assigned auto-incrementing primary key (BIGSERIAL in DB)
    - `description` — string — the task text (1-500 characters)
    - `completed` — boolean — whether the task is done
    - `createdAt` — string — ISO-8601 UTC timestamp of creation
    - **Not in JSON:** `owner_id` — reserved for Phase 1 multi-user authentication; always `NULL` in Phase 0; **never exposed in API responses**

    The `owner_id` exclusion note is REQUIRED per AC #6 explicit text. [Source: AC #6, db/init.sql, api/src/db.ts (boundary mapping)]

11. **Example requests and responses** for each endpoint MUST appear after the endpoint table, in the order GET → POST → PATCH → DELETE. Each example is a `curl` command in a `bash` code block followed by the response in a `json` (or empty for 204) code block. Use `https://<your-tasky-domain>/api/tasks` (or the literal deployed URL if available) as the base URL — DO NOT use `localhost` for the public-facing examples (a self-hoster wants to see the public-URL pattern). DO use `localhost` only for the dev-mode quickstart. The four examples (locked):

    ```bash
    # GET — list all tasks
    curl https://<your-tasky-domain>/api/tasks
    ```

    ```json
    [
      {
        "id": 1,
        "description": "Buy milk",
        "completed": false,
        "createdAt": "2026-04-29T10:00:00.000Z"
      }
    ]
    ```

    ```bash
    # POST — create a task
    curl -X POST -H 'Content-Type: application/json' \
      -d '{"description":"Buy milk"}' \
      https://<your-tasky-domain>/api/tasks
    ```

    ```json
    {
      "id": 1,
      "description": "Buy milk",
      "completed": false,
      "createdAt": "2026-04-29T10:00:00.000Z"
    }
    ```

    ```bash
    # PATCH — toggle completion
    curl -X PATCH -H 'Content-Type: application/json' \
      -d '{"completed":true}' \
      https://<your-tasky-domain>/api/tasks/1
    ```

    ```json
    {
      "id": 1,
      "description": "Buy milk",
      "completed": true,
      "createdAt": "2026-04-29T10:00:00.000Z"
    }
    ```

    ```bash
    # DELETE — remove a task
    curl -X DELETE https://<your-tasky-domain>/api/tasks/1
    ```

    ```
    (HTTP 204 — empty body)
    ```

    [Source: AC #5, Stories 2.1/2.3/2.4 (API behavior)]

12. **Validation rules + error format** appear after the examples:
    - `description` MUST be a string with length 1-500 characters.
    - `completed` MUST be a boolean.
    - Validation errors return HTTP 400 with body `{ "error": "<message>" }`.
    - Not-found errors return HTTP 404 with body `{ "error": "<message>" }`.
    - The error format (single `error` string field) is consistent across all endpoints.

    [Source: api/src/server.ts (error middleware), Stories 2.1/2.3/2.4]

13. **The Schema section** (AC #7) is the existing schema documentation from the current README (lines 7-19). PRESERVE IT VERBATIM. Do not reword the column descriptions, do not change the table format, do not move the link to `db/init.sql`. The only acceptable edit is to update the `## Schema` heading's position (per the locked structure in Dev Note #6, Schema appears AFTER the API section, not before). [Source: AC #7, README.md lines 7-19, FR39]

14. **The Persistence verification section** is the section established by Story 2.6 (and possibly extended by Story 2.7's one-line smoke-test note and Story 3.2's Form B one-line mobile-verification note). PRESERVE IT VERBATIM (whatever its current state). Do not reword the scenarios, do not reorder them, do not "improve" the format. This section is owned by Stories 2.6/2.7/3.2; this story's job is to ensure it remains in the final README structure at the correct position. [Source: AC #7 (preservation), Stories 2.6/2.7/3.2]

15. **The Backup and restore section** (AC #10 — `pg_dump` reference) MUST contain at minimum:
    - A one-paragraph explanation: "Tasky uses no automated backup. The complete application state is in the Postgres `tasky` database; back it up with `pg_dump` and restore with `psql`."
    - A backup command:
      ```bash
      docker compose exec db pg_dump -U <POSTGRES_USER> tasky > tasky-backup.sql
      ```
    - A restore command:
      ```bash
      docker compose exec -T db psql -U <POSTGRES_USER> -d tasky < tasky-backup.sql
      ```
    - A note: "The schema is documented above; if the database is destroyed, recreate the volume (Docker auto-runs `db/init.sql` on first init) before restoring data."

    The dev MUST verify the exact `POSTGRES_USER` value used in the project's `docker-compose.yml` and use that literal in the commands (or use `<POSTGRES_USER>` placeholder if the value varies). [Source: AC #10, NFR22, docker-compose.yml]

16. **The Acknowledged Phase 0 gaps section** (AC #9) MUST contain a SINGLE bullet list with at minimum these four items, each with a brief explanation:
    - **No authentication.** The app exposes the API and UI without auth. Anyone who can reach the URL can read, create, update, and delete tasks. Deploy behind Tailscale, Cloudflare Tunnel, or HTTP basic-auth at the reverse proxy if external-network exposure is a concern.
    - **No rate limiting.** No request-rate enforcement at the API or proxy layer. A burst of requests will not be throttled.
    - **No automated backups.** Backup is manual via `pg_dump` (see above). No scheduled snapshots, no off-site replication, no point-in-time recovery.
    - **No monitoring.** No health-check dashboard, no alerting, no log aggregation. Logs are container `stdout`; inspect via `docker compose logs`.

    The section MUST end with the sentence: "These gaps block external-user use until Phase 1." This text matches the AC #9 requirement verbatim (well — close enough; the literal text is "and notes these block external-user use until Phase 1" — paraphrase acceptable).

    The Tailscale/Cloudflare Tunnel/basic-auth note (AC #8 — NFR13) MAY appear inside the "No authentication" bullet OR as a separate paragraph after the gaps list. The dev's choice; both satisfy AC #8.

    IF Story 3.4 was CUT (per its cut criteria), an additional bullet MAY appear: "**No optimistic UI.** Mutations wait for the server response before reflecting in the visible list. The fallback is a ~150ms skeleton placeholder for create actions, per Story 2.7's deferred design." This is OPTIONAL and only appears if the dev knows at story-start that 3.4 was cut; otherwise omit (3.4 may yet be implemented). [Source: AC #8/9/10, NFR13, NFR22, epics.md#Story 3.4 cut criteria]

17. **NO third-party SDK references in example code** (AC #12 — NFR10 documentation discipline). Specifically: NO `import analytics from 'segment'`, NO `<script src="google-analytics">`, NO Cloudflare Turnstile, NO reCAPTCHA, NO Sentry/Bugsnag/Rollbar in example error-handling snippets. The README's example code is plain `curl`, plain JSON, plain `docker compose` commands. [Source: AC #12, NFR10]

18. **NO badges at the top of the README** in this story (no Shields.io build/coverage/license badges). Phase 0 has no CI pipeline (no test runs to status), no published license decision (the repo's license is the operator's choice; absence of a LICENSE file means "all rights reserved" which is acceptable for a self-hosted-only project). Adding badges would imply infrastructure that doesn't exist. A future Phase 1 story may add badges; this story does not. [Source: scope discipline, no CI in Phase 0]

19. **The repository link** (locked README structure: `## Repository` section) is the existing link from the current README (line 5) — `Repository: https://github.com/giovanniruzzi/bmad-test`. PRESERVE the URL but RELOCATE it to the bottom of the README under the `## Repository` section. The section MAY also include: "License: not specified (all rights reserved by default — fork/clone permitted by GitHub TOS for personal use)." OR the dev may omit the license note entirely. The choice is the dev's; document it in Completion Notes. [Source: README.md line 5, scope discipline]

20. **The one-line tagline** at the top of the README (immediately under `# Tasky`) is the existing line from the current README (line 3): `A deliberately minimal, self-hosted todo app.` PRESERVE IT VERBATIM. This tagline is the one-sentence pitch a self-hoster sees when the GitHub page first loads; it correctly captures the project's positioning and matches the brief's voice. [Source: README.md line 3]

21. **The live demo URL** appears immediately after the tagline as a single-line link:

    ```markdown
    **Live demo:** https://tasky.example.com
    ```

    (using the actual deployed URL or the placeholder per Dev Note #5). The bold-prefixed-line format makes it scannable. [Source: AC #1, README rendering pattern]

22. **The screenshot** appears immediately after the live demo URL line:

    ```markdown
    ![Screenshot of Tasky showing a task list with several items](docs/screenshot.png)
    ```

    The alt text is descriptive (NOT just "Screenshot" or "Tasky") for screen-reader accessibility. [Source: AC #2, accessibility best practices]

23. **The dev MUST capture the screenshot** before this story can be marked `done`. Recipe: (a) ensure the stack is running with 3-5 sample tasks added (mix of completed and not-completed states for visual variety), (b) open the deployed URL (or `http://localhost`) in a desktop browser at default zoom (100%), (c) capture a screenshot of just the app's content area (NOT the full browser chrome — use the OS screenshot region tool: `Cmd+Shift+4` on macOS, `Win+Shift+S` on Windows, `gnome-screenshot -a` on Linux), (d) save as `docs/screenshot.png`, (e) commit with this story's changes. Target dimensions: 1200-1800px wide, height proportional to content (typically 600-1200px tall). File size < 500 KB ideally; < 1 MB hard ceiling. [Source: AC #2, Dev Note #4]

24. **NO HTML embeds, iframes, or video** in the README. The screenshot is a static PNG. No demo GIF, no Loom video link, no embedded YouTube. The text describes; the screenshot shows. [Source: AC #11, scope discipline]

25. **NO Table of Contents (`## Table of Contents`) section.** The README is short enough (~150-250 lines after rewrite) that GitHub's auto-generated TOC (the hamburger icon at the top-right of the rendered README) is sufficient. Adding a manual TOC adds maintenance burden and visual clutter without benefit at this length. [Source: scope discipline]

26. **NO emoji in headings or section titles.** Plain text headings only. (Emoji elsewhere in the prose is the dev's choice but not encouraged — the discipline-thesis voice is terse, not playful.) [Source: voice consistency, scope discipline]

27. **NO contributor sections, NO code-of-conduct section, NO issue templates** referenced in the README. Phase 0 is a single-builder project; community-contribution scaffolding is premature. A future Phase 1 story may add these; this story does not. [Source: scope discipline, single-builder Phase 0]

28. **NO changelog inside the README.** The git log IS the changelog. A separate `CHANGELOG.md` is OUT OF SCOPE for this story. [Source: scope discipline]

29. **NO `## Testing` section beyond mentioning Story 2.7's smoke test.** The "Persistence verification" section established by Stories 2.6/2.7 IS the testing surface documentation; do not duplicate it under a separate `## Testing` heading. If the dev feels a one-liner about the smoke test is needed in addition to Story 2.7's own one-liner inside Persistence verification, add it as a subsection within Persistence verification (`### Automated smoke test`) — NOT as a top-level section. [Source: scope discipline, Stories 2.6/2.7 ownership]

30. **NO `## Troubleshooting` section** in this story. Troubleshooting content (e.g., "what if Caddy fails to issue a cert?") is OUT OF SCOPE. A future Phase 1 story may add troubleshooting once real-world operator reports surface common issues; until then, premature troubleshooting docs become stale. [Source: scope discipline]

31. **NO `## FAQ` section** in this story. Same reasoning as troubleshooting — FAQs require real questions from real users. [Source: scope discipline]

32. **NO `## Roadmap` section** in this story. The "Acknowledged Phase 0 gaps" section IS the implicit roadmap (Phase 1 will address these). A separate roadmap section would invite scope creep ("when's the iOS app coming?"). [Source: scope discipline, Phase 0 boundary]

33. **NO mention of Tasky's competitors** (Todoist, TickTick, Apple Reminders, Microsoft To Do, Things, etc.). The README describes Tasky on its own terms; comparison is the reader's judgment. [Source: voice consistency]

34. **The dev MUST verify the README renders correctly on github.com** (AC #11). Recipe:
    - After committing the changes, push to a branch on the GitHub repo.
    - View the README on github.com (NOT in a local Markdown preview tool).
    - Confirm: tables render correctly (no broken column alignment), code blocks have correct syntax highlighting (`bash`, `json`, `sql` should color appropriately), the screenshot loads (relative path `docs/screenshot.png` resolves), all internal links (`[`db/init.sql`](db/init.sql)`) are clickable.
    - If anything renders incorrectly, fix and re-push.
    - Document the verification in Completion Notes (URL of the rendered README, observed issues + fixes).
    [Source: AC #11, GitHub Markdown rendering]

35. **NO modifications to source code, schema, or configuration** in this story. This story's complete file-change set is exactly: `README.md` (full rewrite), `docs/screenshot.png` (new — screenshot artifact). Specifically, do NOT modify `api/`, `web/`, `db/`, `e2e/`, `docker-compose.yml`, `Caddyfile`, `Dockerfile*`, or `package.json` files. [Source: scope discipline, AC scope]

36. **The dev MUST preserve the link to `db/init.sql`** (current README line 19: `Canonical DDL is defined in [`db/init.sql`](db/init.sql).`). This link is the bridge from the README's documented schema to the canonical source-of-truth file. [Source: README.md line 19, FR39]

### Locked README skeleton (full)

The dev MUST produce a README structurally equivalent to the following. Inline placeholders in `<angle brackets>` MUST be replaced with project-specific values; placeholders in `[square brackets]` are author guidance and MUST be removed/replaced with prose.

```markdown
# Tasky

A deliberately minimal, self-hosted todo app.

**Live demo:** <https://tasky.example.com>

![Screenshot of Tasky showing a task list with several items](docs/screenshot.png)

## Philosophy

[4-6 sentence paragraph in the discipline-thesis voice — see Dev Note #7]

## Quickstart

Tasky runs as a three-service Docker Compose stack — Caddy (web + TLS), Node (api), Postgres (db) — and is identical between local sanity checks and a real VPS deploy. The only difference is the value of `DOMAIN`.

```bash
git clone https://github.com/<owner>/<repo>
cd <repo>
cp .env.example .env
# Edit .env:
#   POSTGRES_PASSWORD — generate with: openssl rand -base64 32
#   DATABASE_URL      — postgres://USER:PASS@db:5432/tasky
#   DOMAIN            — your-domain.com (or "localhost" for local sanity check)
docker compose up -d
```

After the stack is up, open `https://<DOMAIN>` in a browser.

Caddy auto-provisions TLS:

- For a real public domain (DNS pointing at the host): a Let's Encrypt certificate is issued on first request (~5–15 s).
- For `DOMAIN=localhost`: an internal-CA certificate is issued; verify with `curl -k https://localhost/api/tasks`.

## API

The API is mounted at the same origin under the `/api/` prefix and proxied to the Node container by Caddy in the deployed stack. All endpoints respond with JSON; collections are bare arrays (not envelopes), errors are `{ "error": "<message>" }`, and dates are ISO-8601 UTC strings.

| Method | Path             | Request body                           | Response body            | Status codes                            |
| ------ | ---------------- | -------------------------------------- | ------------------------ | --------------------------------------- |
| GET    | `/api/tasks`     | —                                      | Array of `Task` objects  | `200 OK`                                |
| POST   | `/api/tasks`     | `{ "description": string }`            | The created `Task`       | `201 Created`, `400 Bad Request`        |
| PATCH  | `/api/tasks/:id` | `{ "completed": boolean }`             | The updated `Task`       | `200 OK`, `400 Bad Request`, `404 Not Found` |
| DELETE | `/api/tasks/:id` | —                                      | empty body               | `204 No Content`, `404 Not Found`       |

### Task object

```json
{
  "id": 1,
  "description": "Buy milk",
  "completed": false,
  "createdAt": "2026-04-29T10:00:00.000Z"
}
```

- `id` — number — server-assigned auto-incrementing primary key (`BIGSERIAL` in DB).
- `description` — string — the task text (1-500 characters).
- `completed` — boolean — whether the task is done.
- `createdAt` — string — ISO-8601 UTC timestamp of creation.
- **Not in JSON:** `owner_id` — reserved for Phase 1 multi-user authentication; always `NULL` in Phase 0; **never exposed in API responses**.

### Examples

```bash
# GET — list all tasks
curl https://<your-tasky-domain>/api/tasks
```

```json
[
  {
    "id": 1,
    "description": "Buy milk",
    "completed": false,
    "createdAt": "2026-04-29T10:00:00.000Z"
  }
]
```

```bash
# POST — create a task
curl -X POST -H 'Content-Type: application/json' \
  -d '{"description":"Buy milk"}' \
  https://<your-tasky-domain>/api/tasks
```

```json
{
  "id": 1,
  "description": "Buy milk",
  "completed": false,
  "createdAt": "2026-04-29T10:00:00.000Z"
}
```

```bash
# PATCH — toggle completion
curl -X PATCH -H 'Content-Type: application/json' \
  -d '{"completed":true}' \
  https://<your-tasky-domain>/api/tasks/1
```

```json
{
  "id": 1,
  "description": "Buy milk",
  "completed": true,
  "createdAt": "2026-04-29T10:00:00.000Z"
}
```

```bash
# DELETE — remove a task
curl -X DELETE https://<your-tasky-domain>/api/tasks/1
```

```
(HTTP 204 — empty body)
```

### Validation and errors

- `description` must be a string with length 1-500 characters.
- `completed` must be a boolean.
- Validation errors return HTTP `400 Bad Request` with body `{ "error": "<message>" }`.
- Not-found errors return HTTP `404 Not Found` with body `{ "error": "<message>" }`.

## Schema

[Preserve the existing schema table from the current README verbatim.]

Phase 0 ships a single `tasks` table. The schema is bootstrapped by Postgres on first volume initialization from [`db/init.sql`](db/init.sql) (mounted into the container's `/docker-entrypoint-initdb.d/`); no migration framework is used. Backup and restore is plain `pg_dump` / `psql -f init.sql`.

| Column        | Type           | Nullability | Default              | Purpose                                                                                            |
| ------------- | -------------- | ----------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `id`          | `BIGSERIAL`    | NOT NULL    | sequence (auto)      | Primary key. 64-bit auto-incrementing integer; safe in JSON `number` (≤ 2^53).                     |
| `description` | `TEXT`         | NOT NULL    | —                    | Task text. `CHECK` enforces length 1–500 (defense-in-depth alongside API validation).              |
| `completed`   | `BOOLEAN`      | NOT NULL    | `FALSE`              | Whether the task is done.                                                                          |
| `created_at`  | `TIMESTAMPTZ`  | NOT NULL    | `NOW()`              | Creation timestamp (UTC at storage; serialized as ISO-8601 UTC by the API).                        |
| `owner_id`    | `BIGINT`       | NULL        | —                    | Reserved for Phase 1 multi-user auth. Always `NULL` in Phase 0; **omitted from API JSON output**.  |

Canonical DDL is defined in [`db/init.sql`](db/init.sql).

## Persistence verification

[Preserve the section from Story 2.6 (and any extensions from Stories 2.7 and 3.2) verbatim.]

## Backup and restore

Tasky uses no automated backup. The complete application state is in the Postgres `tasky` database. Back it up with `pg_dump` and restore with `psql`.

```bash
# Backup
docker compose exec db pg_dump -U <POSTGRES_USER> tasky > tasky-backup.sql

# Restore
docker compose exec -T db psql -U <POSTGRES_USER> -d tasky < tasky-backup.sql
```

The schema is documented above; if the database volume is destroyed, recreate it (Docker auto-runs `db/init.sql` on first init) before restoring data.

## Acknowledged Phase 0 gaps

These gaps are deliberate. Phase 0 ships a working app for a single self-hosting individual; closing these gaps is Phase 1 work.

- **No authentication.** The app exposes the API and UI without auth. Anyone who can reach the URL can read, create, update, and delete tasks. Deploy behind Tailscale, Cloudflare Tunnel, or HTTP basic-auth at the reverse proxy if external-network exposure is a concern.
- **No rate limiting.** No request-rate enforcement at the API or proxy layer. A burst of requests will not be throttled.
- **No automated backups.** Backup is manual via `pg_dump` (see above). No scheduled snapshots, no off-site replication, no point-in-time recovery.
- **No monitoring.** No health-check dashboard, no alerting, no log aggregation. Logs are container `stdout`; inspect via `docker compose logs`.

These gaps block external-user use until Phase 1.

## Repository

Repository: https://github.com/<owner>/<repo>
```

### Anti-patterns (do not do these)

- ❌ DO NOT add a `## Table of Contents` section. Per AC #25.
- ❌ DO NOT add Shields.io badges at the top. Per AC #18.
- ❌ DO NOT add a `## Troubleshooting` section. Per AC #30.
- ❌ DO NOT add a `## FAQ` section. Per AC #31.
- ❌ DO NOT add a `## Roadmap` section. Per AC #32.
- ❌ DO NOT add a `## Contributing` or `## Code of Conduct` section. Per AC #27.
- ❌ DO NOT add a `## Changelog` section inside the README. Per AC #28.
- ❌ DO NOT mention Todoist, TickTick, Apple Reminders, or any other competitor. Per AC #33.
- ❌ DO NOT use emoji in section headings. Per AC #26.
- ❌ DO NOT use HTML `<details>`/`<summary>` collapsible sections. Per AC #3.
- ❌ DO NOT use HTML `<center>`, `<br>` in prose, or any HTML tag soup. Per AC #3.
- ❌ DO NOT add raw HTML iframes, video embeds, or animated GIFs. Per AC #24.
- ❌ DO NOT add a Mermaid diagram, PlantUML diagram, or sequence diagram. Per AC #3 / AC #24.
- ❌ DO NOT add a marketing tagline like "The fastest todo app you'll ever use" — preserve "A deliberately minimal, self-hosted todo app." per AC #20.
- ❌ DO NOT add testimonial quotes (real or fictional). Per AC scope.
- ❌ DO NOT add CTAs ("Star this repo!", "Join our Discord!", "Follow us on Twitter!"). Per AC scope.
- ❌ DO NOT mention price, pricing tiers, or commercial offerings. Per AC scope (Phase 0 is self-hosted, no commercial component exists).
- ❌ DO NOT add a logo image, brand assets, or favicon mention. Per AC scope (the favicon exists in `web/public/favicon.svg` from Story 1.4 but doesn't need a README mention).
- ❌ DO NOT change the screenshot path from `docs/screenshot.png` to `screenshot.png` (root level), `assets/screenshot.png`, `media/screenshot.png`, or anywhere else. Per AC #4 / Dev Note #4.
- ❌ DO NOT use a JPEG or animated WebP for the screenshot. PNG only. Per Dev Note #4.
- ❌ DO NOT include the browser chrome (URL bar, tabs, OS dock) in the screenshot — capture just the app's content area. Per Dev Note #23.
- ❌ DO NOT take the screenshot in dark mode (the app has only one theme — white background). Per Dev Note #23.
- ❌ DO NOT use `localhost` as the API host in the public examples (use `<your-tasky-domain>` placeholder or the literal deployed URL). Per Dev Note #11.
- ❌ DO NOT remove the `db/init.sql` link from the Schema section. Per Dev Note #36.
- ❌ DO NOT modify the schema table's content (column types, descriptions, formatting). Per Dev Note #13.
- ❌ DO NOT modify the Persistence verification section's content. Per Dev Note #14.
- ❌ DO NOT add a `LICENSE` file as part of this story (license decision is the operator's; out of scope here). Per Dev Note #19.
- ❌ DO NOT add a `CONTRIBUTING.md` file. Per AC #27.
- ❌ DO NOT add `.github/ISSUE_TEMPLATE/` or `.github/PULL_REQUEST_TEMPLATE.md`. Per AC #27.
- ❌ DO NOT add `## Acknowledgements` thanking React, Postgres, Caddy, etc. — they're listed in the Quickstart's stack description. Per scope discipline.
- ❌ DO NOT use SVG screenshots (PNG only — SVG can introduce XSS vectors when embedded in markdown). Per Dev Note #4.
- ❌ DO NOT add a "Quick links" or "Resources" section linking to external blog posts. Per scope discipline.
- ❌ DO NOT add tracking pixels, Google Analytics tags, or any analytics SDK references in example code. Per AC #12 / NFR10.
- ❌ DO NOT add `npm install` instructions (the project uses Docker Compose; npm is for dev work, not user-facing setup). Per AC #4 (quickstart is `docker compose up -d`).
- ❌ DO NOT mention specific Postgres versions, Node versions, or React versions in the user-facing Quickstart (they're locked in `docker-compose.yml`/`Dockerfile*`; users don't choose). The Philosophy or stack-list paragraph MAY mention them at the dev's discretion. Per scope discipline.
- ❌ DO NOT add a Stack section listing every dependency. The Quickstart's "Caddy + Node + Postgres" mention is sufficient. Per scope discipline.
- ❌ DO NOT add screenshots of the empty state, the error toast, or the mobile view (one screenshot only — the populated list view). Per AC #2 / Dev Note #4.
- ❌ DO NOT add a `## Architecture` section linking to `_bmad-output/planning-artifacts/architecture.md` — workflow artifacts are internal; users don't need them. Per scope discipline.
- ❌ DO NOT add a `## Development` section explaining how to set up the dev environment without Docker. The Docker Compose flow IS the dev environment in Phase 0. Per scope discipline.
- ❌ DO NOT modify `web/public/favicon.svg` or any other web asset. Per Dev Note #35.
- ❌ DO NOT add a `## Performance` section with Lighthouse scores or load-time benchmarks. Per scope discipline.

### What this story does NOT touch

Out of scope (NEVER modify in this story):
- `api/` directory (entire backend untouched).
- `web/` directory (entire frontend untouched, including `web/index.html` and `web/src/App.css`).
- `db/` directory (schema untouched — README's Schema section MIRRORS the canonical `db/init.sql`).
- `e2e/` directory (smoke test untouched).
- `docker-compose.yml`, `Caddyfile`, `Dockerfile*`, `.env.example` (deployment untouched — README's Quickstart MIRRORS them).
- `package.json` files (no new deps).
- `_bmad-output/planning-artifacts/` (planning artifacts are read-only references).
- `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/` (out of scope per AC #27 / Dev Note #19).
- `docs/mobile-verification.png` IF Story 3.2 created it (preserved as-is — different artifact, different concern).

In scope (this story OWNS these):
- `README.md` — full rewrite per the locked structure (Dev Note #6) and skeleton (Locked README skeleton section).
- `docs/screenshot.png` (new) — desktop-browser screenshot of the running app with 3-5 sample tasks. Create `docs/` if it doesn't yet exist.

### Project Structure Notes

- `README.md`: target file for full rewrite.
- `docs/screenshot.png` (new): screenshot artifact at project root `docs/` directory.
- `docs/` directory: may already exist from Story 3.2 Form A; create if absent.

### References

- `_bmad-output/planning-artifacts/epics.md#Story 3.3` (lines 569-590) — story source-of-truth.
- `_bmad-output/planning-artifacts/prd.md#FR20` (line 529) — API documentation in README.
- `_bmad-output/planning-artifacts/prd.md#FR36` (line 563) — README contains live demo URL, screenshot, philosophy, quickstart, API docs.
- `_bmad-output/planning-artifacts/prd.md#FR39` (line 569) — schema documented in README.
- `_bmad-output/planning-artifacts/prd.md#NFR10` (line 630) — no third-party SDKs.
- `_bmad-output/planning-artifacts/prd.md#NFR13` (line 633) — deployable behind Tailscale/Cloudflare/basic-auth.
- `_bmad-output/planning-artifacts/prd.md#NFR20` (line 658) — 15-minute clone-to-working budget.
- `_bmad-output/planning-artifacts/prd.md#NFR22` (line 660) — `pg_dump` + `psql` backup/restore documented.
- `_bmad-output/planning-artifacts/prd.md` lines 244-247 — Journey 4 self-hoster scan flow.
- `_bmad-output/planning-artifacts/architecture.md` — stack overview (referenced for Quickstart accuracy).
- `_bmad-output/implementation-artifacts/2-1-create-task-post-api-tasks-endpoint.md` — POST `/api/tasks` behavior (verifies API table row).
- `_bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md` — PATCH `/api/tasks/:id` behavior.
- `_bmad-output/implementation-artifacts/2-4-delete-task-delete-api-tasks-id-and-ui.md` — DELETE `/api/tasks/:id` behavior.
- `_bmad-output/implementation-artifacts/2-6-persistence-verification-across-restart-scenarios.md` — Persistence verification section preserved.
- `_bmad-output/implementation-artifacts/2-7-playwright-smoke-test-in-e2e.md` — smoke-test note preserved.
- `_bmad-output/implementation-artifacts/3-2-mobile-and-responsive-behavior.md` — mobile-verification note preserved (if Form B chosen).
- README.md (current state, 91 lines) — base content to preserve (schema table, quickstart, tagline).
- db/init.sql — canonical schema source (linked from README).
- api/src/server.ts — actual API behavior (verifies endpoint table accuracy).
- docker-compose.yml — service composition (verifies Quickstart accuracy).
- GitHub Flavored Markdown Spec — supported syntax.
- WCAG 2.1 — alt text accessibility for screenshot.

## Tasks / Subtasks

- [x] Task 1: Read current state and gather verification inputs (Dev Note #1)
  - [x] Read full current `README.md`.
  - [x] Read `api/src/server.ts` to verify endpoint table accuracy (status codes, response shapes, validation rules).
  - [x] Read `db/init.sql` to verify schema table accuracy.
  - [x] Read `docker-compose.yml` and `.env.example` (or wherever env vars are documented) to verify Quickstart accuracy (variable names, image versions if mentioned).
  - [x] Identify the current deployed URL from Story 1.5 — confirm reachability (Dev Note #5). If unreachable, document the gap and use placeholder.
  - [x] Identify Story 2.6's Persistence verification section content — note its exact text (preserve verbatim — Dev Note #14).
  - [x] Check if Story 2.7 added a smoke-test note inside Persistence verification — preserve it.
  - [x] Check if Story 3.2 chose Form B (README mobile-verification line) — preserve it.

- [ ] Task 2: Capture the screenshot (AC #2, Dev Note #23) — DEFERRED (runtime artifact; requires running stack)
  - [ ] Ensure the stack is running with 3-5 sample tasks (mix of completed/not-completed states).
  - [ ] Open the deployed URL (or `http://localhost`) in a desktop browser at default zoom (100%).
  - [ ] Capture a region screenshot of the app's content area only (no browser chrome).
  - [ ] Save as `docs/screenshot.png`. Create `docs/` directory if absent.
  - [ ] Verify file size < 500 KB ideally; < 1 MB hard ceiling. Use `pngquant` if needed.
  - [ ] Verify dimensions ~1200-1800px wide.

- [x] Task 3: Author the Philosophy paragraph (AC #3, Dev Note #7)
  - [x] Draft a 4-6 sentence paragraph in the discipline-thesis voice.
  - [x] Include: minimal on purpose; the four interactions are the whole product; no auth/projects/tags/due-dates/notifications in Phase 0; self-hosted; `pg_dump` is backup; no third-party SaaS.
  - [x] Avoid: marketing prose, hedge words, CTAs.

- [x] Task 4: Build the API endpoint table and examples (AC #5/6, Dev Notes #9/10/11/12)
  - [x] Compose the 4-row endpoint table per the locked skeleton.
  - [x] Verify each row matches actual API behavior (Stories 2.1/2.3/2.4 + server.ts).
  - [x] Adjust rows to match REALITY if any divergence (e.g., DELETE returning 200 vs 204).
  - [x] Compose the Task object JSON shape and field bullet list.
  - [x] Compose the four example curl commands + responses (GET, POST, PATCH, DELETE).
  - [x] Compose the validation rules + error format section.

- [x] Task 5: Compose the Backup and restore section (AC #10, Dev Note #15)
  - [x] Verify the actual `POSTGRES_USER` value used in `docker-compose.yml`.
  - [x] Compose the one-paragraph explanation + backup command + restore command + rebuild note.

- [x] Task 6: Compose the Acknowledged Phase 0 gaps section (AC #8/9, Dev Note #16)
  - [x] Compose the 4-bullet list (no auth, no rate limiting, no automated backups, no monitoring).
  - [x] Include the Tailscale/Cloudflare Tunnel/basic-auth note (inside the auth bullet OR as a separate paragraph).
  - [x] End with the sentence about Phase 1.
  - [ ] OPTIONAL: include the no-optimistic-UI bullet IF Story 3.4 was cut at story-start. (3.4 is still ready-for-dev — bullet omitted.)

- [x] Task 7: Assemble the full README per the locked skeleton (Dev Note #6 / Locked README skeleton section)
  - [x] Title + tagline (preserved verbatim from current README — Dev Note #20).
  - [x] Live demo URL line.
  - [x] Screenshot embed.
  - [x] Philosophy section (Task 3 output).
  - [x] Quickstart section (preserve current quickstart base + add `.env` setup details — Dev Note #8).
  - [x] API section (Task 4 output).
  - [x] Schema section (preserved verbatim from current README — Dev Note #13).
  - [x] Persistence verification section (preserved verbatim from Stories 2.6/2.7/3.2 — Dev Note #14).
  - [x] Backup and restore section (Task 5 output).
  - [x] Acknowledged Phase 0 gaps section (Task 6 output).
  - [x] Repository section (preserved + relocated from current line 5 — Dev Note #19).

- [x] Task 8: Anti-pattern self-audit (Dev Note "Anti-patterns")
  - [x] Confirm no badges, no TOC, no troubleshooting/FAQ/roadmap sections.
  - [x] Confirm no emoji in headings.
  - [x] Confirm no HTML embeds, no Mermaid, no GIFs.
  - [x] Confirm no competitor mentions, no testimonials, no CTAs.
  - [x] Confirm no analytics SDK references in example code.
  - [x] Confirm no LICENSE, CONTRIBUTING, .github/ files added.
  - [x] Confirm screenshot path is `docs/screenshot.png` (not relocated).
  - [x] Confirm `db/init.sql` link still present.

- [ ] Task 9: Local Markdown sanity check — DEFERRED (no local Markdown previewer invoked in batch-dev mode)
  - [ ] Render the README with a local Markdown previewer (e.g., VS Code's preview, `glow`, `grip`).
  - [ ] Confirm tables align, code blocks have language tags, the screenshot reference resolves.
  - [ ] Fix any obvious rendering issues.

- [ ] Task 10: GitHub render verification (AC #11, Dev Note #34) — DEFERRED (requires push to remote; local commit only in batch-dev mode)
  - [ ] Commit and push the changes to a branch on the GitHub repo.
  - [ ] View the README on github.com.
  - [ ] Confirm tables, code blocks, syntax highlighting, screenshot, and links all render correctly.
  - [ ] If any issue: fix and re-push.
  - [ ] Document the verification (URL of the rendered README, observed issues + fixes) in Completion Notes.

- [x] Task 11: Update Dev Agent Record + flip status to `review`
  - [x] Fill in Completion Notes (verification results, screenshot dimensions/size, URLs verified, deferred sections, etc.).
  - [x] Update File List with: `README.md` (rewritten), `docs/screenshot.png` (new).
  - [x] Update Change Log with v0.1 entry.
  - [x] In `_bmad-output/implementation-artifacts/sprint-status.yaml`, flip `3-3-readme-quality-bar-full-content-for-distribution` from `ready-for-dev` to `review`. Bump `last_updated` comment.

## Dev Agent Record

### Context Reference

- _bmad-output/planning-artifacts/epics.md (Story 3.3 — lines 569-590)
- _bmad-output/planning-artifacts/prd.md (FR20/36/39 lines 529/563/569; NFR10/13/20/22 lines 630/633/658/660; Journey 4 lines 244-247)
- _bmad-output/planning-artifacts/architecture.md (stack overview)
- README.md (current state — 91 lines, base content preserved)
- api/src/server.ts (actual API behavior — verifies endpoint table)
- db/init.sql (canonical schema)
- docker-compose.yml (service composition — verifies Quickstart)
- .env.example (env var names — verifies Quickstart)
- _bmad-output/implementation-artifacts/2-1-create-task-post-api-tasks-endpoint.md
- _bmad-output/implementation-artifacts/2-3-toggle-task-completion-patch-api-tasks-id-and-ui.md
- _bmad-output/implementation-artifacts/2-4-delete-task-delete-api-tasks-id-and-ui.md
- _bmad-output/implementation-artifacts/2-6-persistence-verification-across-restart-scenarios.md
- _bmad-output/implementation-artifacts/2-7-playwright-smoke-test-in-e2e.md
- _bmad-output/implementation-artifacts/3-2-mobile-and-responsive-behavior.md (Form B note if chosen)

### Agent Model Used

claude-opus-4.7 (github-copilot/claude-opus-4.7)

### Debug Log References

### Completion Notes

- Deployed URL used in README (real or placeholder?): placeholder `https://your-tasky-domain` (no verified public deploy reachable from this batch-dev session).
- Live demo URL reachability verification result: DEFERRED — placeholder used per Dev Note #5; gap documented here. Operator must replace `your-tasky-domain` with the actual deployed `DOMAIN` before publishing.
- Screenshot dimensions (width × height): N/A — DEFERRED (Task 2).
- Screenshot file size (KB): N/A — DEFERRED (Task 2).
- Browser used for screenshot: N/A — DEFERRED (Task 2).
- Number of sample tasks visible in screenshot (target: 3-5, mix of states): N/A — DEFERRED (Task 2). README references `docs/screenshot.png` per Dev Note #4 / locked skeleton even though the file does not exist yet; capturing the screenshot is a runtime artifact that requires the running stack and is deferred per the batch-dev approval.
- API endpoint table verification — divergences from skeleton (if any):
  - GET /api/tasks: matches (server.ts:14-21 — 200 OK with array of tasks).
  - POST /api/tasks: matches (server.ts:30-50 — 201 Created with created Task; 400 Bad Request on validation failure; only `description` field accepted).
  - PATCH /api/tasks/:id: matches (server.ts:57-87 — 200 OK with updated Task; 400 Bad Request; 404 Not Found). PATCH only accepts `{ "completed": boolean }` — `description` is NOT supported, so the PATCH row was kept narrow per Dev Note #9 ("do NOT document fields the API doesn't accept").
  - DELETE /api/tasks/:id: matches (server.ts:93-117 — 204 No Content with empty body via `res.status(204).end()`; 400 Bad Request on bad id; 404 Not Found on missing). Skeleton's "204 No Content, 404 Not Found" was extended to include "400 Bad Request" to faithfully reflect the id-validation branch (regex + safe-integer check at server.ts:96-106).
- Persistence verification section preservation (Story 2.6/2.7/3.2 content present?): YES — preserved verbatim from current README (lines 91-178 of pre-rewrite README), including Story 2.7's smoke-test note and `cd e2e && npm install ...` run-it-locally line. Story 3.2 chose to NOT add a Form B README mobile-verification line, so nothing extra to preserve from 3.2.
- Backup commands — POSTGRES_USER value used: `postgres` (the default Postgres superuser; docker-compose.yml does not override `POSTGRES_USER`, so the bootstrap user is `postgres` per the postgres:17-alpine image defaults).
- Optional: no-optimistic-UI bullet in Phase 0 gaps section (Story 3.4 cut at story-start? Y/N): N — Story 3.4 is still `ready-for-dev` in sprint-status.yaml at story-start, so the optional bullet is OMITTED per Dev Note #16.
- License decision in Repository section (omitted, "all rights reserved" note, or other?): "All rights reserved by default" note included per Dev Note #19 ("the dev may include OR omit the license note entirely; document the choice in Completion Notes").
- GitHub render verification URL: DEFERRED (Task 10) — local-only batch-dev session does not push to remote.
- GitHub render issues observed + fixes applied: DEFERRED (Task 10).
- Anti-pattern audit results (any violations?): NONE. No badges, no TOC, no troubleshooting/FAQ/roadmap, no emoji in headings, no HTML embeds/Mermaid/GIFs, no competitor mentions, no testimonials/CTAs, no analytics SDKs, no LICENSE/CONTRIBUTING/.github files added. Screenshot path is `docs/screenshot.png`. `db/init.sql` link present in Schema section.
- Final README line count (target: ~150-300 lines): 263 lines.
- Deferred runtime artifacts (per batch-dev approval): Task 2 (capture `docs/screenshot.png`), Task 9 (local Markdown previewer render), Task 10 (push + github.com render verification). Story is at `review` (not `done`); operator must complete deferred Tasks before marking `done`.

### File List

- README.md (rewritten — full distribution-ready version per locked skeleton; 263 lines)
- docs/screenshot.png — DEFERRED (runtime artifact, Task 2 not executed in batch-dev session; README references the path)

### Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-04-29 | 0.1 | Initial draft | Bob (Scrum Master) |
| 2026-04-30 | 0.2 | Implementation: full README rewrite per locked skeleton; runtime artifacts (screenshot, GitHub render verification) deferred per batch-dev approval | Amelia (Dev) |
