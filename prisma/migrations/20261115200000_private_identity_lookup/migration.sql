ALTER TABLE users ADD COLUMN "emailLookup" TEXT, ADD COLUMN "nameLookup" TEXT;
CREATE UNIQUE INDEX "users_emailLookup_key" ON users("emailLookup");
CREATE UNIQUE INDEX "users_active_nameLookup_key" ON users("nameLookup") WHERE "deletedAt" IS NULL;
ALTER TABLE admin_access ADD COLUMN "aliasLookup" TEXT;
CREATE UNIQUE INDEX "admin_access_aliasLookup_key" ON admin_access("aliasLookup");
ALTER TABLE email_verification_tokens ADD COLUMN "emailLookup" TEXT;
