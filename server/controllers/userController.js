const db = require('../config/db');
const jwt = require('jsonwebtoken'); // <--- חובה לייבא את זה!

// מפתח גיבוי זהה למה ששמנו ב-auth.js
const SECRET_KEY = process.env.JWT_SECRET || "my_secret_key";

// התחברות (Login)
exports.login = async (req, res) => {
    const { username, password } = req.body;
    
    console.log("🔍 Login Attempt:", username);

    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

        if (users.length === 0) {
            console.log("❌ User not found");
            return res.status(401).json({ success: false, message: 'משתמש לא נמצא' });
        }

        const user = users[0];
        
        // בדיקת סיסמה (כפי שהיה אצלך)
        if (password === user.password) {
            console.log("✅ Password match! Generating Token...");

            // --- התיקון הקריטי: יצירת הטוקן ---
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                SECRET_KEY,
                { expiresIn: '24h' }
            );

            // שולחים את הטוקן חזרה ללקוח
            res.json({ 
                success: true, 
                token: token, // <--- הנה הוא!
                user: { id: user.id, username: user.username, role: user.role } 
            });

        } else {
            console.log("❌ Password mismatch");
            res.status(401).json({ success: false, message: 'סיסמה שגויה' });
        }
    } catch (error) {
        console.error("💥 Server Error:", error);
        res.status(500).json({ success: false, message: 'שגיאת שרת' });
    }
};

// קבלת כל המשתמשים (Admin Only)
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username, role, created_at FROM users');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
};

// יצירת משתמש חדש
exports.createUser = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role]);
        res.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error creating user' });
    }
};

// מחיקת משתמש
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
};