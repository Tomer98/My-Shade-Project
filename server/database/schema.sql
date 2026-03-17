/**
 * @file schema.sql
 * @description Smart Shade Automation System - Database Definition.
 * @version 1.3 (Synced with Controller naming conventions)
 */

-- Reset Database
DROP DATABASE IF EXISTS shade_system_test;
CREATE DATABASE shade_system_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shade_system_test;

-- ==========================================
-- 1. 👥 USERS TABLE
-- ==========================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role ENUM('admin', 'maintenance', 'planner') DEFAULT 'planner',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reset_token VARCHAR(255) NULL,
    reset_token_expires DATETIME NULL
);

INSERT INTO users (username, password, email, role) VALUES 
('Alice', 'password123', 'alice@campus.edu', 'admin'),
('Bob', 'password123', 'bob@campus.edu', 'maintenance'),
('Dana', 'password123', 'dana@campus.edu', 'planner'),
('Tom', 'password123', 'bareltom33@gmail.com', 'admin');

-- ==========================================
-- 2. 🏢 AREAS (ROOMS) TABLE
-- ==========================================
CREATE TABLE areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    building_number INT,
    floor INT,
    room VARCHAR(255),
    room_number VARCHAR(50),
    description TEXT,
    map_file_path VARCHAR(255) DEFAULT NULL,
    sensor_position JSON DEFAULT NULL,
    map_coordinates JSON,
    shade_state ENUM('AUTO', 'MANUAL', 'OPEN', 'CLOSED') DEFAULT 'AUTO',
    current_position INT DEFAULT 0,
    last_manual_change DATETIME DEFAULT NULL,
    weather_condition VARCHAR(50) DEFAULT 'Clear',
    last_temperature FLOAT DEFAULT 0,
    last_light_intensity FLOAT DEFAULT 0,
    is_simulation BOOLEAN DEFAULT FALSE,
    sim_temp FLOAT DEFAULT 25.0,
    sim_light FLOAT DEFAULT 500.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO areas (building_number, floor, room, description, map_coordinates) VALUES 
(5, 2, 'Classroom 216', 'Sunny Side', '{"top": 40, "left": 20}'),
(6, 1, 'Auditorium', 'Main Hall', '{"top": 60, "left": 50}');

-- ==========================================
-- 3. 📝 ACTIVITY LOGS
-- ==========================================
CREATE TABLE logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT,
    temperature FLOAT DEFAULT 0,
    light_intensity FLOAT DEFAULT 0,
    current_position INT DEFAULT 0,
    action_type VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);

-- ==========================================
-- 4. 🧪 WEATHER & AI LOGS
-- ==========================================
CREATE TABLE weather_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    temp FLOAT,
    light_level FLOAT,
    condition_text VARCHAR(50), 
    weather_condition VARCHAR(50) DEFAULT 'Clear',
    clouds FLOAT DEFAULT 0,
    precipitation FLOAT DEFAULT 0,
    decision VARCHAR(50),       
    reason VARCHAR(255),
    score FLOAT DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 5. ⏰ AUTOMATION SCHEDULES
-- @sync Synchronized with SchedulerPanel.jsx ('CLOSE' instead of 'CLOSED')
-- ==========================================
CREATE TABLE schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT,
    execution_time VARCHAR(10) NOT NULL, 
    action_type ENUM('OPEN', 'CLOSE', 'AUTO') DEFAULT 'AUTO', 
    target_position INT DEFAULT 0, 
    is_active BOOLEAN DEFAULT TRUE,
    days VARCHAR(255) DEFAULT 'all',
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);

-- ==========================================
-- 6. ⚠️ MAINTENANCE ALERTS
-- @sync Synchronized with alertController.js ('Acknowledged' instead of 'In Progress')
-- ==========================================
CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT,
    created_by INT,           
    assigned_to INT,          
    description TEXT,         
    priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
    status ENUM('Open', 'Acknowledged', 'Resolved', 'Closed') DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);