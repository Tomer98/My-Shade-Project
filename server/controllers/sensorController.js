/**
 * Sensor & Log Controller
 * Handles real-time sensor data ingestion, weather logging, and historical data retrieval.
 */
const db = require('../config/db');

/**
 * Get the latest global weather data and algorithm score.
 * Used primarily for the dashboard's top monitoring bar.
 */
exports.getLatest = async (req, res) => {
    try {
        const query = 'SELECT * FROM weather_logs ORDER BY recorded_at DESC LIMIT 1';
        const [rows] = await db.query(query);
        
        if (rows.length > 0) {
            const latest = rows[0];
            return res.json({
                success: true,
                temp: latest.temp,
                light: latest.light_level,
                clouds: latest.clouds,
                score: latest.score !== null ? latest.score : 0.5,
                decision: latest.decision || 'MONITORING',
                reason: latest.reason || 'Optimal conditions'
            });
        }

        // Fallback if the table is empty
        return res.json({ 
            success: true, 
            temp: 0, 
            light: 0, 
            clouds: 0, 
            score: 0.5, 
            decision: 'WAITING', 
            reason: 'Waiting for sensor data...' 
        });

    } catch (error) {
        console.error('❌ Error fetching latest weather logs:', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * Record new sensor data from a physical area.
 * Triggers automation evaluation and emits real-time updates via Socket.io.
 */
exports.addSensorData = async (req, res) => {
    const { area_id, temperature, light_intensity, weather_condition } = req.body;

    try {
        // 1. Verify area existence and get current state
        const [areas] = await db.query('SELECT current_position, room FROM areas WHERE id = ?', [area_id]);
        
        if (!areas || areas.length === 0) {
            return res.status(404).json({ success: false, message: 'Area not found' });
        }

        const currentPos = areas[0].current_position || 0;
        const roomName = areas[0].room;

        // 2. Update the area's live environmental condition
        await db.query(
            'UPDATE areas SET weather_condition = ? WHERE id = ?',
            [weather_condition || 'Clear', area_id]
        );

        // 3. Insert historical log entry
        const [result] = await db.query(
            'INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type) VALUES (?, ?, ?, ?, "SENSOR_UPDATE")',
            [area_id, temperature, light_intensity, currentPos]
        );

        // 4. Emit real-time update to all connected clients
        if (req.io) {
            req.io.emit('new_log', {
                id: result.insertId,
                room: roomName,
                temperature,
                light_intensity,
                current_position: currentPos,
                recorded_at: new Date(),
                action_type: 'SENSOR_UPDATE'
            });
        }

        return res.json({ success: true, message: 'Sensor data processed and UI updated' });

    } catch (error) {
        console.error("❌ Error saving sensor log:", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/**
 * Fetch the last 20 logs for a specific area.
 */
exports.getHistoryByArea = async (req, res) => {
    const { areaId } = req.params;
    try {
        const query = 'SELECT * FROM logs WHERE area_id = ? ORDER BY recorded_at DESC LIMIT 20';
        const [rows] = await db.query(query, [areaId]);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("❌ Error fetching area history:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * Fetch the last 10 logs globally, including room names.
 * Uses LEFT JOIN to include global events (where area_id is NULL).
 */
exports.getGlobalLogs = async (req, res) => {
    try {
        const query = `
            SELECT l.recorded_at, l.temperature, l.light_intensity, l.current_position, l.action_type, 
                   IFNULL(a.room, 'Entire Campus') AS room 
            FROM logs l
            LEFT JOIN areas a ON l.area_id = a.id
            ORDER BY l.recorded_at DESC LIMIT 10
        `;
        const [rows] = await db.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("❌ Error fetching global logs:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};