const db = require('../config/db');
const automationConfig = require('../config/automation');

// הגדרת כתובת בסיס לשרת (אם לא מוגדר ב-.env, ברירת המחדל היא localhost)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// --- האלגוריתם החכם (המוח של המערכת) ---
// פונקציה זו מופעלת מיידית כשהחיישן שולח נתונים
exports.evaluateAutomation = async (areaId, temperature, light) => {
    try {
        // 1. בדיקת סטטוס נוכחי
        const [rows] = await db.query('SELECT shade_state, current_position FROM areas WHERE id = ?', [areaId]);
        if (rows.length === 0) return;

        const currentState = rows[0].shade_state;
        const currentPos = rows[0].current_position;

        // אם המשתמש נגע ידנית (ולא לחץ על AUTO), המערכת מכבדת את זה ולא מתערבת
        if (currentState !== 'AUTO') {
            console.log(`✋ Zone ${areaId} is in MANUAL mode. AI ignored.`);
            return;
        }

        // 2. קבלת החלטות
        const { CLOSE_SHADES, OPEN_SHADES } = automationConfig;
        let decision = null;
        let newPosition = null;

        if (temperature > CLOSE_SHADES.TEMP_ABOVE && light > CLOSE_SHADES.LIGHT_ABOVE) {
            decision = 'CLOSED';
            newPosition = 100;
        } else if (temperature < OPEN_SHADES.TEMP_BELOW && light < OPEN_SHADES.LIGHT_BELOW) {
            decision = 'OPEN';
            newPosition = 0;
        }

        // 3. ביצוע (רק אם צריך שינוי מהמצב הקיים)
        if (decision && newPosition !== currentPos) {
            console.log(`🤖 AI ACTION: Temp ${temperature}°C, Light ${light}% -> Setting to ${decision}`);
            
            // עדכון בסיס הנתונים! (כולל איפוס ידני ל-NULL כדי לשמור על סטטוס אוטומטי נקי)
            await db.query(
                'UPDATE areas SET shade_state = "AUTO", current_position = ?, last_manual_change = NULL WHERE id = ?',
                [newPosition, areaId]
            );
        } else {
            console.log(`🧠 AI Check: No change needed (Temp ${temperature}, Light ${light}).`);
        }

    } catch (error) {
        console.error("Automation Error:", error);
    }
};

// --- שליפת כל החדרים ---
exports.getAllAreas = async (req, res) => {
    try {
        // השינוי הקריטי: אנחנו מבקשים מה-SQL לקרוא לעמודה room בשם name
        const [rows] = await db.query('SELECT *, room as name FROM areas');
        
        const areas = rows.map(area => {
            // --- טיפול חכם בקואורדינטות (מונע פינים תקועים) ---
            try {
                // אם המידע מגיע כמחרוזת (String), נהפוך אותו לאובייקט
                if (typeof area.map_coordinates === 'string') {
                    area.map_coordinates = JSON.parse(area.map_coordinates);
                }
            } catch (e) {
                // אם יש שגיאה, נשים ברירת מחדל באמצע המפה
                area.map_coordinates = { top: 50, left: 50 };
            }

            // אם משום מה זה עדיין null (קורה לפעמים ביצירה חדשה), ניתן ברירת מחדל
            if (!area.map_coordinates) {
                area.map_coordinates = { top: 50, left: 50 };
            }

            // --- טיפול בחיישנים ---
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
        console.error("Get Areas Error:", error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
};

// --- יצירת חדר חדש (כולל העלאת תמונה) ---
exports.createArea = async (req, res) => {
    try {
        let { room, description, map_coordinates } = req.body;
        
        let imagePath = '/room206_sketch.png'; 
        
        if (req.file) {
            imagePath = `${BASE_URL}/uploads/${req.file.filename}`;
        }

        // Add a default for map_coordinates if it's missing, to prevent crashes
        let coordsToSave = map_coordinates || { top: '50%', left: '50%' };
        if (typeof coordsToSave === 'object') {
            coordsToSave = JSON.stringify(coordsToSave);
        }

        const initialSensor = JSON.stringify([{ top: '50%', left: '50%', size: '50px' }]);

        const [result] = await db.query(
            'INSERT INTO areas (room, description, map_file_path, map_coordinates, sensor_position, shade_state, current_position) VALUES (?, ?, ?, ?, ?, "AUTO", 0)',
            [room, description, imagePath, coordsToSave, initialSensor]
        );

        res.status(201).json({ success: true, message: 'Area created', id: result.insertId });
    } catch (error) {
        console.error("Create Area Error:", error);
        res.status(500).json({ success: false, message: 'Failed to create area.' });
    }
};

// --- עדכון מיקום במפה (גרירה) ---
exports.updateMapCoordinates = async (req, res) => {
    const { id } = req.params;
    let { map_coordinates } = req.body;
    
    try {
        if (typeof map_coordinates === 'object') {
            map_coordinates = JSON.stringify(map_coordinates);
        }
        
        const [result] = await db.query('UPDATE areas SET map_coordinates = ? WHERE id = ?', [map_coordinates, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Area not found.' });
        }

        res.json({ success: true, message: 'Map coordinates updated.' });
    } catch (error) {
        console.error("Update Coords Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update coordinates.' });
    }
};

// --- עדכון מיקומי חיישנים ---
exports.updateSensorPositions = async (req, res) => {
    const { id } = req.params;
    let { sensor_position } = req.body; // Changed from plural to singular

    try {
        if (typeof sensor_position === 'object') {
            sensor_position = JSON.stringify(sensor_position);
        }

        const [result] = await db.query('UPDATE areas SET sensor_position = ? WHERE id = ?', [sensor_position, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Area not found.' });
        }

        res.json({ success: true, message: 'Sensor positions updated.' });
    } catch (error) {
        console.error("Update Sensor Positions Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update sensor positions.' });
    }
};

// --- מחיקת חדר ---
exports.deleteArea = async (req, res) => {
    const { id } = req.params;
    try {
        // First, delete related sensor readings to maintain foreign key integrity
        await db.query('DELETE FROM sensor_readings WHERE area_id = ?', [id]);
        
        const [result] = await db.query('DELETE FROM areas WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Area not found.' });
        }

        res.json({ success: true, message: 'Area and associated readings deleted.' });
    } catch (error) {
        console.error("Delete Area Error:", error);
        res.status(500).json({ success: false, message: 'Failed to delete area.' });
    }
};

// עדכון מצב חדר ספציפי (הפונקציה של הכפתורים באתר)
exports.updateAreaState = async (req, res) => {
    const { id } = req.params;
    const { state, position } = req.body;

    console.log(`📡 Request received for Room ${id}: State="${state}", Position=${position}`);

    try {
        let newPosition = position;
        
        if (newPosition === undefined) {
            if (state === 'OPEN') newPosition = 0;
            if (state === 'CLOSED') newPosition = 100;
        }

        let query = 'UPDATE areas SET shade_state = ?, current_position = ?';
        const params = [state, newPosition];

        if (state === 'AUTO') {
            console.log('🤖 Switching to AUTO -> Cleaning manual override memory.');
            query += ', last_manual_change = NULL';
        } else {
            console.log('✋ Manual change detected -> Saving timestamp.');
            query += ', last_manual_change = NOW()';
        }

        query += ' WHERE id = ?';
        params.push(id);

        const [result] = await db.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Area not found.' });
        }
        
        res.json({ success: true, message: 'State updated', newPosition });
    } catch (error) {
        console.error('Update Area State Error:', error);
        res.status(500).json({ success: false, message: 'Failed to update area state.' });
    }
};

// שינוי סטטוס גלובלי
exports.updateGlobalState = async (req, res) => {
    const { state } = req.body;
    
    try {
        let position = 0;
        if (state === 'CLOSED') position = 100;
        
        let query = "UPDATE areas SET shade_state = ?, current_position = ?";
        let params = [state, position];
        
        if (state === 'AUTO') {
            query += ", last_manual_change = NULL"; 
        } else {
            query += ", last_manual_change = NOW()";
        }

        await db.query(query, params);
        
        res.json({ success: true, message: 'Global state updated successfully.' });
    } catch (error) {
        console.error('Global Update Error:', error);
        res.status(500).json({ success: false, message: 'Failed to update global state.' });
    }
};