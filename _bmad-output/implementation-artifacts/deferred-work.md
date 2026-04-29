# Deferred Work

## Deferred from: code review of 1-3-minimal-api-with-get-api-tasks-returning-empty-list (2026-04-29)

- `id` typed as `string` in Task interface, but pg returns `number` for non-bigint integer types; works here because column is BIGSERIAL but the type contract is fragile [api/src/db.ts:14] — pre-existing in locked skeleton
- `created_at.toISOString()` assumes pg returns a JS Date; pg parses TIMESTAMPTZ to Date by default but this is configurable and not asserted [api/src/db.ts:31] — pre-existing in locked skeleton
- `waitForDb` sleeps 1s after the final failed attempt before throwing, adding unnecessary latency to crash [api/src/db.ts:38-50] — pre-existing in locked skeleton
- Error middleware leaks `err.message` to the client for non-500 statuses; OK for Phase 0 internal API but worth noting [api/src/server.ts:21-26] — pre-existing in locked skeleton
- BIGSERIAL `id` exceeds JS `Number.MAX_SAFE_INTEGER` (2^53) — pg will return precision-losing numbers past that point. Phase 0 row counts make this academic [db/init.sql] — pre-existing schema decision from Story 1.2
