-- Legacy production schemas used the singular `admin` table name.
-- The current JPA entity and V3 notice seed use `admins`.
--
-- Run this as a Flyway callback before versioned migrations so an existing
-- schema can preserve the table and its foreign keys. MySQL updates foreign
-- key references when RENAME TABLE succeeds.
--
-- This callback is intentionally idempotent:
--   * legacy `admin` only  -> rename it to `admins`
--   * current `admins`     -> no-op
--   * both or neither      -> no-op; do not guess which table owns data

SET @legacy_admin_table_exists = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'admin'
);

SET @current_admins_table_exists = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'admins'
);

SET @admin_table_compatibility_sql = IF(
    @legacy_admin_table_exists = 1 AND @current_admins_table_exists = 0,
    'RENAME TABLE `admin` TO `admins`',
    'SELECT 1'
);

PREPARE admin_table_compatibility_statement
    FROM @admin_table_compatibility_sql;
EXECUTE admin_table_compatibility_statement;
DEALLOCATE PREPARE admin_table_compatibility_statement;