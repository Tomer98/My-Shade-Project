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

        // A self-registered account cannot be used until an admin approves it.
        // Checked after the password so the response reveals nothing to guessers.
        if (user.status === 'Pending') {
            return res.status(403).json({
                success: false,
                message: 'Your account is waiting for administrator approval.'
            });
        }
        if (user.status === 'Rejected') {
            return res.status(403).json({
                success: false,
                message: 'Your registration was not approved. Please contact an administrator.'
            });
        }

        const secretKey = process.env.JWT_SECRET;
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                companyId: user.company_id,
            },
            secretKey,
            { expiresIn: '24h' }
        );

        const { password: _, ...userWithoutPassword } = user;

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
 * Sign Up
 * Self-registration for a new maintenance worker. The account is created in
 * the Pending state and cannot log in until an administrator approves it,
 * which is the "user approval" step the specification gives the admin role.
 */
exports.signup = async (req, res) => {
    const { username, password, email, company_id, speciality, work_area } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({
            success: false,
            message: 'Username, password and email are required'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    try {
        const [existing] = await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'That username or email is already registered'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Self-registration always creates a maintenance worker: granting
        // anything higher is an administrator's decision, not the applicant's.
        await db.query(
            `INSERT INTO users (username, password, email, role, status, company_id, speciality, work_area)
             VALUES (?, ?, ?, 'maintenance', 'Pending', ?, ?, ?)`,
            [username, hashedPassword, email, company_id || 1, speciality || null, work_area || null]
        );

        return res.status(201).json({
            success: true,
            message: 'Registration received. An administrator will review your account.'
        });
    } catch (error) {
        console.error('❌ Signup Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error during signup' });
    }
};

/**
 * List the companies a new user can register against.
 * Public because it populates the signup form.
 */
exports.getCompanies = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name FROM companies ORDER BY name');
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('❌ Companies Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch companies' });
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