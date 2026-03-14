/**
 * Area Controller
 * Manages physical areas (rooms), including map coordinates, sensor positions,
 * manual shade overrides, and real-time simulation parameters.
 */
const db = require('../config/db');

// Base URL for image paths
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

/**
 * Get all areas with parsed JSON coordinates and sensor data.
 */
exports.getAllAreas = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT *, room as name FROM areas');
        const areas = rows.map(area => {
            // Safe parsing of coordinate JSON strings
            try {
                if (typeof area.map_coordinates === 'string') {
                    area.map_coordinates = JSON.parse(area.map_coordinates);
                }
            } catch (e) { 
                area.map_coordinates = { top: 50, left: 50 }; 
            }
            
            if (!area.map_coordinates) area.map_coordinates = { top: 50, left: 50 };

            // Safe parsing of sensor position JSON strings
            try {
                if (typeof area.sensor_position === 'string') {
                    area.sensor_position = JSON.parse(area.sensor_position);
                }
            } catch (e) { 
                area.sensor_position = []; 
            }
            
            return area;
        });
        res.json({ success: true, data: areas });
    } catch (error) {
        console.error("Error fetching areas:", error);
        res.status(500).json({ success: false, message: 'Error fetching areas from database' });
    }
};

/**
 * Create a new area/room.
 */
exports.createArea = async (req, res) => {
    try {
        let { room, description, map_coordinates } = req.body;
        
        // Handle file path if image was uploaded
        const imagePath = req.file ? `${BASE_URL}/uploads/${req.file.filename}` : null;
        
        // Ensure coordinates are saved as JSON string
        let coordsToSave = map_coordinates || { top: '50%', left: '50%' };
        if (typeof coordsToSave === 'object') coordsToSave = JSON.stringify(coordsToSave);
        
        // Default sensor layout
        const initialSensor = JSON.stringify([{ top: '50%', left: '50%', size: '50px' }]);
        
        const sql = `
            INSERT INTO areas (room, description, map_file_path, map_coordinates, sensor_position, shade_state, current_position) 
            VALUES (?, ?, ?, ?, ?, "AUTO", 0)
        `;
        
        const [result] = await db.query(sql, [room, description, imagePath, coordsToSave, initialSensor]);
        
        // Log the creation event
        try {
            await db.query(
                "INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type) VALUES (?, 0, 0, 0, 'ROOM_CREATED')",
                [result.insertId]
            );
            
            if (req.io) {
                req.io.emit('new_log', {
                    action_type: 'ROOM_CREATED',
                    room: room,
                    recorded_at: new Date()
                });
                req.io.emit('refresh_areas');
            }
        } catch (logErr) {
            console.error("⚠️ Log failed (room still created):", logErr.message);
        }

        res.status(201).json({ success: true, message: 'Area created successfully', id: result.insertId });

    } catch (error) {
        console.error("❌ Create Area Error:", error);
        res.status(500).json({ success: false, message: 'Failed to create area.' });
    }
};

/**
 * Update the map image for a specific area.
 */
exports.uploadMapImage = async (req, res) => {
    const { id } = req.params;
    
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    try {
        const imagePath = `${BASE_URL}/uploads/${req.file.filename}`;
        await db.query('UPDATE areas SET map_file_path = ? WHERE id = ?', [imagePath, id]);
        
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'Map image updated successfully.', imagePath });

    } catch (error) {
        console.error("❌ Image Update Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update map image.' });
    }
};

/**
 * Update map pin coordinates.
 */
exports.updateMapCoordinates = async (req, res) => {
    const { id } = req.params;
    let { map_coordinates } = req.body;
    try {
        if (typeof map_coordinates === 'object') map_coordinates = JSON.stringify(map_coordinates);
        await db.query('UPDATE areas SET map_coordinates = ? WHERE id = ?', [map_coordinates, id]);
        
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'Map coordinates updated.' });
    } catch (error) {
        console.error("Coordinate Update Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update coordinates.' });
    }
};

/**
 * Update sensor layout within a room.
 */
exports.updateSensorPositions = async (req, res) => {
    const { id } = req.params;
    let { sensor_position } = req.body;
    try {
        if (typeof sensor_position === 'object') sensor_position = JSON.stringify(sensor_position);
        await db.query('UPDATE areas SET sensor_position = ? WHERE id = ?', [sensor_position, id]);
        
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'Sensor positions updated.' });
    } catch (error) {
        console.error("Sensor Update Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update sensor positions.' });
    }
};

/**
 * Handle manual state/position changes for a specific area.
 */
exports.updateAreaState = async (req, res) => {
    const { id } = req.params;
    const { state, position } = req.body;
    const isGlobal = (id === 'global');

    try {
        let newPosition = position;
        
        // Auto-set position if only state was provided
        if (newPosition === undefined) {
            if (state === 'OPEN') newPosition = 0;
            else if (state === 'CLOSED') newPosition = 100;
        }
        
        let query = 'UPDATE areas SET shade_state = ?, current_position = ?';
        let params = [state, newPosition];
        
        // Manual override timer management
        if (state === 'AUTO') query += ', last_manual_change = NULL';
        else query += ', last_manual_change = NOW()';
        
        if (!isGlobal) { 
            query += ' WHERE id = ?'; 
            params.push(id); 
        }

        await db.query(query, params);

        // --- Logic for Logging ---
        let logAreaId = isGlobal ? null : id; // Fix: Use NULL for global to avoid DB type error
        let roomName = "Entire Campus";

        if (!isGlobal) {
            const [areaInfo] = await db.query('SELECT room FROM areas WHERE id = ?', [id]);
            roomName = areaInfo[0]?.room || 'Unknown';
        }

        const actionType = state === 'OPEN' ? 'OPENED' : state === 'CLOSED' ? 'CLOSED' : 'AUTO';

        // Insert log with safe area_id
        await db.query(
            "INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type) VALUES (?, 0, 0, ?, ?)",
            [logAreaId, newPosition, actionType]
        );

        if (req.io) {
            req.io.emit('refresh_areas');
            req.io.emit('new_log', {
                action_type: actionType,
                room: roomName,
                current_position: newPosition,
                recorded_at: new Date()
            });
        }
        
        return res.json({ success: true, message: 'State updated successfully', newPosition });
    } catch (error) {
        console.error("❌ State Update Error:", error);
        return res.status(500).json({ success: false, message: 'Failed to update area state.' });
    }
};

/**
 * Delete an area and all its associated records (cascade simulation).
 */
exports.deleteArea = async (req, res) => {
    const { id } = req.params;
    try {
        const [areaInfo] = await db.query('SELECT room FROM areas WHERE id = ?', [id]);
        const roomName = areaInfo[0]?.room || 'Unknown';

        // Manual cleanup of related records (if not handled by DB Foreign Key CASCADE)
        await db.query('DELETE FROM logs WHERE area_id = ?', [id]);
        await db.query('DELETE FROM schedules WHERE area_id = ?', [id]);
        await db.query('DELETE FROM alerts WHERE area_id = ?', [id]);
        await db.query('DELETE FROM areas WHERE id = ?', [id]);

        if (req.io) {
            req.io.emit('new_log', {
                action_type: 'ROOM_DELETED',
                room: roomName,
                recorded_at: new Date()
            });
            req.io.emit('refresh_areas');
        }

        res.json({ success: true, message: 'Area and related data deleted successfully.' });
    } catch (error) {
        console.error("Delete Area Error:", error);
        res.status(500).json({ success: false, message: 'Failed to delete area.' });
    }
};

/**
 * Update real-time simulation parameters for an area.
 */
exports.updateAreaSimulation = async (req, res) => {
    try {
        const { id } = req.params;
        let { is_active, isActive, temperature, light } = req.body;

        // Support both naming conventions for flexibility
        const activeState = is_active !== undefined ? is_active : isActive;

        // Defaults if values are missing
        const simTemp = temperature !== undefined ? temperature : 25;
        const simLight = light !== undefined ? light : 500;

        await db.query(
            `UPDATE areas SET is_simulation = ?, sim_temp = ?, sim_light = ? WHERE id = ?`,
            [activeState, simTemp, simLight, id]
        );

        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'Simulation parameters updated.' });

    } catch (error) {
        console.error("Simulation Update Error:", error);
        res.status(500).json({ success: false, message: 'Server Error during simulation update' });
    }
};