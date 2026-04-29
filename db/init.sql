-- Tasky Phase 0 schema — bootstrapped by Postgres on first volume init.
-- Consumed by docker-compose.yml (Story 1.5) via mount to
-- /docker-entrypoint-initdb.d/init.sql on the `db` service.
-- Human-readable column docs live in README.md → ## Schema; the two MUST
-- stay in sync (any change here requires the matching README edit in the
-- same commit).

CREATE TABLE IF NOT EXISTS tasks (
  id          BIGSERIAL PRIMARY KEY,
  description TEXT NOT NULL CHECK (length(description) > 0 AND length(description) <= 500),
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id    BIGINT NULL  -- Reserved for Phase 1 auth (PRD FR13). Always NULL in Phase 0.
);
