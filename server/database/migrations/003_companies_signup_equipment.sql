/**
 * @file 003_companies_signup_equipment.sql
 * @description Adds the remaining entities from the specification:
 *   - companies      : the system supervises several companies (multi-tenancy)
 *   - user approval  : workers register themselves and an admin approves them
 *   - work_areas     : the specification models these as their own entity
 *   - equipment      : the Products / Product_Locations part of the ERD
 *
 * Existing rows are migrated into a single default company so nothing breaks.
 * Safe to run more than once.
 *
 * Usage (Docker):
 *   docker compose exec -T mysqldb mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
 *     shade_system_test < server/database/migrations/003_companies_signup_equipment.sql
 */

-- ==========================================
-- 1. Companies
-- ==========================================
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The tenant every pre-existing row is adopted into
INSERT INTO companies (id, name)
SELECT 1, 'HIT - Holon Institute of Technology'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE id = 1);

-- ==========================================
-- 2. Work areas (a named zone within a company)
-- ==========================================
CREATE TABLE IF NOT EXISTS work_areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company_id INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_area_per_company (company_id, name),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. Equipment (the ERD's Products + Product_Locations)
-- Serviceable items that live in a room and can be the subject of a mission.
-- ==========================================
CREATE TABLE IF NOT EXISTS equipment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    serial_number VARCHAR(255) DEFAULT NULL,
    equipment_type VARCHAR(100) DEFAULT NULL,
    area_id INT NULL,
    company_id INT NOT NULL DEFAULT 1,
    status ENUM('Operational', 'NeedsService', 'OutOfOrder') DEFAULT 'Operational',
    installed_at DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- ==========================================
-- 4. Column additions, each guarded so the file can be re-run
-- ==========================================
DROP PROCEDURE IF EXISTS add_column_if_missing;

DELIMITER //
CREATE PROCEDURE add_column_if_missing(
    IN tbl VARCHAR(64),
    IN col VARCHAR(64),
    IN definition VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- Tenancy
CALL add_column_if_missing('users', 'company_id', 'INT NOT NULL DEFAULT 1');
CALL add_column_if_missing('areas', 'company_id', 'INT NOT NULL DEFAULT 1');

-- Self-registration: a new account waits for an administrator's approval
CALL add_column_if_missing(
    'users', 'status',
    "ENUM('Pending', 'Active', 'Rejected') NOT NULL DEFAULT 'Active'"
);

-- Missions may target a specific piece of equipment rather than the whole room
CALL add_column_if_missing('missions', 'equipment_id', 'INT NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- Everyone who already existed was created by an admin, so they stay Active.
UPDATE users SET status = 'Active' WHERE status IS NULL;

-- ==========================================
-- 5. Seed the work areas already typed as free text on users
-- ==========================================
INSERT IGNORE INTO work_areas (name, company_id)
SELECT DISTINCT work_area, 1 FROM users
WHERE work_area IS NOT NULL AND work_area <> '';

SELECT 'Migration 003 applied successfully.' AS status;
