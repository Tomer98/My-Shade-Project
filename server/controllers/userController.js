/**
 * User Controller
 * Handles user authentication (Login) and administrative management of users.
 */
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Secret key for JWT signing
const SECRET_KEY = process.env.JWT_SECRET || "my_secret_key";

/**
 * Fetch all users (Excluding passwords for security).
 */
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username, role, created_at FROM users');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

/**
 * Create a new user (Staff/Admin).
 */
exports.createUser = async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing required user fields' });
    }

    try {
        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role]);
        res.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ success: false, message: 'Username might already exist or server error' });
    }
};

/**
 * Delete a user by ID.
 */
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};