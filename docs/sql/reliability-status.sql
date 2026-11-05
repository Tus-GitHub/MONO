-- Read-only operational counts. Do not print endpoints, keys or notification content.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';

SELECT status, count(*) AS tasks, min("nextAttemptAt") AS oldest_scheduled_attempt,
       max(attempts) AS highest_attempt_count
FROM notification_deliveries
GROUP BY status ORDER BY status;

SELECT "lastError", count(*) AS failed_tasks
FROM notification_deliveries WHERE status = 'FAILED'
GROUP BY "lastError" ORDER BY count(*) DESC;

SELECT
  CASE WHEN "failedAt" IS NOT NULL THEN 'FAILED'
       WHEN "leaseUntil" > CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN 'PROCESSING'
       WHEN "nextAttemptAt" <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN 'DUE'
       ELSE 'WAITING' END AS state,
  count(*) AS objects,
  min("nextAttemptAt") AS oldest_scheduled_attempt
FROM storage_cleanup GROUP BY state ORDER BY state;

SELECT count(*) AS registered_browsers FROM push_subscriptions;

SELECT CASE WHEN "revokedAt" IS NOT NULL THEN 'REVOKED'
            WHEN "expiresAt" <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN 'EXPIRED'
            ELSE 'ACTIVE' END AS state, count(*) AS sessions
FROM auth_sessions GROUP BY state ORDER BY state;

SELECT count(*) AS restored_spaces FROM archive_restores;

SELECT count(*) AS inconsistent_delivery_owners
FROM notification_deliveries AS d
JOIN notifications AS n ON n.id = d."notificationId"
WHERE d."userId" <> n."userId";

COMMIT;
