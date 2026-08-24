/**
 * Guide Controller
 * Knowledge base: workers author guides, a manager/admin approves them before
 * they become visible to everyone, and all users can rate them.
 */
const db = require('../config/db');
const { uploadFile } = require('../services/storageService');

/**
 * List guides ordered by average rating (highest first), then most recent.
 * Regular users see only approved guides; managers/admins see everything so
 * they can work through the approval queue.
 */
exports.getGuides = async (req, res) => {
    try {
        const canSeeUnapproved = req.user.role === 'admin' || req.user.role === 'maintenance';
        const where = canSeeUnapproved ? '' : "WHERE g.status = 'Approved'";

        const [rows] = await db.query(
            `SELECT g.*,
                    u.username AS author_name,
                    COALESCE(AVG(r.rating), 0) AS avg_rating,
                    COUNT(r.id) AS rating_count
             FROM guides g
             LEFT JOIN users u ON g.author_id = u.id
             LEFT JOIN guide_ratings r ON r.guide_id = g.id
             ${where}
             GROUP BY g.id
             ORDER BY avg_rating DESC, g.created_at DESC`
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching guides:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch guides' });
    }
};

/**
 * Create a guide. It starts as Pending until a manager/admin approves it.
 */
exports.createGuide = async (req, res) => {
    const { title, content } = req.body;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required' });
    }

    try {
        const mediaPath = req.file ? await uploadFile(req.file) : null;

        const [result] = await db.query(
            'INSERT INTO guides (title, content, media_path, author_id) VALUES (?, ?, ?, ?)',
            [title, content || null, mediaPath, req.user.id]
        );

        if (req.io) req.io.emit('refresh_guides');
        res.status(201).json({
            success: true,
            message: 'Guide submitted for approval',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating guide:', error);
        res.status(500).json({ success: false, message: 'Failed to create guide' });
    }
};

/**
 * Approve or reject a pending guide.
 */
exports.reviewGuide = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be Approved or Rejected' });
    }

    try {
        const [result] = await db.query(
            'UPDATE guides SET status = ?, approved_by = ? WHERE id = ?',
            [status, req.user.id, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Guide not found' });
        }

        if (req.io) req.io.emit('refresh_guides');
        res.json({ success: true, message: `Guide ${status.toLowerCase()}` });
    } catch (error) {
        console.error('Error reviewing guide:', error);
        res.status(500).json({ success: false, message: 'Failed to review guide' });
    }
};

/**
 * Rate a guide 1–5. Re-rating replaces the user's previous score.
 */
exports.rateGuide = async (req, res) => {
    const { id } = req.params;
    const rating = parseInt(req.body.rating, 10);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'rating must be an integer between 1 and 5' });
    }

    try {
        await db.query(
            `INSERT INTO guide_ratings (guide_id, user_id, rating) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
            [id, req.user.id, rating]
        );

        if (req.io) req.io.emit('refresh_guides');
        res.json({ success: true, message: 'Rating saved' });
    } catch (error) {
        console.error('Error rating guide:', error);
        res.status(500).json({ success: false, message: 'Failed to save rating' });
    }
};

/**
 * Delete a guide. Authors may remove their own; admins may remove any.
 */
exports.deleteGuide = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT author_id FROM guides WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Guide not found' });
        }

        if (req.user.role !== 'admin' && rows[0].author_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'You can only delete your own guides' });
        }

        await db.query('DELETE FROM guides WHERE id = ?', [id]);
        if (req.io) req.io.emit('refresh_guides');
        res.json({ success: true, message: 'Guide deleted' });
    } catch (error) {
        console.error('Error deleting guide:', error);
        res.status(500).json({ success: false, message: 'Failed to delete guide' });
    }
};
