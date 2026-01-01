const db = require('../config/db');
// חשוב: ייבוא הקונטרולר של האזורים
const areaController = require('./areaController'); 

exports.addSensorData = async (req, res) => {
    const { area_id, temperature, light_intensity } = req.body;
    
    try {
        // 1. שמירת ההיסטוריה
        const [area] = await db.query('SELECT current_position FROM areas WHERE id = ?', [area_id]);
        const currentPos = area.length > 0 ? area[0].current_position : 0;

        await db.query(
            'INSERT INTO sensor_readings (area_id, temperature, light_intensity, current_position) VALUES (?, ?, ?, ?)',
            [area_id, temperature, light_intensity, currentPos]
        );

        // 2. הפעלת האוטומציה (AI) באופן מיידי! ⚡
        areaController.evaluateAutomation(area_id, temperature, light_intensity);

        res.json({ success: true, message: 'Data received & Logic triggered' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getHistoryByArea = async (req, res) => {
    const { areaId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT * FROM sensor_readings WHERE area_id = ? ORDER BY recorded_at DESC LIMIT 20`, 
            [areaId]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getGlobalLogs = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.recorded_at, s.temperature, s.light_intensity, s.current_position, a.room 
            FROM sensor_readings s
            JOIN areas a ON s.area_id = a.id
            ORDER BY s.recorded_at DESC LIMIT 10
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};