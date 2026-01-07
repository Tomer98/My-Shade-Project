-- איפוס מלא ובנייה מחדש (באנגלית)
DROP DATABASE IF EXISTS shade_system_test;
CREATE DATABASE shade_system_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shade_system_test;

-- ==========================================
-- 1. טבלת משתמשים (Users)
-- ==========================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password, email, role) VALUES 
('admin', '123456', 'admin@test.com', 'admin'),
('alice', '123456', 'alice@campus.edu', 'admin');

-- ==========================================
-- 2. טבלת אזורים (Areas) - מתורגם לאנגלית
-- ==========================================
CREATE TABLE areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    building_number INT,
    floor INT,
    room VARCHAR(255),         -- Room Name
    room_number VARCHAR(50),
    location_note VARCHAR(255),
    description TEXT,
    
    -- עמודות חדשות
    map_file_path VARCHAR(255) DEFAULT NULL,
    map_coordinates JSON,
    sensor_position JSON,
    shade_state VARCHAR(50) DEFAULT 'AUTO',
    current_position INT DEFAULT 0,
    last_manual_change DATETIME DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- נתונים באנגלית
INSERT INTO areas (building_number, floor, room, description, map_coordinates, sensor_position, shade_state) VALUES 
(5, 2, 'Classroom 206', 'Building 5 - Study Room', '{"top": 40, "left": 20}', '[]', 'AUTO'),
(6, 1, 'Auditorium', '6 - Main Auditorium', '{"top": 60, "left": 50}', '[]', 'CLOSED'),
(8, 3, 'Room 101', 'Building 8 - Offices', '{"top": 30, "left": 70}', '[]', 'AUTO');

-- ==========================================
-- 3. טבלת לוגים (Logs)
-- ==========================================
CREATE TABLE logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT,
    temperature FLOAT DEFAULT 0,
    light_intensity FLOAT DEFAULT 0,
    current_position INT DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);

-- נתונים ראשוניים לגרף
INSERT INTO logs (area_id, temperature, light_intensity, current_position, recorded_at) VALUES 
(1, 22.5, 80, 0, NOW() - INTERVAL 1 HOUR),
(1, 23.0, 85, 0, NOW() - INTERVAL 45 MINUTE),
(1, 24.5, 90, 20, NOW() - INTERVAL 30 MINUTE),
(1, 25.0, 60, 50, NOW() - INTERVAL 15 MINUTE),
(1, 24.0, 40, 0, NOW());

-- ==========================================
-- 4. תזמונים (Schedules)
-- ==========================================
CREATE TABLE schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT,
    execution_time VARCHAR(10) NOT NULL, 
    action VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    days VARCHAR(255) DEFAULT 'all',
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);

-- ==========================================
-- 5. התראות (Alerts)
-- ==========================================
CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT,
    message TEXT,
    severity VARCHAR(20) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
);