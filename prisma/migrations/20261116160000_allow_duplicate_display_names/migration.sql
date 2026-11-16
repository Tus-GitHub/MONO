-- Display names may be shared. Email/emailLookup uniqueness remains unchanged.
DROP INDEX IF EXISTS "users_active_name_key";
DROP INDEX IF EXISTS "users_active_nameLookup_key";
