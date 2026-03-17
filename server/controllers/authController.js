/**
 * Authentication Controller
 * Handles user login and generates JWT tokens for secure access.
 */
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');

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
        const [users] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);

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

/**
 * Forgot Password
 * Generates a reset token, stores it in the DB, and emails the user a reset link.
 * @param {string} req.body.email - The user's email address.
 */
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        // Always return success — don't reveal whether the email exists (security)
        if (users.length === 0) {
            return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
            [token, expires, email]
        );

        await sendPasswordResetEmail(email, token);

        return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('❌ Forgot Password Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * Reset Password
 * Validates the reset token, hashes the new password, and clears the token.
 * @param {string} req.body.token - The reset token from the email link.
 * @param {string} req.body.newPassword - The new password to set.
 */
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    try {
        const [users] = await db.query(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hashedPassword, users[0].id]
        );

        return res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('❌ Reset Password Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};