/**
 * @file 001_missions_and_guides.sql
 * @description Upgrades an EXISTING database to add maintenance missions,
 *              the knowledge base, and the user assignment attributes.
 *
 * Why this exists: schema.sql only runs when MySQL initialises a brand-new
 * data volume. An existing deployment never sees it, so these changes have to
 * be applied separately.
 *
 * Safe to run more than once — every step checks before it acts, and no
 * existing data is dropped.
 *
 * Usage (Docker):
 *   docker compose exec -T mysqldb mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
 *     shade_system_dev < server/database/migrations/001_missions_and_guides.sql
 */

-- ==========================================
-- 1. New tables (IF NOT EXISTS makes these naturally idempotent)
-- ==========================================

CREATE TABLE IF NOT EXISTS missions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    frequency_days INT DEFAULT 30,
    scheduled_date DATE NOT NULL,
    assigned_to INT NULL,
    status ENUM('Open', 'InProgress', 'Completed', 'Failed') DEFAULT 'Open',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mission_subtasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mission_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    status ENUM('Pending', 'Done', 'Failed') DEFAULT 'Pending',
    comment TEXT,
    photo_path VARCHAR(500) DEFAULT NULL,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    media_path VARCHAR(500) DEFAULT NULL,
    author_id INT NULL,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS guide_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guide_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_guide_user (guide_id, user_id),
    FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- 2. New user columns
-- MySQL has no "ADD COLUMN IF NOT EXISTS", so each add is guarded by an
-- information_schema lookup and executed as a prepared statement.
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
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = tbl
          AND COLUMN_NAME = col
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL add_column_if_missing('users', 'speciality',   'VARCHAR(255) DEFAULT NULL');
CALL add_column_if_missing('users', 'work_area',    'VARCHAR(255) DEFAULT NULL');
CALL add_column_if_missing('users', 'is_available', 'BOOLEAN DEFAULT TRUE');

-- Older deployments may also predate the password-reset columns
CALL add_column_if_missing('users', 'reset_token',         'VARCHAR(255) NULL');
CALL add_column_if_missing('users', 'reset_token_expires', 'DATETIME NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- ==========================================
-- 3. Confirmation
-- ==========================================
SELECT 'Migration 001 applied successfully.' AS status;
