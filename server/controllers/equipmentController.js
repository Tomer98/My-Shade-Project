/**
 * Equipment Controller
 * Serviceable items installed in a room. A mission can target a specific piece
 * of equipment, which is how the maintenance history ties back to the asset
 * rather than just the location.
 */
const db = require('../config/db');

const VALID_STATUSES = ['Operational', 'NeedsService', 'OutOfOrder'];

/**
 * List equipment for the caller's company, with its room and a count of the
 * missions still outstanding against it.
 * Supports ?area_id= and ?status= filters.
 */
exports.getAllEquipment = async (req, res) => {
    try {
        const conditions = ['e.company_id = ?'];
        const params = [req.user.companyId ?? 1];

        if (req.query.area_id) {
            conditions.push('e.area_id = ?');
            params.push(req.query.area_id);
        }
        if (req.query.status) {
            conditions.push('e.status = ?');
            params.push(req.query.status);
        }

        const [rows] = await db.query(
            `SELECT e.*, a.room AS area_name,
                    COUNT(m.id) AS open_missions
             FROM equipment e
             LEFT JOIN areas a ON e.area_id = a.id
             LEFT JOIN missions m
                    ON m.equipment_id = e.id AND m.status IN ('Open', 'InProgress')
             WHERE ${conditions.join(' AND ')}
             GROUP BY e.id
             ORDER BY FIELD(e.status, 'OutOfOrder', 'NeedsService', 'Operational'), e.name`,
            params
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch equipment' });
    }
};

/**
 * Register a new piece of equipment.
 */
exports.createEquipment = async (req, res) => {
    const { name, serial_number, equipment_type, area_id, installed_at, status } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: 'Equipment name is required' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `status must be one of: ${VALID_STATUSES.join(', ')}`
        });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO equipment
             (name, serial_number, equipment_type, area_id, company_id, status, installed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                serial_number || null,
                equipment_type || null,
                area_id || null,
                req.user.companyId ?? 1,
                status || 'Operational',
                installed_at || null,
            ]
        );

        if (req.io) req.io.emit('refresh_equipment');
        res.status(201).json({ success: true, message: 'Equipment added', id: result.insertId });
    } catch (error) {
        console.error('Error creating equipment:', error);
        res.status(500).json({ success: false, message: 'Failed to add equipment' });
    }
};

/**
 * Update an item — typically its service status or the room it now lives in.
 */
exports.updateEquipment = async (req, res) => {
    const { id } = req.params;
    const { name, serial_number, equipment_type, area_id, status, installed_at } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `status must be one of: ${VALID_STATUSES.join(', ')}`
        });
    }

    // Only touch the fields the caller actually sent
    const fields = [];
    const params = [];
    const set = (column, value) => {
        if (value !== undefined) { fields.push(`${column} = ?`); params.push(value); }
    };

    set('name', name);
    set('serial_number', serial_number);
    set('equipment_type', equipment_type);
    set('area_id', area_id);
    set('status', status);
    set('installed_at', installed_at);

    if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided' });
    }

    try {
        params.push(id, req.user.companyId ?? 1);
        const [result] = await db.query(
            `UPDATE equipment SET ${fields.join(', ')} WHERE id = ? AND company_id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Equipment not found' });
        }

        if (req.io) req.io.emit('refresh_equipment');
        res.json({ success: true, message: 'Equipment updated' });
    } catch (error) {
        console.error('Error updating equipment:', error);
        res.status(500).json({ success: false, message: 'Failed to update equipment' });
    }
};

/**
 * Remove an item. Missions that referenced it keep their history; the link is
 * cleared rather than the mission deleted.
 */
exports.deleteEquipment = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE missions SET equipment_id = NULL WHERE equipment_id = ?', [id]);

        const [result] = await db.query(
            'DELETE FROM equipment WHERE id = ? AND company_id = ?',
            [id, req.user.companyId ?? 1]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Equipment not found' });
        }

        if (req.io) req.io.emit('refresh_equipment');
        res.json({ success: true, message: 'Equipment deleted' });
    } catch (error) {
        console.error('Error deleting equipment:', error);
        res.status(500).json({ success: false, message: 'Failed to delete equipment' });
    }
};
