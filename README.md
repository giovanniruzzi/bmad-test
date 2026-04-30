# Tasky

A deliberately minimal, self-hosted todo app.

Repository: https://github.com/giovanniruzzi/bmad-test

## Schema

Phase 0 ships a single `tasks` table. The schema is bootstrapped by Postgres on first volume initialization from [`db/init.sql`](db/init.sql) (mounted into the container's `/docker-entrypoint-initdb.d/`); no migration framework is used. Backup and restore is plain `pg_dump` / `psql -f init.sql`.

| Column        | Type           | Nullability | Default              | Purpose                                                                                            |
| ------------- | -------------- | ----------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `id`          | `BIGSERIAL`    | NOT NULL    | sequence (auto)      | Primary key. 64-bit auto-incrementing integer; safe in JSON `number` (≤ 2^53).                     |
| `description` | `TEXT`         | NOT NULL    | —                    | Task text. `CHECK` enforces length 1–500 (defense-in-depth alongside API validation).              |
| `completed`   | `BOOLEAN`      | NOT NULL    | `FALSE`              | Whether the task is done.                                                                          |
| `created_at`  | `TIMESTAMPTZ`  | NOT NULL    | `NOW()`              | Creation timestamp (UTC at storage; serialized as ISO-8601 UTC by the API).                        |
| `owner_id`    | `BIGINT`       | NULL        | —                    | Reserved for Phase 1 multi-user auth. Always `NULL` in Phase 0; **omitted from API JSON output**.  |

Canonical DDL is defined in [`db/init.sql`](db/init.sql).

## API

The API is mounted at the same origin under the `/api/` prefix (PRD FR19) and proxied to the Node container by Caddy in the deployed stack. All endpoints respond with JSON; collections are bare arrays (not envelopes), errors are `{ "error": "<message>" }`, and dates are ISO-8601 UTC strings.

| Method | Path         | Body                       | Returns                | Status |
| ------ | ------------ | -------------------------- | ---------------------- | ------ |
| GET    | `/api/tasks` | —                          | Array of `Task` objects | 200    |
| POST   | `/api/tasks` | `{ "description": string }` | The created `Task`      | 201    |

Example response (empty list):

```json
[]
```

Example response (one task):

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

Example POST request:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"description":"Buy milk"}' \
  https://<domain>/api/tasks
```

Example POST response (HTTP 201):

```json
{
  "id": 1,
  "description": "Buy milk",
  "completed": false,
  "createdAt": "2026-04-29T10:00:00.000Z"
}
```

Validation errors return HTTP 400 with `{ "error": "<message>" }`. Validation rules: `description` must be a string with length 1–500 characters.

> The full endpoint table (POST, PATCH, DELETE) is added by Story 3.3 (Distribution-ready README). This stub satisfies FR20.

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

## Persistence verification

The single trust test that matters for Phase 0 is durability: tasks survive every operational restart. The PRD codifies this as NFR6 — the explicit `add task → docker compose down && up → task still present` test. The five scenarios below are the manual verification sequence; running them end-to-end is a prerequisite to declaring Phase 0 complete. Any self-hoster can reproduce them.

### Scenario 1: Browser refresh

**Covers:** FR8, FR11

**Steps:**
1. Open the deployed URL in a browser.
2. Create a task with description `persistence-test-1`.
3. Verify the task appears in the list.
4. Press F5 (or Cmd-R / browser refresh).
5. Verify the task is still present.

**Expected:** the task `persistence-test-1` is present after the refresh, with the same `id` and `createdAt`.

### Scenario 2: Browser close and reopen

**Covers:** FR8

**Steps:**
1. Open the deployed URL in a browser.
2. Create a task with description `persistence-test-2`.
3. Close the browser entirely (Cmd-Q on macOS, File → Exit on Windows/Linux — closing only the tab is identical to Scenario 1).
4. Reopen the browser and navigate back to the URL.
5. Verify the task is still present.

**Expected:** the task `persistence-test-2` is present after browser reopen, with the same `id` and `createdAt`.

**Notes:** if the browser is configured to clear cookies/storage on exit, this still passes — the task lives on the server, not in browser storage.

### Scenario 3: `docker compose restart`

**Covers:** FR9

**Steps:**
1. With the stack running on the host, create a task via the UI with description `persistence-test-3`.
2. On the host shell, run `docker compose restart` from the project root.
3. Wait until all three services report `Up` in `docker compose ps` (typically 5–15 seconds).
4. Refresh the browser tab.
5. Verify the task is still present.

**Expected:** task `persistence-test-3` is present after the services come back up.

**Notes:** `docker compose restart` does not remove containers; the volume mount is untouched. This is the lowest-risk restart and primarily verifies that no in-process state was lost.

### Scenario 4: `docker compose down && docker compose up -d` — the PRD-mandated test (NFR6)

**Covers:** NFR6

**Steps:**
1. With the stack running on the host, create a task via the UI with description `persistence-test-4`.
2. On the host shell, run `docker compose down` (this stops and removes containers but preserves the named volume `tasky_pgdata`).
3. Verify the containers are removed: `docker compose ps` shows no services.
4. Verify the volume still exists: `docker volume ls | grep tasky_pgdata` shows one matching line.
5. Run `docker compose up -d`.
6. Wait for all three services to report `Up`.
7. Refresh the browser.
8. Verify the task is still present.

**Expected:** task `persistence-test-4` is present after the down/up cycle.

**Notes:** if step 4 (volume survival) fails, the schema is re-bootstrapped from `db/init.sql` (no rows) and the test fails. This scenario also implicitly validates that the api retries connecting to the db on startup until it is ready.

### Scenario 5: Host VPS reboot

**Covers:** FR10, FR34, NFR7

**Steps:**
1. On the deployed VPS, with the stack running, create a task via the UI with description `persistence-test-5`.
2. On the VPS shell, run `sudo reboot` (or trigger a reboot via the cloud provider's console).
3. Wait for the VPS to come back online (typically 30–90 seconds).
4. Wait an additional 15–30 seconds for `dockerd` to start and the `restart: unless-stopped` policy to bring the stack back up.
5. Navigate to the deployed URL in the browser.
6. Verify the task is still present.

**Expected:** task `persistence-test-5` is present after the VPS reboot.

**Notes:** this scenario verifies (a) the persistent volume survives host reboot, (b) Docker's `restart: unless-stopped` policy automatically restarts the stack on host boot, (c) Caddy's auto-TLS cache survives reboot.

---

Cleanup: delete the five test tasks via the UI's Delete button when verification is complete.

Scenario 1 (browser refresh) is automated by the Playwright smoke test in [`e2e/`](e2e/) — see Story 2.7.

Run it locally: `cd e2e && npm install && npm run install:browsers && npm test` (set `TASKY_BASE_URL` to override the default `http://localhost`).


