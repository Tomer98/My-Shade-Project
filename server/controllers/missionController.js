/**
 * Mission Controller
 * Handles maintenance missions: the recurring field jobs a maintenance worker
 * performs at an area, tracked as a checklist of subtasks.
 */
const db = require('../config/db');
const { uploadFile } = require('../services/storageService');

/**
 * Emit a log entry and broadcast it to connected clients.
 */
const logMissionEvent = async (req, areaId, actionType, roomName) => {
    try {
        await db.query(
            'INSERT INTO logs (area_id, temperature, light_intensity, current_position, action_type) VALUES (?, 0, 0, 0, ?)',
            [areaId, actionType]
        );
        if (req.io) {
            req.io.emit('new_log', {
                action_type: actionType,
                room: roomName || 'System',
                recorded_at: new Date()
            });
            req.io.emit('refresh_missions');
        }
    } catch (err) {
        console.error('⚠️ Mission log failed:', err.message);
    }
};

/**
 * Get missions with their subtasks and area/assignee details.
 * Maintenance users see only their own missions; managers/admins see all.
 * Optional ?scope=today limits results to missions due today or earlier.
 */
exports.getMissions = async (req, res) => {
    try {
        const conditions = [];
        const params = [];

        // A maintenance worker only ever sees work assigned to them
        if (req.user.role === 'maintenance') {
            conditions.push('m.assigned_to = ?');
            params.push(req.user.id);
        }

        if (req.query.scope === 'today') {
            conditions.push('m.scheduled_date <= CURDATE()');
            conditions.push("m.status IN ('Open', 'InProgress')");
        }

        if (req.query.status) {
            conditions.push('m.status = ?');
            params.push(req.query.status);
        }

        // Always confine results to the caller's company
        conditions.push('a.company_id = ?');
        params.push(req.user.companyId ?? 1);

        const [missions] = await db.query(
            `SELECT m.*, a.room AS room_name, a.latitude, a.longitude,
                    u.username AS assigned_to_name, e.name AS equipment_name
             FROM missions m
             JOIN areas a ON m.area_id = a.id
             LEFT JOIN users u ON m.assigned_to = u.id
             LEFT JOIN equipment e ON m.equipment_id = e.id
             ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
             ORDER BY m.scheduled_date ASC, m.id ASC`,
            params
        );

        if (missions.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // Attach subtasks in one query rather than N queries
        const ids = missions.map(m => m.id);
        const [subtasks] = await db.query(
            `SELECT * FROM mission_subtasks WHERE mission_id IN (?) ORDER BY sort_order ASC, id ASC`,
            [ids]
        );

        const byMission = {};
        for (const st of subtasks) {
            (byMission[st.mission_id] ||= []).push(st);
        }

        const data = missions.map(m => ({ ...m, subtasks: byMission[m.id] || [] }));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching missions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch missions' });
    }
};

/**
 * Location history for an area: previously completed/failed missions,
 * including who visited and what they reported.
 */
exports.getAreaHistory = async (req, res) => {
    const { areaId } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT m.id, m.title, m.status, m.completed_at, m.scheduled_date,
                    u.username AS performed_by
             FROM missions m
             LEFT JOIN users u ON m.assigned_to = u.id
             WHERE m.area_id = ? AND m.status IN ('Completed', 'Failed')
             ORDER BY m.completed_at DESC
             LIMIT 20`,
            [areaId]
        );

        if (rows.length === 0) return res.json({ success: true, data: [] });

        const [subtasks] = await db.query(
            `SELECT mission_id, title, status, comment, photo_path
             FROM mission_subtasks
             WHERE mission_id IN (?) AND (comment IS NOT NULL OR photo_path IS NOT NULL)`,
            [rows.map(r => r.id)]
        );

        const notesByMission = {};
        for (const st of subtasks) {
            (notesByMission[st.mission_id] ||= []).push(st);
        }

        res.json({
            success: true,
            data: rows.map(r => ({ ...r, notes: notesByMission[r.id] || [] }))
        });
    } catch (error) {
        console.error('Error fetching area history:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
};

/**
 * Create a mission with its subtask checklist.
 */
exports.createMission = async (req, res) => {
    const { area_id, title, description, frequency_days, scheduled_date,
            assigned_to, subtasks, equipment_id } = req.body;

    if (!area_id || !title || !scheduled_date) {
        return res.status(400).json({ success: false, message: 'area_id, title and scheduled_date are required' });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO missions (area_id, title, description, frequency_days, scheduled_date, assigned_to, created_by, equipment_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [area_id, title, description || null, frequency_days || 30, scheduled_date,
             assigned_to || null, req.user.id, equipment_id || null]
        );

        const missionId = result.insertId;

        if (Array.isArray(subtasks) && subtasks.length > 0) {
            const values = subtasks.map((st, i) => [missionId, typeof st === 'string' ? st : st.title, i]);
            await db.query(
                'INSERT INTO mission_subtasks (mission_id, title, sort_order) VALUES ?',
                [values]
            );
        }

        const [areaRows] = await db.query('SELECT room FROM areas WHERE id = ?', [area_id]);
        await logMissionEvent(req, area_id, 'MISSION_CREATED', areaRows[0]?.room);

        res.status(201).json({ success: true, message: 'Mission created', id: missionId });
    } catch (error) {
        console.error('Error creating mission:', error);
        res.status(500).json({ success: false, message: 'Failed to create mission' });
    }
};

/**
 * Assign (or reassign) a mission to a maintenance worker.
 */
exports.assignMission = async (req, res) => {
    const { id } = req.params;
    const { assigned_to } = req.body;

    if (!assigned_to) {
        return res.status(400).json({ success: false, message: 'assigned_to is required' });
    }

    try {
        const [result] = await db.query(
            "UPDATE missions SET assigned_to = ?, status = 'Open' WHERE id = ?",
            [assigned_to, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }
        if (req.io) req.io.emit('refresh_missions');
        res.json({ success: true, message: 'Mission assigned' });
    } catch (error) {
        console.error('Error assigning mission:', error);
        res.status(500).json({ success: false, message: 'Failed to assign mission' });
    }
};

/**
 * Update a single subtask: mark it Done or Failed, with an explanatory comment.
 * A worker may only update subtasks on a mission assigned to them.
 */
exports.updateSubtask = async (req, res) => {
    const { subtaskId } = req.params;
    const { status, comment } = req.body;

    if (!['Pending', 'Done', 'Failed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be Pending, Done or Failed' });
    }

    // The spec requires an explanation whenever a subtask cannot be completed
    if (status === 'Failed' && !comment) {
        return res.status(400).json({ success: false, message: 'A comment is required when marking a subtask as failed' });
    }

    try {
        const [rows] = await db.query(
            `SELECT s.title AS subtask_title, m.id AS mission_id, m.title AS mission_title,
                    m.assigned_to, m.area_id, a.room AS room_name
             FROM mission_subtasks s
             JOIN missions m ON s.mission_id = m.id
             JOIN areas a ON m.area_id = a.id
             WHERE s.id = ?`,
            [subtaskId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Subtask not found' });
        }

        const info = rows[0];

        if (req.user.role === 'maintenance' && info.assigned_to !== req.user.id) {
            return res.status(403).json({ success: false, message: 'This mission is not assigned to you' });
        }

        const photoPath = req.file ? await uploadFile(req.file) : null;

        await db.query(
            `UPDATE mission_subtasks
             SET status = ?, comment = ?, photo_path = COALESCE(?, photo_path)
             WHERE id = ?`,
            [status, comment || null, photoPath, subtaskId]
        );

        // Any activity on a subtask moves the parent mission into progress
        await db.query(
            "UPDATE missions SET status = 'InProgress' WHERE id = ? AND status = 'Open'",
            [info.mission_id]
        );

        // A blocked subtask raises a service ticket automatically, pre-filled with
        // the location, time and description the manager needs to act on it.
        let ticketId = null;
        if (status === 'Failed') {
            const description =
                `[Auto] ${info.mission_title} → ${info.subtask_title}: ${comment} ` +
                `(reported ${new Date().toLocaleString()})`;

            const [ticket] = await db.query(
                `INSERT INTO alerts (area_id, created_by, description, priority, status)
                 VALUES (?, ?, ?, 'High', 'Open')`,
                [info.area_id, req.user.id, description]
            );
            ticketId = ticket.insertId;

            await logMissionEvent(req, info.area_id, 'NEW_ALERT', info.room_name);
            if (req.io) req.io.emit('refresh_alerts');
        }

        if (req.io) req.io.emit('refresh_missions');
        res.json({ success: true, message: 'Subtask updated', ticketId, photoPath });
    } catch (error) {
        console.error('Error updating subtask:', error);
        res.status(500).json({ success: false, message: 'Failed to update subtask' });
    }
};

/**
 * Finish a mission. If every subtask is Done the mission is Completed and the
 * next occurrence is scheduled automatically (frequency_days ahead). If any
 * subtask Failed, the mission is marked Failed and returns to the manager.
 */
exports.completeMission = async (req, res) => {
    const { id } = req.params;

    try {
        const [missions] = await db.query(
            `SELECT m.*, a.room AS room_name FROM missions m
             JOIN areas a ON m.area_id = a.id WHERE m.id = ?`,
            [id]
        );

        if (missions.length === 0) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }

        const mission = missions[0];

        if (req.user.role === 'maintenance' && mission.assigned_to !== req.user.id) {
            return res.status(403).json({ success: false, message: 'This mission is not assigned to you' });
        }

        const [subtasks] = await db.query(
            'SELECT status FROM mission_subtasks WHERE mission_id = ?',
            [id]
        );

        const hasFailure = subtasks.some(s => s.status === 'Failed');
        const allDone = subtasks.length > 0 && subtasks.every(s => s.status === 'Done');

        if (!hasFailure && !allDone) {
            return res.status(400).json({
                success: false,
                message: 'Every subtask must be marked Done or Failed before finishing the mission'
            });
        }

        const finalStatus = hasFailure ? 'Failed' : 'Completed';

        await db.query(
            'UPDATE missions SET status = ?, completed_at = NOW() WHERE id = ?',
            [finalStatus, id]
        );

        let nextMissionId = null;

        // A clean completion schedules the next visit and copies the checklist
        if (finalStatus === 'Completed') {
            const [next] = await db.query(
                `INSERT INTO missions (area_id, title, description, frequency_days, scheduled_date, assigned_to, created_by)
                 VALUES (?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?)`,
                [mission.area_id, mission.title, mission.description, mission.frequency_days,
                 mission.frequency_days, mission.assigned_to, mission.created_by]
            );
            nextMissionId = next.insertId;

            const [templateTasks] = await db.query(
                'SELECT title, sort_order FROM mission_subtasks WHERE mission_id = ? ORDER BY sort_order',
                [id]
            );
            if (templateTasks.length > 0) {
                await db.query(
                    'INSERT INTO mission_subtasks (mission_id, title, sort_order) VALUES ?',
                    [templateTasks.map(t => [nextMissionId, t.title, t.sort_order])]
                );
            }
        }

        await logMissionEvent(
            req,
            mission.area_id,
            finalStatus === 'Completed' ? 'MISSION_COMPLETED' : 'MISSION_FAILED',
            mission.room_name
        );

        res.json({
            success: true,
            message: finalStatus === 'Completed'
                ? 'Mission completed. Next visit scheduled.'
                : 'Mission marked as failed and returned to the manager.',
            status: finalStatus,
            nextMissionId
        });
    } catch (error) {
        console.error('Error completing mission:', error);
        res.status(500).json({ success: false, message: 'Failed to complete mission' });
    }
};

/**
 * 'Close day': push every still-open mission for the current user to tomorrow.
 * Per the spec these roll over with an increased urgency (shorter frequency).
 */
exports.closeDay = async (req, res) => {
    try {
        const conditions = ["status IN ('Open', 'InProgress')", 'scheduled_date <= CURDATE()'];
        const params = [];

        if (req.user.role === 'maintenance') {
            conditions.push('assigned_to = ?');
            params.push(req.user.id);
        }

        const [result] = await db.query(
            `UPDATE missions
             SET scheduled_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY),
                 frequency_days = GREATEST(1, FLOOR(frequency_days / 2))
             WHERE ${conditions.join(' AND ')}`,
            params
        );

        if (req.io) req.io.emit('refresh_missions');
        res.json({
            success: true,
            message: `Day closed. ${result.affectedRows} mission(s) moved to tomorrow.`,
            moved: result.affectedRows
        });
    } catch (error) {
        console.error('Error closing day:', error);
        res.status(500).json({ success: false, message: 'Failed to close the day' });
    }
};

/**
 * Delete a mission.
 */
exports.deleteMission = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM missions WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }
        if (req.io) req.io.emit('refresh_missions');
        res.json({ success: true, message: 'Mission deleted' });
    } catch (error) {
        console.error('Error deleting mission:', error);
        res.status(500).json({ success: false, message: 'Failed to delete mission' });
    }
};
