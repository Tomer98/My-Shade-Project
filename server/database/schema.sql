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
    -- Assignment attributes: what a worker is qualified for, where they operate,
    -- and whether they are currently taking work.
    speciality VARCHAR(255) DEFAULT NULL,
    work_area VARCHAR(255) DEFAULT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reset_token VARCHAR(255) NULL,
    reset_token_expires DATETIME NULL
);


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
    -- Pin placement on the campus map image, as {top,left} percentages
    map_coordinates JSON,
    -- Real-world position of the room, used for turn-by-turn navigation
    latitude DOUBLE DEFAULT NULL,
    longitude DOUBLE DEFAULT NULL,
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

-- ==========================================
-- 7. 🧰 MAINTENANCE MISSIONS
-- Recurring maintenance jobs performed at an area by a maintenance worker.
-- A completed mission stays in the table as location history and spawns
-- the next occurrence based on frequency_days.
-- ==========================================
CREATE TABLE missions (
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

-- Checklist items belonging to a mission. A worker marks each Done or Failed;
-- a Failed item carries the explanation comment and optional photo evidence.
CREATE TABLE mission_subtasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mission_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    status ENUM('Pending', 'Done', 'Failed') DEFAULT 'Pending',
    comment TEXT,
    photo_path VARCHAR(500) DEFAULT NULL,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

-- ==========================================
-- 8. 📚 KNOWLEDGE BASE (GUIDES)
-- Workers author guides; a manager/admin approves before they become visible
-- to everyone. Guides are ordered by average rating.
-- ==========================================
CREATE TABLE guides (
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

-- One rating per user per guide; re-rating updates the existing row.
CREATE TABLE guide_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guide_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_guide_user (guide_id, user_id),
    FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);