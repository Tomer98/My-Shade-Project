DROP DATABASE IF EXISTS shade_system_test;
CREATE DATABASE shade_system_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shade_system_test;

-- 1. טבלת משתמשים
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password, email, role) VALUES 
('Alice', 'password123', 'alice@campus.edu', 'admin'),
('Bob', 'password123', 'bob@campus.edu', 'maintenance'),
('Dana', 'password123', 'dana@campus.edu', 'planner'),
('Tom', 'password123', 'bareltom33@gmail.com', 'admin');

-- 2. טבלת אזורים (הוספתי לכאן את העמודות החסרות!)
CREATE TABLE areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    building_number INT,
    floor INT,
    room VARCHAR(255),
    room_number VARCHAR(50),
    description TEXT,
    
    -- === העמודות החדשות שהיו חסרות ===
    map_file_path VARCHAR(255) DEFAULT NULL, -- נתיב לתמונה
    sensor_position JSON DEFAULT NULL,       -- מיקומי חיישנים
    -- ================================

    map_coordinates JSON,
    shade_state VARCHAR(50) DEFAULT 'AUTO',
    current_position INT DEFAULT 0,
    last_manual_change DATETIME DEFAULT NULL,
    
    -- Real-Time Sensor & Simulation Cache
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

-- 3. טבלת לוגים רגילה
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

INSERT INTO logs (area_id, temperature, light_intensity, current_position, recorded_at) VALUES 
(1, 22.5, 80, 0, NOW() - INTERVAL 1 HOUR),
(1, 24.5, 90, 20, NOW() - INTERVAL 30 MINUTE);

-- 4. טבלת לוגים מדעיים
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
    score FLOAT DEFAULT 0,  -- הוספתי את זה כדי למנוע צורך בתיקון עתידי
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. תזמונים (Schedules)
CREATE TABLE schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT,
    execution_time VARCHAR(10) NOT NULL, 
    action_type VARCHAR(50), 
    target_position INT DEFAULT 0, 
    is_active BOOLEAN DEFAULT TRUE,
    days VARCHAR(255) DEFAULT 'all',
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);

-- 6. התראות (Alerts)
CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT,
    created_by INT,          
    assigned_to INT,         
    description TEXT,        
    priority VARCHAR(20) DEFAULT 'Medium',
    status VARCHAR(20) DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);