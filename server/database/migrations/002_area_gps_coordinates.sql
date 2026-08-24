/**
 * @file 002_area_gps_coordinates.sql
 * @description Adds real GPS coordinates to areas.
 *
 * Why: `map_coordinates` holds {top,left} percentages used to place a pin on
 * the campus map image. Those are not geographic coordinates, so turn-by-turn
 * navigation had nothing real to route to. These columns hold the actual
 * latitude/longitude of the room's entrance.
 *
 * Safe to run more than once.
 *
 * Usage (Docker):
 *   docker compose exec -T mysqldb mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
 *     shade_system_test < server/database/migrations/002_area_gps_coordinates.sql
 */

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

CALL add_column_if_missing('areas', 'latitude',  'DOUBLE DEFAULT NULL');
CALL add_column_if_missing('areas', 'longitude', 'DOUBLE DEFAULT NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;

SELECT 'Migration 002 applied successfully.' AS status;
