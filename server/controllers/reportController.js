/**
 * Report Controller
 * Answers the specification's "database questioning" for managers: aggregate
 * views over maintenance activity, filtered by date range.
 *
 * Every query is parameterised and scoped to the caller's company — the date
 * range and any ids arrive from the client and are never interpolated.
 */
const db = require('../config/db');

/**
 * Resolves the reporting window, defaulting to the last 30 days.
 * @returns {{from: string, to: string}} ISO dates.
 */
const resolveRange = (query) => {
    const to = query.to || new Date().toISOString().slice(0, 10);
    const from = query.from
        || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { from, to };
};

/**
 * Headline maintenance figures plus the breakdowns a manager reviews:
 * completion rate, workload per worker, activity per room, and alert mix.
 */
exports.getSummary = async (req, res) => {
    const { from, to } = resolveRange(req.query);
    const companyId = req.user.companyId ?? 1;

    try {
        // Mission outcomes across the window
        const [missionStats] = await db.query(
            `SELECT m.status, COUNT(*) AS count
             FROM missions m
             JOIN areas a ON m.area_id = a.id
             WHERE a.company_id = ? AND DATE(m.created_at) BETWEEN ? AND ?
             GROUP BY m.status`,
            [companyId, from, to]
        );

        // Who did the work, and how reliably
        const [byWorker] = await db.query(
            `SELECT u.username,
                    COUNT(m.id) AS total,
                    SUM(m.status = 'Completed') AS completed,
                    SUM(m.status = 'Failed') AS failed
             FROM missions m
             JOIN areas a ON m.area_id = a.id
             LEFT JOIN users u ON m.assigned_to = u.id
             WHERE a.company_id = ? AND DATE(m.created_at) BETWEEN ? AND ?
             GROUP BY m.assigned_to, u.username
             HAVING u.username IS NOT NULL
             ORDER BY total DESC`,
            [companyId, from, to]
        );

        // Which locations consume the most maintenance
        const [byArea] = await db.query(
            `SELECT a.room AS area_name,
                    COUNT(m.id) AS missions,
                    SUM(m.status = 'Failed') AS failed
             FROM areas a
             LEFT JOIN missions m
                    ON m.area_id = a.id AND DATE(m.created_at) BETWEEN ? AND ?
             WHERE a.company_id = ?
             GROUP BY a.id, a.room
             ORDER BY missions DESC`,
            [from, to, companyId]
        );

        // Reported issues by severity
        const [alertsByPriority] = await db.query(
            `SELECT al.priority, COUNT(*) AS count
             FROM alerts al
             JOIN areas a ON al.area_id = a.id
             WHERE a.company_id = ? AND DATE(al.created_at) BETWEEN ? AND ?
             GROUP BY al.priority`,
            [companyId, from, to]
        );

        // Equipment condition right now, rather than over the window
        const [equipmentByStatus] = await db.query(
            `SELECT status, COUNT(*) AS count
             FROM equipment WHERE company_id = ? GROUP BY status`,
            [companyId]
        );

        // Subtasks that could not be completed — the recurring blockers
        const [topBlockers] = await db.query(
            `SELECT s.title, COUNT(*) AS failures
             FROM mission_subtasks s
             JOIN missions m ON s.mission_id = m.id
             JOIN areas a ON m.area_id = a.id
             WHERE a.company_id = ? AND s.status = 'Failed'
               AND DATE(m.created_at) BETWEEN ? AND ?
             GROUP BY s.title
             ORDER BY failures DESC
             LIMIT 5`,
            [companyId, from, to]
        );

        const totals = missionStats.reduce((acc, row) => {
            acc[row.status] = Number(row.count);
            acc.total += Number(row.count);
            return acc;
        }, { total: 0 });

        const completed = totals.Completed || 0;
        const finished = completed + (totals.Failed || 0);

        res.json({
            success: true,
            data: {
                range: { from, to },
                missions: {
                    ...totals,
                    // Share of finished work that finished cleanly
                    completionRate: finished > 0 ? Math.round((completed / finished) * 100) : null,
                },
                byWorker,
                byArea,
                alertsByPriority,
                equipmentByStatus,
                topBlockers,
            },
        });
    } catch (error) {
        console.error('Error building report:', error);
        res.status(500).json({ success: false, message: 'Failed to build report' });
    }
};

/**
 * Row-level mission export for the same window, for a manager who wants the
 * underlying records rather than the aggregates.
 */
exports.getMissionReport = async (req, res) => {
    const { from, to } = resolveRange(req.query);
    const companyId = req.user.companyId ?? 1;

    try {
        const conditions = ['a.company_id = ?', 'DATE(m.created_at) BETWEEN ? AND ?'];
        const params = [companyId, from, to];

        if (req.query.status) {
            conditions.push('m.status = ?');
            params.push(req.query.status);
        }
        if (req.query.area_id) {
            conditions.push('m.area_id = ?');
            params.push(req.query.area_id);
        }

        const [rows] = await db.query(
            `SELECT m.id, m.title, m.status, m.scheduled_date, m.completed_at,
                    a.room AS area_name, u.username AS assignee, e.name AS equipment_name,
                    COUNT(s.id) AS subtasks,
                    SUM(s.status = 'Done') AS subtasks_done
             FROM missions m
             JOIN areas a ON m.area_id = a.id
             LEFT JOIN users u ON m.assigned_to = u.id
             LEFT JOIN equipment e ON m.equipment_id = e.id
             LEFT JOIN mission_subtasks s ON s.mission_id = m.id
             WHERE ${conditions.join(' AND ')}
             GROUP BY m.id
             ORDER BY m.scheduled_date DESC
             LIMIT 500`,
            params
        );

        res.json({ success: true, data: rows, range: { from, to } });
    } catch (error) {
        console.error('Error building mission report:', error);
        res.status(500).json({ success: false, message: 'Failed to build mission report' });
    }
};
