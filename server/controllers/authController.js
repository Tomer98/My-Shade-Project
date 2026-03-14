/**
 * Authentication Controller
 * Handles user login and generates JWT tokens for secure access.
 */
const db = require('../config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

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
        // 1. Check if user exists in database
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const user = users[0];

        // 2. Validate Password
        // Note: In production, use bcrypt.compare(password, user.password)
        if (password !== user.password) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        // 3. Generate JWT Token
        // The token contains the user ID and role for the middleware to check
        const secretKey = process.env.JWT_SECRET || "my_secret_key";
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            secretKey,
            { expiresIn: '24h' } // Token valid for 24 hours
        );

        // 4. Prepare User object for the frontend (excluding password)
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