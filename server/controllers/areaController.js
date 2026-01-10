const db = require('../config/db');

// קבוע בסיס לכתובות תמונה
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// ==========================================
// 1. שליפת כל האזורים (READ)
// ==========================================
exports.getAllAreas = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT *, room as name FROM areas');
        const areas = rows.map(area => {
            // המרה בטוחה של קואורדינטות JSON
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

// ==========================================
// 2. יצירת אזור חדש (CREATE)
// ==========================================
exports.createArea = async (req, res) => {
    console.log("📝 Create Area Request Received");
    try {
        let { room, description, map_coordinates } = req.body;
        
        let imagePath = req.file ? `${BASE_URL}/uploads/${req.file.filename}` : null;
        
        let coordsToSave = map_coordinates || { top: '50%', left: '50%' };
        if (typeof coordsToSave === 'object') coordsToSave = JSON.stringify(coordsToSave);
        
        const initialSensor = JSON.stringify([{ top: '50%', left: '50%', size: '50px' }]);

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

// ==========================================
// 3. העלאת תמונה (UPLOAD IMAGE)
// ==========================================
exports.uploadMapImage = async (req, res) => {
    console.log("📸 Upload Controller: Start processing request for Area ID:", req.params.id);

    const { id } = req.params;
    
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    try {
        const imagePath = `${BASE_URL}/uploads/${req.file.filename}`;
        
        // עדכון הנתיב ב-DB
        await db.query('UPDATE areas SET map_file_path = ? WHERE id = ?', [imagePath, id]);
        
        if (req.io) req.io.emit('refresh_areas');

        res.json({ success: true, message: 'Map image updated successfully.', imagePath });

    } catch (error) {
        console.error("❌ Upload Error:", error);
        res.status(500).json({ success: false, message: 'Failed to upload image.' });
    }
};

// ==========================================
// 4. עדכונים שונים (Coordinates, Sensors, State)
// ==========================================

exports.updateMapCoordinates = async (req, res) => {
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

exports.updateAreaState = async (req, res) => {
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
        
        if (id !== 'global') { 
            query += ' WHERE id = ?'; 
            params.push(id); 
        }

        await db.query(query, params);
        if (req.io) req.io.emit('refresh_areas');
        res.json({ success: true, message: 'State updated', newPosition });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed.' });
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
        res.json({ success: true, message: 'Global state updated.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed.' });
    }
};

exports.deleteArea = async (req, res) => {
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

// ==========================================
// 5. ניהול סימולציה (התיקון הקריטי! 🧪)
// ==========================================
exports.updateAreaSimulation = async (req, res) => {
    try {
        const { id } = req.params;
        // קולטים את הפרמטרים מה-Frontend
        // תומך גם ב-is_active וגם ב-isActive למניעת בלבול
        let { is_active, isActive, temperature, light } = req.body;

        if (is_active === undefined && isActive !== undefined) {
            is_active = isActive;
        }

        // ערכי ברירת מחדל אם לא נשלחו
        if (temperature === undefined) temperature = 25;
        if (light === undefined) light = 500;

        console.log(`🔌 API REQUEST: Update Sim for Room ${id} -> Active: ${is_active}, Temp: ${temperature}`);

        // עדכון הדאטה-בייס - זה מה שהיה חסר!
        await db.query(
            `UPDATE areas 
             SET is_simulation = ?, sim_temp = ?, sim_light = ? 
             WHERE id = ?`,
            [is_active, temperature, light, id]
        );

        // עדכון מיידי לכל הלקוחות
        if (req.io) req.io.emit('refresh_areas');

        res.json({ success: true, message: 'Simulation Updated' });

    } catch (error) {
        console.error("Controller Error (Simulation):", error);
        res.status(500).json({ success: false, message: 'Server Error during simulation update' });
    }
};