-- Migration: Enforce Three Roles Only (Admin, Distributor, Customer Care)
-- Step 1: Add CUSTOMER_CARE to UserRole enum if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'CUSTOMER_CARE'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER_CARE';
  END IF;
END
$$;

-- Step 2: Ensure the three canonical roles exist in the roles table
INSERT INTO "roles" ("id", "name", "description", "permissions", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'ADMIN', 'Admin', '{"all": true, "root": true, "manage_products": true, "manage_users": true}', NOW(), NOW())
ON CONFLICT ("name") DO UPDATE 
SET "description" = 'Admin', "updatedAt" = NOW();

INSERT INTO "roles" ("id", "name", "description", "permissions", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'DISTRIBUTOR', 'Distributor', '{"portal": true, "businessCenter": true, "wallet": true}', NOW(), NOW())
ON CONFLICT ("name") DO UPDATE 
SET "description" = 'Distributor', "updatedAt" = NOW();

INSERT INTO "roles" ("id", "name", "description", "permissions", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'CUSTOMER_CARE', 'Customer Care', '{"tickets": true, "viewMembers": true, "support": true}', NOW(), NOW())
ON CONFLICT ("name") DO UPDATE 
SET "description" = 'Customer Care', "updatedAt" = NOW();

-- Step 3: Reassign any users whose roleId or roleName belonged to deprecated roles
-- A. SUPER_ADMIN -> ADMIN
UPDATE "users"
SET 
  "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN' LIMIT 1),
  "roleName" = 'ADMIN'
WHERE "roleName"::text = 'SUPER_ADMIN' OR "roleId" IN (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN');

-- B. SUPPORT -> CUSTOMER_CARE
UPDATE "users"
SET 
  "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'CUSTOMER_CARE' LIMIT 1),
  "roleName" = 'CUSTOMER_CARE'
WHERE "roleName"::text = 'SUPPORT' OR "roleId" IN (SELECT "id" FROM "roles" WHERE "name" = 'SUPPORT');

-- C. CUSTOMER (or anything else) -> DISTRIBUTOR
UPDATE "users"
SET 
  "roleId" = (SELECT "id" FROM "roles" WHERE "name" = 'DISTRIBUTOR' LIMIT 1),
  "roleName" = 'DISTRIBUTOR'
WHERE "roleName"::text = 'CUSTOMER' OR "roleId" IN (SELECT "id" FROM "roles" WHERE "name" = 'CUSTOMER');

-- Step 4: Delete all other roles from the roles table
DELETE FROM "roles" 
WHERE "name" NOT IN ('ADMIN', 'DISTRIBUTOR', 'CUSTOMER_CARE');
