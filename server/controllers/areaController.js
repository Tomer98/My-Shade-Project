const db = require('../config/db');
const automationConfig = require('../config/automation');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// ==========================================
// === המוח החדש: אלגוריתם מבוסס ניקוד ===
// ==========================================
exports.evaluateAutomation = async (areaId, temperature, light, io) => {
    try {
        // 1. בדיקת סטטוס נוכחי
        const [rows] = await db.query('SELECT shade_state, current_position FROM areas WHERE id = ?', [areaId]);
        if (rows.length === 0) return;

        const currentState = rows[0].shade_state;
        const currentPos = rows[0].current_position;

        // אם המשתמש נגע ידנית - המערכת לא מתערבת!
        if (currentState !== 'AUTO') {
            console.log(`✋ Zone ${areaId} is in MANUAL mode. AI ignored.`);
            return;
        }

        // 2. חישוב הציון (Score Calculation)
        const { WEIGHTS, LIMITS, THRESHOLDS } = automationConfig;

        // נורמליזציה של הטמפרטורה (הופכים טמפרטורה לציון בין 0 ל-100)
        // הנוסחה: (ערך נוכחי - מינימום) חלקי (מקסימום - מינימום) כפול 100
        let tempScore = ((temperature - LIMITS.MIN_TEMP) / (LIMITS.MAX_TEMP - LIMITS.MIN_TEMP)) * 100;
        
        // מוודאים שהציון לא חורג מהגבולות (Clamp)
        tempScore = Math.max(0, Math.min(100, tempScore));

        // נורמליזציה של האור (הוא כבר מגיע באחוזים אז זה קל)
        let lightScore = light;

        // === הציון המשוקלל הסופי ===
        // דוגמה: (80 * 0.6) + (50 * 0.4) = 48 + 20 = 68
        const totalScore = (tempScore * WEIGHTS.TEMP) + (lightScore * WEIGHTS.LIGHT);

        // 3. קביעת אחוז הסגירה לפי המדרגות
        let targetPosition = 0; // ברירת מחדל: פתוח

        if (totalScore >= THRESHOLDS.LEVEL_4) {
            targetPosition = 100; // חם ומסנוור מאוד -> סגור לגמרי
        } else if (totalScore >= THRESHOLDS.LEVEL_3) {
            targetPosition = 75;  // אי נוחות גבוהה -> סגור 3/4
        } else if (totalScore >= THRESHOLDS.LEVEL_2) {
            targetPosition = 50;  // אי נוחות בינונית -> חצי סגור
        } else if (totalScore >= THRESHOLDS.LEVEL_1) {
            targetPosition = 25;  // התחלה של אי נוחות -> סגור רבע
        }

        // הדפסת לוג חכם למעקב
        console.log(`🧠 AI Analysis | Temp: ${temperature}° (${tempScore.toFixed(0)}pts), Light: ${light}% | Score: ${totalScore.toFixed(1)} | Target: ${targetPosition}%`);

        // 4. ביצוע (רק אם צריך לשנות את המצב הקיים)
        if (targetPosition !== currentPos) {
            console.log(`🤖 AI ACTION: Adjusting shade to ${targetPosition}%`);
            
            // עדכון בסיס הנתונים
            await db.query(
                'UPDATE areas SET shade_state = "AUTO", current_position = ?, last_manual_change = NULL WHERE id = ?',
                [targetPosition, areaId]
            );

            // שידור הודעה לכל הלקוחות (WebSockets)
            if (io) {
                console.log("📡 AI emitting refresh_areas event");
                io.emit('refresh_areas'); 
            }
        } else {
            console.log(`✅ AI Check: Current position (${currentPos}%) is optimal based on score.`);
        }

    } catch (error) {
        console.error("Automation Error:", error);
    }
};

exports.getAllAreas = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT *, room as name FROM areas');
        const areas = rows.map(area => {
            try {
                if (typeof area.map_coordinates === 'string') area.map_coordinates = JSON.parse(area.map_coordinates);
            } catch (e) { area.map_coordinates = { top: 50, left: 50 }; }
            
            if (!area.map_coordinates) area.map_coordinates = { top: 50, left: 50 };

            try {
                if (typeof area.sensor_position === 'string') area.sensor_position = JSON.parse(area.sensor_position);
            } catch (e) { area.sensor_position = []; }
            return area;
        });
        res.json({ success: true, data: areas });
    } catch (error) {
        console.error("Error fetching areas:", error);
        res.status(500).json({ success: false, message: 'Error fetching areas' });
    }
};

exports.createArea = async (req, res) => {
    try {
        let { room, description, map_coordinates } = req.body;
        let imagePath = req.file ? `${BASE_URL}/uploads/${req.file.filename}` : null;
        
        let coordsToSave = map_coordinates || { top: '50%', left: '50%' };
        if (typeof coordsToSave === 'object') coordsToSave = JSON.stringify(coordsToSave);
        
        const initialSensor = JSON.stringify([{ top: '50%', left: '50%', size: '50px' }]);

        const [result] = await db.query(
            'INSERT INTO areas (room, description, map_file_path, map_coordinates, sensor_position, shade_state, current_position) VALUES (?, ?, ?, ?, ?, "AUTO", 0)',
            [room, description, imagePath, coordsToSave, initialSensor]
        );
        
        if (req.io) req.io.emit('refresh_areas');

        res.status(201).json({ success: true, message: 'Area created', id: result.insertId });
    } catch (error) {
        console.error("Create Area Error:", error);
        res.status(500).json({ success: false, message: 'Failed to create area.' });
    }
};

exports.updateMapCoordinates = async (req, res) => {
    const { id } = req.params;
    let { map_coordinates } = req.body;
    try {
        if (typeof map_coordinates === 'object') map_coordinates = JSON.stringify(map_coordinates);
        await db.query('UPDATE areas SET map_coordinates = ? WHERE id = ?', [map_coordinates, id]);
        
        if (req.io) req.io.emit('refresh_areas');
        
        res.json({ success: true, message: 'Map coordinates updated.' });
    } catch (error) {
        console.error("Update Coordinates Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update coordinates.' });
    }
};

exports.updateSensorPositions = async (req, res) => {
    const { id } = req.params;
    let { sensor_position } = req.body;
    try {
        if (typeof sensor_position === 'object') sensor_position = JSON.stringify(sensor_position);
        await db.query('UPDATE areas SET sensor_position = ? WHERE id = ?', [sensor_position, id]);
        
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'Sensor positions updated.' });
    } catch (error) {
        console.error("Update Sensors Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update sensor positions.' });
    }
};

exports.deleteArea = async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`🗑️ Deleting area ID: ${id} and all related data...`);
        
        await db.query('DELETE FROM logs WHERE area_id = ?', [id]);
        await db.query('DELETE FROM schedules WHERE area_id = ?', [id]);
        await db.query('DELETE FROM alerts WHERE area_id = ?', [id]);
        await db.query('DELETE FROM areas WHERE id = ?', [id]);
        
        if (req.io) req.io.emit('refresh_areas');
        
        console.log("✅ Area and dependencies deleted successfully.");
        res.json({ success: true, message: 'Area deleted.' });

    } catch (error) {
        console.error("❌ Delete Area Error:", error);
        res.status(500).json({ success: false, message: 'Failed to delete area.' });
    }
};

exports.updateAreaState = async (req, res) => {
    const { id } = req.params;
    const { state, position } = req.body;

    console.log(`📡 Update request: ID=${id}, State=${state}, Position=${position}`);

    try {
        let newPosition = position;
        if (newPosition === undefined) {
            if (state === 'OPEN') newPosition = 0;
            if (state === 'CLOSED') newPosition = 100;
        }

        let query = 'UPDATE areas SET shade_state = ?, current_position = ?';
        let params = [state, newPosition];

        if (state === 'AUTO') {
            query += ', last_manual_change = NULL';
        } else {
            query += ', last_manual_change = NOW()';
        }

        if (id === 'global') {
            console.log("🌍 Executing GLOBAL update on all areas.");
        } else {
            console.log(`🏠 Executing update on single area ID: ${id}`);
            query += ' WHERE id = ?';
            params.push(id);
        }

        await db.query(query, params);
        
        if (req.io) req.io.emit('refresh_areas');

        res.json({ success: true, message: 'State updated', newPosition });
    } catch (error) {
        console.error("Update State Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update area state.' });
    }
};

exports.updateGlobalState = async (req, res) => {
    const { state } = req.body;
    try {
        let position = 0;
        if (state === 'CLOSED') position = 100;
        
        let query = "UPDATE areas SET shade_state = ?, current_position = ?";
        let params = [state, position];
        
        if (state === 'AUTO') query += ", last_manual_change = NULL"; 
        else query += ", last_manual_change = NOW()";

        await db.query(query, params);
        
        if (req.io) req.io.emit('refresh_areas');

        res.json({ success: true, message: 'Global state updated successfully.' });
    } catch (error) {
        console.error("Global State Error:", error);
        res.status(500).json({ success: false, message: 'Failed to update global state.' });
    }
};

exports.uploadMapImage = async (req, res) => {
    console.log("📸 Upload Controller: Start processing request for Area ID:", req.params.id);

    const { id } = req.params;
    
    if (!req.file) {
        console.error("❌ Upload Controller Error: No file provided in request");
        return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    console.log("📂 File Details:", {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
    });

    try {
        const imagePath = `${BASE_URL}/uploads/${req.file.filename}`;
        console.log("🔗 Generated URL path:", imagePath);

        console.log("🗄️ Executing DB Update...");
        await db.query('UPDATE areas SET map_file_path = ? WHERE id = ?', [imagePath, id]);
        console.log("✅ DB Update Successful");

        if (req.io) {
            console.log("📡 Emitting 'refresh_areas' via Socket.io");
            req.io.emit('refresh_areas');
        } else {
            console.warn("⚠️ Warning: req.io is undefined - cannot emit socket event");
        }

        res.json({ success: true, message: 'Map image updated successfully.', imagePath });
        console.log("✅ Request completed successfully");

    } catch (error) {
        console.error("❌❌❌ CRITICAL ERROR IN uploadMapImage ❌❌❌");
        console.error("Error Message:", error.message);
        console.error("Full Stack Trace:", error.stack);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload image.',
            error: error.message 
        });
    }
};

// ==========================================
// === סימולציה: הזרקת נתונים לבדיקת ה-AI ===
// ==========================================
exports.injectSimulationData = async (req, res) => {
    const { id } = req.params;
    const { temperature, light } = req.body;

    console.log(`🧪 Simulation Injection for Area ${id}: Temp=${temperature}, Light=${light}`);

    try {
        // 1. שמירת הנתונים בהיסטוריה (Logs)
        await db.query(
            'INSERT INTO logs (area_id, temperature, light_intensity, current_position) VALUES (?, ?, ?, (SELECT current_position FROM areas WHERE id = ?))',
            [id, temperature, light, id]
        );

        // 2. קריאה למוח (AI) כדי לקבל החלטה מיידית
        const io = req.app.get('io'); // השגת ה-Socket
        
        await exports.evaluateAutomation(id, temperature, light, io);

        res.json({ success: true, message: 'Simulation data processed' });

    } catch (error) {
        console.error("Simulation Error:", error);
        res.status(500).json({ success: false, message: 'Simulation failed' });
    }
};