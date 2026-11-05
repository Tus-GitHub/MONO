-- MONO PostgreSQL metadata and integrity audit, 2026-11-05.
-- Prepared for manual use; not executed by the source audit.
-- Run against the intended MONO database with a role permitted to read these tables.
-- All statements run inside one READ ONLY transaction. Results contain metadata and
-- aggregate counts only. Do not use this file as a migration or a performance benchmark.
-- Table names assume Prisma's current public schema mappings.

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

-- 1. Engine and session configuration. No connection strings or secrets.
SELECT
  current_setting('server_version') AS server_version,
  current_setting('TimeZone') AS session_timezone,
  current_setting('transaction_isolation') AS isolation_level,
  current_setting('transaction_read_only') AS read_only,
  current_setting('max_connections') AS server_max_connections;

-- 2. Effective role capabilities. Other grants and schema ownership need review too.
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles
WHERE rolname = current_user;

-- 3. Installed extensions. No extension is installed by this script.
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

-- 4. Table sizes, estimated live/dead rows, and maintenance timestamps.
-- Row estimates are not authoritative business counts and may be stale.
SELECT
  s.relname,
  pg_size_pretty(pg_total_relation_size(s.relid)) AS total_size,
  s.n_live_tup AS estimated_live_rows,
  s.n_dead_tup AS estimated_dead_rows,
  s.last_autovacuum,
  s.last_autoanalyze
FROM pg_stat_user_tables AS s
WHERE s.schemaname = 'public'
ORDER BY pg_total_relation_size(s.relid) DESC, s.relname;

-- 5. Actual column types for fields whose date/time and money semantics need review.
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'couples', 'dates', 'date_activities', 'date_reviews',
    'date_review_ratings', 'date_reminders', 'expenses', 'memories'
  )
  AND (
    data_type LIKE 'timestamp%'
    OR data_type IN ('date', 'time without time zone', 'time with time zone')
    OR column_name IN ('score', 'overallRating', 'amountCents', 'ownerShareCents')
  )
ORDER BY table_name, ordinal_position;

-- 6. Declared constraints and existing indexes, including custom SQL migrations.
SELECT
  t.relname AS table_name,
  c.conname AS constraint_name,
  c.contype AS constraint_type,
  c.convalidated AS validated,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint AS c
JOIN pg_class AS t ON t.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
ORDER BY t.relname, c.contype, c.conname;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. RLS state. Enabled policies alone do not prove runtime enforcement.
SELECT
  c.relname AS table_name,
  pg_get_userbyid(c.relowner) AS table_owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8. Current database connection states; no query text or client identifiers.
SELECT state, wait_event_type, count(*) AS connection_count
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, wait_event_type
ORDER BY state NULLS LAST, wait_event_type NULLS LAST;

-- 9. Row-local invariants. Counts do not reveal the affected record contents.
SELECT 'rating_out_of_range' AS issue, count(*) AS affected_rows
FROM date_review_ratings WHERE score NOT BETWEEN 1 AND 10
UNION ALL
SELECT 'overall_out_of_range', count(*)
FROM date_reviews WHERE "overallRating" NOT BETWEEN 1 AND 10
UNION ALL
SELECT 'submitted_without_overall', count(*)
FROM date_reviews WHERE "submittedAt" IS NOT NULL AND "overallRating" IS NULL
UNION ALL
SELECT 'negative_expense', count(*)
FROM expenses WHERE "amountCents" < 0
UNION ALL
SELECT 'invalid_custom_split', count(*)
FROM expenses
WHERE "paidBy" = 'CUSTOM'
  AND ("ownerShareCents" IS NULL OR "ownerShareCents" < 0 OR "ownerShareCents" > "amountCents")
UNION ALL
SELECT 'inverted_budget_range', count(*)
FROM dates WHERE "expectedBudgetMinCents" > "expectedBudgetMaxCents"
UNION ALL
SELECT 'invalid_coordinates', count(*)
FROM places
WHERE latitude NOT BETWEEN -90 AND 90
   OR longitude NOT BETWEEN -180 AND 180
   OR (latitude IS NULL) <> (longitude IS NULL);

-- 10. Active membership invariants. Archived membership rows are excluded here.
SELECT 'spaces_over_two_active_members' AS issue, count(*) AS affected_groups
FROM (
  SELECT m."coupleId"
  FROM couple_members AS m
  JOIN couples AS c ON c.id = m."coupleId"
  WHERE m.status = 'ACTIVE' AND c."deletedAt" IS NULL AND c.status IN ('PENDING', 'ACTIVE')
  GROUP BY m."coupleId" HAVING count(*) > 2
) AS invalid_spaces
UNION ALL
SELECT 'users_in_multiple_active_spaces', count(*)
FROM (
  SELECT m."userId"
  FROM couple_members AS m
  JOIN couples AS c ON c.id = m."coupleId"
  WHERE m.status = 'ACTIVE' AND c."deletedAt" IS NULL AND c.status IN ('PENDING', 'ACTIVE')
  GROUP BY m."userId" HAVING count(*) > 1
) AS invalid_memberships
UNION ALL
SELECT 'duplicate_active_roles_in_space', count(*)
FROM (
  SELECT "coupleId", role
  FROM couple_members WHERE status = 'ACTIVE'
  GROUP BY "coupleId", role HAVING count(*) > 1
) AS invalid_roles;

-- 11. References that exist but belong to different parent scopes.
SELECT 'expense_date_couple_mismatch' AS issue, count(*) AS affected_rows
FROM expenses AS e JOIN dates AS d ON d.id = e."dateId"
WHERE e."coupleId" <> d."coupleId"
UNION ALL
SELECT 'memory_date_couple_mismatch', count(*)
FROM memories AS m JOIN dates AS d ON d.id = m."dateId"
WHERE m."coupleId" <> d."coupleId"
UNION ALL
SELECT 'planned_place_couple_mismatch', count(*)
FROM dates AS d JOIN places AS p ON p.id = d."plannedPlaceId"
WHERE d."coupleId" <> p."coupleId"
UNION ALL
SELECT 'actual_place_couple_mismatch', count(*)
FROM dates AS d JOIN places AS p ON p.id = d."actualPlaceId"
WHERE d."coupleId" <> p."coupleId"
UNION ALL
SELECT 'activity_place_couple_mismatch', count(*)
FROM date_activities AS a
JOIN dates AS d ON d.id = a."dateId"
JOIN places AS p ON p.id = a."placeId"
WHERE d."coupleId" <> p."coupleId"
UNION ALL
SELECT 'review_category_couple_mismatch', count(*)
FROM date_review_ratings AS rr
JOIN date_reviews AS r ON r.id = rr."reviewId"
JOIN dates AS d ON d.id = r."dateId"
JOIN review_categories AS rc ON rc.id = rr."categoryId"
WHERE d."coupleId" <> rc."coupleId"
UNION ALL
SELECT 'best_photo_wrong_date', count(*)
FROM dates AS d JOIN date_photos AS p ON p.id = d."bestPhotoId"
WHERE p."dateId" <> d.id;

-- 12. Currency diversity, without combining unlike amounts.
SELECT currency, count(*) AS active_expense_rows
FROM expenses WHERE "deletedAt" IS NULL
GROUP BY currency ORDER BY currency;

SELECT count(*) AS dates_with_multiple_expense_currencies
FROM (
  SELECT "dateId" FROM expenses
  WHERE "deletedAt" IS NULL AND "dateId" IS NOT NULL
  GROUP BY "dateId" HAVING count(DISTINCT currency) > 1
) AS mixed_dates;

-- 13. Pending reminders. This describes raw backlog, not eligibility or push success.
-- Reminder scheduledFor currently represents a UTC instant in timestamp without timezone.
SELECT
  count(*) AS pending_rows,
  count(*) FILTER (WHERE "scheduledFor" <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS due_rows,
  count(*) FILTER (
    WHERE "scheduledFor" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '2 days'
  ) AS stale_due_rows,
  min("scheduledFor") AS earliest_pending_at
FROM date_reminders
WHERE "sentAt" IS NULL AND "dismissedAt" IS NULL;

-- 14. Optional extension-specific performance work should follow separately.
-- If pg_stat_statements is enabled, inspect aggregated timings without exporting query
-- text or parameter values. Use EXPLAIN only on explicitly selected representative reads.
-- Migration history and provider backup/restore settings also need a separate review.

COMMIT;
