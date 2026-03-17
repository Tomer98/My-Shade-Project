/**
 * User Controller
 * Handles administrative management of users.
 */
const db = require('../config/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10; // Cost factor: higher = slower to crack, slower to hash

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
        // Hash the password before storing — bcrypt adds a random salt automatically
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );
        res.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ success: false, message: 'Username might already exist or server error' });
    }
};

/**
 * Delete a user by ID.
 * @param {string} req.params.id - The unique ID of the user to delete.
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