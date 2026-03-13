const db = require('../config/db');

// קבלת כל ההתראות (כולל שמות חדרים ומשתמשים)
exports.getAllAlerts = async (req, res) => {
    try {
        const query = `
            SELECT 
                alerts.id, alerts.description, alerts.priority, alerts.status, alerts.created_at,
                areas.room AS room_name, areas.building_number,
                creator.username AS created_by_name,
                handler.username AS assigned_to_name,
                handler.id AS assigned_to_id
            FROM alerts
            JOIN areas ON alerts.area_id = areas.id
            JOIN users AS creator ON alerts.created_by = creator.id
            LEFT JOIN users AS handler ON alerts.assigned_to = handler.id
            ORDER BY alerts.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// יצירת התראה חדשה
exports.createAlert = async (req, res) => {
    const { area_id, created_by, description, priority } = req.body;
    
    // בדיקת תקינות בסיסית
    if (!area_id || !created_by || !description) {
        return res.status(400).json({ success: false, message: 'חסרים שדות חובה' });
    }

    try {
        // 1. Insert the Alert
        const [result] = await db.query(
            'INSERT INTO alerts (area_id, created_by, description, priority) VALUES (?, ?, ?, ?)',
            [area_id, created_by, description, priority || 'Medium']
        );

        // 2. Sync to Logs: Insert a corresponding record into the logs table
        await db.query(
            "INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type) VALUES (?, 0, 0, 0, 'NEW_ALERT')",
            [area_id]
        );

        // 3. Emit Socket Events
        if (req.io) 
        {
            req.io.emit('new_log', {
                action_type: 'NEW_ALERT',
                room: 'System Alert',
                message: description,
                recorded_at: new Date(),
                temperature: 0,
                light_intensity: 0,
                current_position: 0
            });
            req.io.emit('refresh_alerts');
        }

        res.json({ success: true, message: 'Alert created successfully' });
    } catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({ success: false, message: 'Error creating alert' });
    }
};

// עדכון התראה (סטטוס או הקצאת איש צוות)
exports.updateAlert = async (req, res) => {
    const { id } = req.params;
    const { status, assigned_to } = req.body;

    try {
        let query = 'UPDATE alerts SET status = ?';
        let params = [status];

        // אם הוקצה איש צוות, נעדכן אותו וגם נשנה סטטוס ל"בטיפול" אוטומטית
        if (assigned_to !== undefined) {
            query += ', assigned_to = ?';
            params.push(assigned_to);
            
            if (status === 'Open' && assigned_to) {
                query = query.replace('status = ?', 'status = "Acknowledged"');
                params[0] = 'Acknowledged';
            }
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.query(query, params);
        res.json({ success: true, message: 'Alert updated' });
    } catch (error) {
        console.error('Error updating alert:', error);
        res.status(500).json({ success: false, message: 'Error updating alert' });
    }
};

// מחיקת התראה
exports.deleteAlert = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM alerts WHERE id = ?', [id]);
        res.json({ success: true, message: 'Alert deleted' });
    } catch (error) {
        console.error('Error deleting alert:', error);
        res.status(500).json({ success: false, message: 'Error deleting alert' });
    }
};