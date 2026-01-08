const db = require('../config/db');
const automationConfig = require('../config/automation');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// ... (השאר את פונקציית evaluateAutomation כמו שהיא) ...
exports.evaluateAutomation = async (areaId, temperature, light, io) => {
    /* (תעתיק את הלוגיקה הקיימת שלך לפה, היא הייתה תקינה) */
};

exports.getAllAreas = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT *, room as name FROM areas');
        const areas = rows.map(area => {
            // המרה בטוחה של קואורדינטות
            try {
                if (typeof area.map_coordinates === 'string') area.map_coordinates = JSON.parse(area.map_coordinates);
            } catch (e) { area.map_coordinates = { top: 50, left: 50 }; }
            
            if (!area.map_coordinates) area.map_coordinates = { top: 50, left: 50 };

            try {
                if (typeof area.sensor_position === 'string') area.sensor_position = JSON.parse(area.sensor_position);
            } catch (e) { area.sensor_position = []; }
            
            // המרת נתיב התמונה ל-URL מלא אם צריך (אופציונלי, תלוי איך שמרת ב-DB)
            // כאן אנחנו מניחים שב-DB שמור כבר הנתיב המלא כולל ה-BASE_URL
            
            return area;
        });
        res.json({ success: true, data: areas });
    } catch (error) {
        console.error("Error fetching areas:", error);
        res.status(500).json({ success: false, message: 'Error fetching areas' });
    }
};

exports.createArea = async (req, res) => {
    console.log("📝 Create Area Request Received");
    try {
        let { room, description, map_coordinates } = req.body;
        
        // יצירת הנתיב היחסי לקובץ
        // בשימוש בדוקר עדיף לשמור נתיב יחסי (/uploads/file.jpg) ולא אבסולוטי עם דומיין
        // אבל נשמור על הלוגיקה שלך עם BASE_URL כרגע
        let imagePath = req.file ? `${BASE_URL}/uploads/${req.file.filename}` : null;
        
        console.log("📸 Image Path generated:", imagePath);

        let coordsToSave = map_coordinates || { top: '50%', left: '50%' };
        if (typeof coordsToSave === 'object') coordsToSave = JSON.stringify(coordsToSave);
        
        const initialSensor = JSON.stringify([{ top: '50%', left: '50%', size: '50px' }]);

        // שימוש ב-map_file_path
        const sql = 'INSERT INTO areas (room, description, map_file_path, map_coordinates, sensor_position, shade_state, current_position) VALUES (?, ?, ?, ?, ?, "AUTO", 0)';
        
        const [result] = await db.query(sql, [room, description, imagePath, coordsToSave, initialSensor]);
        
        if (req.io) req.io.emit('refresh_areas');

        console.log("✅ Area Created Successfully, ID:", result.insertId);
        res.status(201).json({ success: true, message: 'Area created', id: result.insertId });

    } catch (error) {
        console.error("❌ Create Area Error:", error);
        res.status(500).json({ success: false, message: 'Failed to create area.', error: error.message });
    }
};

// ... (פונקציות updateMapCoordinates, updateSensorPositions, deleteArea, updateAreaState נשארות זהות) ...
// (פשוט תוודא שאתה לא מוחק אותן מהקובץ הסופי)

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
        destination: req.file.destination
    });

    try {
        // בניית ה-URL
        const imagePath = `${BASE_URL}/uploads/${req.file.filename}`;
        console.log("🔗 Generated URL path:", imagePath);

        // שימוש ב-map_file_path (העמודה שאישרת שהיא הנכונה)
        console.log("🗄️ Executing DB Update on map_file_path...");
        await db.query('UPDATE areas SET map_file_path = ? WHERE id = ?', [imagePath, id]);
        
        console.log("✅ DB Update Successful");

        if (req.io) {
            req.io.emit('refresh_areas');
        }

        res.json({ success: true, message: 'Map image updated successfully.', imagePath });

    } catch (error) {
        console.error("❌❌❌ ERROR IN uploadMapImage ❌❌❌");
        console.error(error);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload image.',
            error: error.message 
        });
    }
};

// ... (פונקציות injectSimulationData וכו' נשארות זהות) ...
// כדי למנוע שגיאות ReferenceError, הוספתי כאן את שאר הייצואים החשובים בקיצור:

exports.updateMapCoordinates = async (req, res) => {
    /* העתק את הקוד הקיים שלך לכאן */
    const { id } = req.params;
    let { map_coordinates } = req.body;
    try {
        if (typeof map_coordinates === 'object') map_coordinates = JSON.stringify(map_coordinates);
        await db.query('UPDATE areas SET map_coordinates = ? WHERE id = ?', [map_coordinates, id]);
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'Map coordinates updated.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed.' });
    }
};

exports.updateSensorPositions = async (req, res) => {
    /* העתק את הקוד הקיים שלך לכאן */
    const { id } = req.params;
    let { sensor_position } = req.body;
    try {
        if (typeof sensor_position === 'object') sensor_position = JSON.stringify(sensor_position);
        await db.query('UPDATE areas SET sensor_position = ? WHERE id = ?', [sensor_position, id]);
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'Sensors updated.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed.' });
    }
};

exports.deleteArea = async (req, res) => {
    /* העתק את הקוד הקיים שלך לכאן */
    const { id } = req.params;
    try {
        await db.query('DELETE FROM logs WHERE area_id = ?', [id]);
        await db.query('DELETE FROM schedules WHERE area_id = ?', [id]);
        await db.query('DELETE FROM alerts WHERE area_id = ?', [id]);
        await db.query('DELETE FROM areas WHERE id = ?', [id]);
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'Area deleted.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed.' });
    }
};

exports.updateAreaState = async (req, res) => {
    /* העתק את הקוד הקיים שלך לכאן */
    const { id } = req.params;
    const { state, position } = req.body;
    try {
        let newPosition = position;
        if (newPosition === undefined) {
            if (state === 'OPEN') newPosition = 0;
            if (state === 'CLOSED') newPosition = 100;
        }
        let query = 'UPDATE areas SET shade_state = ?, current_position = ?';
        let params = [state, newPosition];
        if (state === 'AUTO') query += ', last_manual_change = NULL';
        else query += ', last_manual_change = NOW()';
        
        if (id === 'global') query += '';
        else { query += ' WHERE id = ?'; params.push(id); }

        await db.query(query, params);
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'State updated', newPosition });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed.' });
    }
};

exports.updateGlobalState = async (req, res) => {
    /* העתק את הקוד הקיים שלך לכאן */
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
        res.json({ success: true, message: 'Global state updated.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed.' });
    }
};

exports.injectSimulationData = async (req, res) => {
    /* העתק את הקוד הקיים שלך לכאן */
    const { id } = req.params;
    const { temperature, light } = req.body;
    try {
        await db.query('INSERT INTO logs (area_id, temperature, light_intensity, current_position) VALUES (?, ?, ?, (SELECT current_position FROM areas WHERE id = ?))', [id, temperature, light, id]);
        const io = req.app.get('io'); 
        await exports.evaluateAutomation(id, temperature, light, io);
        res.json({ success: true, message: 'Simulation processed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed.' });
    }
};