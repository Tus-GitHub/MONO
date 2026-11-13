-- Exact, case-sensitive uniqueness only while an account is active.
-- Deleted users retain historical references without reserving their old name.
CREATE UNIQUE INDEX "users_active_name_key"
ON "users" ("name" COLLATE "C")
WHERE "deletedAt" IS NULL;
