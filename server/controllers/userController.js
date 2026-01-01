const db = require('../config/db');

// התחברות (Login)
exports.login = async (req, res) => {
    const { username, password } = req.body;
    
    // 1. הדפסה: מה הגיע מהאתר?
    console.log("🔍 Login Attempt:");
    console.log("   Username received:", username);
    console.log("   Password received:", password);

    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

        // 2. הדפסה: מה חזר מהדאטה-בייס?
        console.log("   DB Result found:", users.length, "users");

        if (users.length === 0) {
            console.log("❌ Error: User not found in DB!");
            return res.status(401).json({ success: false, message: 'משתמש לא נמצא' });
        }

        const user = users[0];
        
        // 3. הדפסה: השוואת סיסמאות
        console.log("   DB Password:", user.password);
        console.log("   Input Password:", password);

        if (password === user.password) {
            console.log("✅ Success: Login approved!");
            res.json({ 
                success: true, 
                user: { id: user.id, username: user.username, role: user.role } 
            });
        } else {
            console.log("❌ Error: Password mismatch!");
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
        // לא מחזירים סיסמאות!
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