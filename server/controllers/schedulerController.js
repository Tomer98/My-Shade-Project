const db = require('../config/db');

exports.getAllSchedules = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, a.room 
            FROM schedules s
            JOIN areas a ON s.area_id = a.id
            ORDER BY s.execution_time ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createSchedule = async (req, res) => {
    const { area_id, execution_time, action_type } = req.body;
    try {
        // קביעת מיקום אוטומטית: פתיחה=0, סגירה=100
        const position = action_type === 'OPEN' ? 0 : 100;
        
        await db.query(
            `INSERT INTO schedules (area_id, execution_time, action_type, target_position, is_active)
             VALUES (?, ?, ?, ?, TRUE)`,
            [area_id, execution_time, action_type, position]
        );

        // 1. Sync to Logs: Insert a corresponding record into the logs table
        await db.query(
            "INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type) VALUES (?, 0, 0, 0, 'NEW_SCHEDULE')",
            [area_id]
        );

        // 2. Emit Socket Event
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

        res.json({ success: true, message: 'Schedule created' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error creating schedule' });
    }
};

exports.deleteSchedule = async (req, res) => {
    try {
        await db.query('DELETE FROM schedules WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};