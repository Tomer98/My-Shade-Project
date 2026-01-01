const db = require('../config/db');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    // כאן אפשר להוסיף הצפנה עם bcrypt בהמשך.
    // כרגע נבדוק מול בסיס הנתונים בצורה ישירה או נשתמש במשתמשי דמו אם אין טבלה.
    
    try {
        // בדיקה מול SQL
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length > 0) {
            const user = users[0];
            // בדיקת סיסמה (פשוטה כרגע)
            if (password === user.password) {
                // מחיקת הסיסמה מהתשובה שחוזרת ללקוח
                const { password, ...userWithoutPassword } = user;
                return res.json({ success: true, user: userWithoutPassword });
            }
        }

        // --- גיבוי: משתמשים "קשיחים" (Hardcoded) למקרה שאין עדיין טבלת משתמשים ---
        if (username === 'alice' && password === 'admin123') {
            return res.json({ success: true, user: { username: 'alice', role: 'admin' } });
        }
        if (username === 'bob' && password === 'maint123') {
            return res.json({ success: true, user: { username: 'bob', role: 'maintenance' } });
        }
        // -------------------------------------------------------------------------

        return res.json({ success: false, message: 'Invalid credentials' });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};