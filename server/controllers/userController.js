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
        // open_missions is the workload signal a manager uses to judge availability.
        // Results are scoped to the caller's company so tenants stay separate.
        const [rows] = await db.query(
            `SELECT u.id, u.username, u.email, u.role, u.status, u.speciality, u.work_area,
                    u.is_available, u.company_id, c.name AS company_name, u.created_at,
                    COUNT(m.id) AS open_missions
             FROM users u
             LEFT JOIN companies c ON u.company_id = c.id
             LEFT JOIN missions m
                    ON m.assigned_to = u.id AND m.status IN ('Open', 'InProgress')
             WHERE u.company_id = ?
             GROUP BY u.id
             ORDER BY FIELD(u.status, 'Pending', 'Active', 'Rejected'), u.id`,
            [req.user.companyId ?? 1]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

/**
 * Approve or reject a self-registered account.
 * @param {string} req.params.id - The user awaiting review.
 * @param {string} req.body.status - 'Active' to approve, 'Rejected' to refuse.
 */
exports.reviewUser = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be Active or Rejected' });
    }

    try {
        const [result] = await db.query(
            'UPDATE users SET status = ? WHERE id = ? AND company_id = ?',
            [status, id, req.user.companyId ?? 1]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: status === 'Active' ? 'User approved' : 'Registration rejected'
        });
    } catch (error) {
        console.error("Error reviewing user:", error);
        res.status(500).json({ success: false, message: 'Failed to review user' });
    }
};

/**
 * Create a new user (Staff/Admin).
 */
exports.createUser = async (req, res) => {
    const { username, password, role, speciality, work_area } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing required user fields' });
    }

    try {
        // Hash the password before storing — bcrypt adds a random salt automatically
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Admin-created accounts are usable immediately — the approval step
        // exists for self-registration, not for accounts an admin made itself.
        await db.query(
            `INSERT INTO users (username, password, role, speciality, work_area, company_id, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
            [username, hashedPassword, role, speciality || null, work_area || null,
             req.user.companyId ?? 1]
        );
        res.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ success: false, message: 'Username might already exist or server error' });
    }
};

/**
 * Update an existing user's role (permission promotion/demotion).
 * @param {string} req.params.id - The unique ID of the user to update.
 * @param {string} req.body.role - The new role to assign (admin/maintenance/planner).
 */
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { role, speciality, work_area, is_available } = req.body;

    // Build the SET clause from whichever fields the caller actually sent
    const fields = [];
    const params = [];

    if (role !== undefined) { fields.push('role = ?'); params.push(role); }
    if (speciality !== undefined) { fields.push('speciality = ?'); params.push(speciality); }
    if (work_area !== undefined) { fields.push('work_area = ?'); params.push(work_area); }
    if (is_available !== undefined) { fields.push('is_available = ?'); params.push(is_available ? 1 : 0); }

    if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided' });
    }

    try {
        params.push(id);
        const [result] = await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
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