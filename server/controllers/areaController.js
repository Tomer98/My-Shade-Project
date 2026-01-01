const db = require('../config/db');

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
        let decision = null;
        let newPosition = null;

        if (temperature > 30 && light > 70) {
            decision = 'CLOSED';
            newPosition = 100;
        } else if (temperature < 25 && light < 50) {
            decision = 'OPEN';
            newPosition = 0;
        }

        // 3. ביצוע (רק אם צריך שינוי מהמצב הקיים)
        if (decision && newPosition !== currentPos) {
            console.log(`🤖 AI ACTION: Temp ${temperature}°C, Light ${light}% -> Setting to ${decision}`);
            
            // עדכון בסיס הנתונים!
            await db.query(
                'UPDATE areas SET shade_state = "AUTO", current_position = ? WHERE id = ?',
                [newPosition, areaId]
            );
        } else {
            console.log(`🧠 AI Check: No change needed (Temp ${temperature}, Light ${light}).`);
        }

    } catch (error) {
        console.error("Automation Error:", error);
    }
};

// שליפת כל החדרים
exports.getAllAreas = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM areas');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// עדכון מצב חדר ספציפי (הפונקציה של הכפתורים באתר)
exports.updateAreaState = async (req, res) => {
    const { id } = req.params;
    const { state, position } = req.body;

    // לוג דיבוג
    console.log(`📡 Request received for Room ${id}: State="${state}", Position=${position}`);

    try {
        let newPosition = position;
        
        // המרה אוטומטית
        if (newPosition === undefined) {
            if (state === 'OPEN') newPosition = 0;
            if (state === 'CLOSED') newPosition = 100;
        }

        let query = 'UPDATE areas SET shade_state = ?, current_position = ?';
        const params = [state, newPosition];

        // --- ניהול הזיכרון (Manual Override) ---
        if (state === 'AUTO') {
            console.log('🤖 Switching to AUTO -> Cleaning manual override memory (NULL).');
            query += ', last_manual_change = NULL'; // מחיקת החסימה
        } else {
            console.log('✋ Manual change detected -> Saving timestamp.');
            query += ', last_manual_change = NOW()'; // יצירת חסימה
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.query(query, params);
        
        res.json({ success: true, message: 'State updated', newPosition });
    } catch (error) {
        console.error('Update Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
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
        
        res.json({ success: true, message: 'Global state updated successfully' });
    } catch (error) {
        console.error('Global Update Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};