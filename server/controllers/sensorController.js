const db = require('../config/db');
// חשוב: ייבוא הקונטרולר של האזורים
const areaController = require('./areaController'); 

exports.addSensorData = async (req, res) => {
    const { area_id, temperature, light_intensity } = req.body;
    
    try {
        // 1. שמירת ההיסטוריה בדאטהבייס
        const [area] = await db.query('SELECT current_position, room FROM areas WHERE id = ?', [area_id]);
        
        // הגנה למקרה שהחדר לא נמצא
        if (!area || area.length === 0) {
            return res.status(404).json({ success: false, message: 'Area not found' });
        }

        const currentPos = area[0].current_position || 0;
        const roomName = area[0].room; // שומרים את שם החדר בשביל הלוג

        // שמירה בטבלה logs
        const [result] = await db.query(
            'INSERT INTO logs (area_id, temperature, light_intensity, current_position) VALUES (?, ?, ?, ?)',
            [area_id, temperature, light_intensity, currentPos]
        );

        // 2. --- שידור לוג בזמן אמת לכל המחוברים! 📡 ---
        const newLogEntry = {
            id: result.insertId,
            room: roomName, // חשוב שהלקוח ידע איזה חדר זה
            temperature,
            light_intensity,
            current_position: currentPos,
            recorded_at: new Date() // זמן עכשיו
        };

        // שולח את ההודעה ל-Socket.io (מעדכן את רשימת הלוגים בצד ימין)
        if (req.io) {
            req.io.emit('new_log', newLogEntry);
            console.log("📡 Emitted new_log event via WebSocket");
        }

        // 3. הפעלת האוטומציה (AI)
        if (areaController && areaController.evaluateAutomation) {
             // --- התיקון הגדול: העברת req.io פנימה ---
             // כעת הפונקציה תוכל לרענן את המפה אם היא תחליט לסגור תריס
             areaController.evaluateAutomation(area_id, temperature, light_intensity, req.io);
        }

        res.json({ success: true, message: 'Data received, Logic triggered & Client updated' });

    } catch (error) {
        console.error("Error saving log:", error);
        // החזרת הודעת שגיאה מפורטת למקרה של בעיה
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

exports.getHistoryByArea = async (req, res) => {
    const { areaId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT * FROM logs WHERE area_id = ? ORDER BY recorded_at DESC LIMIT 20`, 
            [areaId]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getGlobalLogs = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.recorded_at, s.temperature, s.light_intensity, s.current_position, a.room 
            FROM logs s
            JOIN areas a ON s.area_id = a.id
            ORDER BY s.recorded_at DESC LIMIT 10
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching global logs:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};