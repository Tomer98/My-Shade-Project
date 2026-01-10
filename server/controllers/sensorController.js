const db = require('../config/db');
// חשוב: ייבוא הקונטרולר של האזורים
const areaController = require('./areaController'); 

// --- 1. הפונקציה שהייתה חסרה! (עבור הסטריפ העליון/המוח) ---
exports.getLatest = async (req, res) => {
    try {
        // שולף את הנתון האחרון מטבלת weather_logs (הטבלה של האלגוריתם)
        const [rows] = await db.query('SELECT * FROM weather_logs ORDER BY recorded_at DESC LIMIT 1');
        
        if (rows.length > 0) {
            res.json({
                temp: rows[0].temp,
                light: rows[0].light_level,
                clouds: rows[0].clouds,
                score: rows[0].score || 0.5,
                decision: rows[0].decision,
                reason: rows[0].reason
            });
        } else {
            // אם הטבלה ריקה
            res.json({ temp: 0, light: 0, clouds: 0, score: 0, decision: 'WAITING', reason: 'No data...' });
        }
    } catch (error) {
        console.error('Error fetching latest:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// --- 2. הוספת נתונים (הקוד המעולה ששלחת - לא נגעתי בלוגיקה) ---
exports.addSensorData = async (req, res) => {
    const { area_id, temperature, light_intensity, weather_condition } = req.body;

    // Debug log to verify weather_condition is received
    console.log(`📥 Received Sensor Data for Area ${area_id}: Temp=${temperature}, Light=${light_intensity}, Weather=${weather_condition}`);
    
    try {
        // 1. שמירת ההיסטוריה בדאטהבייס
        const [area] = await db.query('SELECT current_position, room FROM areas WHERE id = ?', [area_id]);
        
        if (!area || area.length === 0) {
            return res.status(404).json({ success: false, message: 'Area not found' });
        }

        const currentPos = area[0].current_position || 0;
        const roomName = area[0].room;

        // Update the area's weather condition in the DB
        await db.query(
            'UPDATE areas SET weather_condition = ? WHERE id = ?',
            [weather_condition, area_id]
        );

        const [result] = await db.query(
            'INSERT INTO logs (area_id, temperature, light_intensity, current_position) VALUES (?, ?, ?, ?)',
            [area_id, temperature, light_intensity, currentPos]
        );

        // 2. שידור לוג בזמן אמת
        const newLogEntry = {
            id: result.insertId,
            room: roomName,
            temperature,
            light_intensity,
            current_position: currentPos,
            recorded_at: new Date(),
            action_type: 'SENSOR_UPDATE'
        };

        if (req.io) {
            req.io.emit('new_log', newLogEntry);
            console.log("📡 Emitted new_log event via WebSocket");
        }

        // 3. הפעלת האוטומציה
        if (areaController && areaController.evaluateAutomation) {
             areaController.evaluateAutomation(area_id, temperature, light_intensity, req.io, weather_condition);
        }

        res.json({ success: true, message: 'Data received, Logic triggered & Client updated' });

    } catch (error) {
        console.error("Error saving log:", error);
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

// --- 3. שליפת היסטוריה לפי חדר ---
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

// --- 4. שליפת לוגים גלובליים ---
exports.getGlobalLogs = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.recorded_at, s.temperature, s.light_intensity, s.current_position, s.action_type, a.room 
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

// וודא שכתוב exports. לפני שם הפונקציה!
exports.updateAreaSensors = async (req, res) => {
    // אנחנו מוסיפים תמיכה בשני השמות כדי למנוע טעויות בעתיד
    const id = req.body.id;
    const temp = req.body.temp || req.body.temperature; // תומך בשניהם
    const light = (req.body.light !== undefined) ? req.body.light : (req.body.light_intensity ?? 0);
    const isActive = req.body.isActive || req.body.is_active;
    const weather_condition = req.body.weather_condition;

    console.log(`🔌 API REQUEST: Room ${id} -> Temp: ${temp}, Weather: ${weather_condition}`);

    try {
        await db.query(
            `UPDATE areas 
             SET is_simulation = ?, 
                 sim_temp = ?, 
                 sim_light = ?, 
                 weather_condition = ? 
             WHERE id = ?`,
            [isActive ? 1 : 0, temp, light, weather_condition || 'Clear', id]
        );

        if (isActive && areaController.evaluateAutomation) {
            await areaController.evaluateAutomation(id, temp, light, req.io, weather_condition);
        }

        res.json({ success: true, message: 'Simulation synced with weather' });
    } catch (error) {
        console.error("Sim update error:", error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
};