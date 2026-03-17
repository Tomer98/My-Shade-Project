/**
 * Authentication Controller
 * Handles user login and generates JWT tokens for secure access.
 */
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

/**
 * Login User
 * Validates credentials against the database and returns a signed JWT token.
 */
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please provide username and password' });
    }

    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const user = users[0];

        // bcrypt.compare() hashes the input and compares it to the stored hash
        // Returns true/false — never exposes the original password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const secretKey = process.env.JWT_SECRET;
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            secretKey,
            { expiresIn: '24h' }
        );

        const { password: _, ...userWithoutPassword } = user;

        console.log(`🔑 User authenticated: ${username} (${user.role})`);

        return res.json({
            success: true,
            token,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error("❌ Login Error:", error);
        return res.status(500).json({ success: false, message: 'Internal server error during login' });
    }
};