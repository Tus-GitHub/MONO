BEGIN;
-- Stateless cookies are retired by device sessions. Old push capabilities cannot be
-- attributed to a live session; existing settings re-register the current browser safely.
DELETE FROM "push_subscriptions" WHERE "authSessionId" IS NULL;
COMMIT;
