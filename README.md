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


