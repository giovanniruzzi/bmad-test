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


