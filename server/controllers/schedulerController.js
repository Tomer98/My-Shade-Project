/**
 * Scheduler Controller
 * Manages timed automation tasks (Schedules). 
 * Handles creating, fetching, and deleting fixed-time shade actions.
 */
const db = require('../config/db');

/**
 * Get all active schedules with room details.
 */
exports.getAllSchedules = async (req, res) => {
    try {
        const query = `
            SELECT s.*, a.room 
            FROM schedules s
            JOIN areas a ON s.area_id = a.id
            ORDER BY s.execution_time ASC
        `;
        const [rows] = await db.query(query);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("Error fetching schedules:", err.message);
        res.status(500).json({ success: false, message: 'Server Error fetching schedules' });
    }
};

/**
 * Create a new scheduled task.
 * Automatically sets target position (OPEN=0, CLOSE=100) and logs the event.
 */
exports.createSchedule = async (req, res) => {
    const { area_id, execution_time, action_type } = req.body;

    if (!area_id || !execution_time || !action_type) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        // Automatically determine target position based on action type
        const position = action_type === 'OPEN' ? 0 : 100;
        
        // 1. Insert into schedules table
        await db.query(
            `INSERT INTO schedules (area_id, execution_time, action_type, target_position, is_active)
             VALUES (?, ?, ?, ?, TRUE)`,
            [area_id, execution_time, action_type, position]
        );

        // 2. Sync to Logs: Track that a new schedule was added
        await db.query(
            "INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type) VALUES (?, 0, 0, 0, 'NEW_SCHEDULE')",
            [area_id]
        );

        // 3. Emit Real-time Socket Event
        if (req.io) {
            req.io.emit('new_log', {
                action_type: 'NEW_SCHEDULE',
                room: 'System',
                message: `Scheduled ${action_type} at ${execution_time}`,
                recorded_at: new Date(),
                temperature: 0,
                light_intensity: 0,
                current_position: 0
            });
        }

        res.json({ success: true, message: 'Schedule created successfully' });
    } catch (err) {
        console.error("Error creating schedule:", err.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/**
 * Delete a specific schedule by ID.
 */
exports.deleteSchedule = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM schedules WHERE id = ?', [id]);
        res.json({ success: true, message: 'Schedule deleted successfully' });
    } catch (err) {
        console.error("Error deleting schedule:", err.message);
        res.status(500).json({ success: false, message: 'Failed to delete schedule' });
    }
};