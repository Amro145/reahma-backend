-- =============================================================
-- RAHMA Platform — Database Seed / Initialization Script
-- Run this ONCE against your D1 database before registration
-- to prevent Foreign Key constraint failures.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Add `role` column to `user` table if it doesn't exist yet.
--    (Safe to run on existing databases — ALTER TABLE is idempotent
--     only when guarded by the column-existence check below.)
-- ---------------------------------------------------------------
-- SQLite does not support IF NOT EXISTS for ALTER TABLE columns.
-- Run this statement manually ONLY if the column is missing:
--
--   ALTER TABLE "user" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'student';
--
-- If you are deploying a fresh database, this column is already
-- declared in schema.ts and will be created by drizzle-kit push.

-- ---------------------------------------------------------------
-- 2. Ensure the default HQ organization exists.
--    Uses INSERT OR IGNORE so re-running this script is safe.
-- ---------------------------------------------------------------
INSERT OR IGNORE INTO "organization" (
    "id",
    "name",
    "slug",
    "logo",
    "createdAt",
    "metadata"
) VALUES (
    'org_hq_001',
    'رحمة — المقر الرئيسي',
    'org-hq-001',
    NULL,
    strftime('%s', 'now'),  -- Unix timestamp in seconds
    '{"type":"headquarters","country":"SA"}'
);

-- ---------------------------------------------------------------
-- 3. (Optional) Promote an existing user to admin.
--    Replace <admin-user-id> with the real Better Auth user ID.
-- ---------------------------------------------------------------
-- UPDATE "user"
--   SET "role" = 'admin'
-- WHERE "id" = '<admin-user-id>';

-- ---------------------------------------------------------------
-- 4. (Optional) Add an admin as owner member of the HQ org.
--    Replace <admin-user-id> and <member-id> with real values.
-- ---------------------------------------------------------------
-- INSERT OR IGNORE INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
-- VALUES (
--     '<member-id>',      -- generate a UUID, e.g.  lower(hex(randomblob(16)))
--     'org_hq_001',
--     '<admin-user-id>',
--     'owner',
--     strftime('%s', 'now')
-- );

-- =============================================================
-- HOW TO RUN AGAINST CLOUDFLARE D1
-- =============================================================
-- Local (dev):
--   npx wrangler d1 execute rahma_db --local --file=migrations/seed.sql
--
-- Production:
--   npx wrangler d1 execute rahma_db --file=migrations/seed.sql
-- =============================================================
