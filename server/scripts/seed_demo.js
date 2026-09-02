/**
 * Demo Seed
 * ---------
 * Fills the database with a realistic scenario so every screen has something
 * to show during a walkthrough: missions at each stage of their lifecycle, a
 * registration awaiting approval, equipment in every service state, and guides
 * both pending and approved.
 *
 * Safe to re-run: demo rows are tagged and cleared first. Accounts that already
 * exist are updated, never duplicated, and nothing outside the demo set is
 * touched.
 *
 * Usage:  node scripts/seed_demo.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/db');

const TAG = '[demo]'; // marks rows this script owns

/** Returns the id of a room, creating it when absent. */
async function ensureRoom(room, description, lat, lng, coords) {
    const [existing] = await db.query('SELECT id FROM areas WHERE room = ?', [room]);
    if (existing.length > 0) {
        await db.query('UPDATE areas SET latitude = ?, longitude = ? WHERE id = ?',
            [lat, lng, existing[0].id]);
        return existing[0].id;
    }

    const [res] = await db.query(
        `INSERT INTO areas (room, description, map_coordinates, latitude, longitude, company_id, shade_state, current_position)
         VALUES (?, ?, ?, ?, ?, 1, 'AUTO', 0)`,
        [room, description, JSON.stringify(coords), lat, lng]
    );
    return res.insertId;
}

/** Returns the id of a user, creating it when absent. */
async function ensureUser(username, { email, role, status, speciality, work_area }) {
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);

    if (existing.length > 0) {
        await db.query(
            'UPDATE users SET role = ?, status = ?, speciality = ?, work_area = ? WHERE id = ?',
            [role, status, speciality, work_area, existing[0].id]
        );
        return existing[0].id;
    }

    const password = await bcrypt.hash('password123', 10);
    const [res] = await db.query(
        `INSERT INTO users (username, password, email, role, status, speciality, work_area, company_id, is_available)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, TRUE)`,
        [username, password, email, role, status, speciality, work_area]
    );
    return res.insertId;
}

/** Creates a mission plus its checklist, returning the subtask ids. */
async function createMission(mission, subtasks) {
    const [res] = await db.query(
        `INSERT INTO missions
         (area_id, title, description, frequency_days, scheduled_date, assigned_to, created_by, status, equipment_id, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mission.area_id, mission.title, `${TAG} ${mission.description}`, mission.frequency_days,
         mission.scheduled_date, mission.assigned_to, mission.created_by,
         mission.status, mission.equipment_id || null, mission.completed_at || null]
    );

    const ids = [];
    for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        const [r] = await db.query(
            `INSERT INTO mission_subtasks (mission_id, title, status, comment, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [res.insertId, st.title, st.status || 'Pending', st.comment || null, i]
        );
        ids.push(r.insertId);
    }
    return res.insertId;
}

const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function seed() {
    // Say which database is about to be written to. Running this from the host
    // rather than inside the container picks up the .env DB_HOST, which may be
    // the production RDS instance — worth seeing before rows are inserted.
    console.log(`🌱 Seeding demo data into ${process.env.DB_HOST}/${process.env.DB_NAME}\n`);

    // ── Clear only what this script owns ────────────────────────────────
    await db.query("DELETE FROM alerts WHERE description LIKE ?", [`${TAG}%`]);
    await db.query("DELETE FROM alerts WHERE description LIKE '[Auto]%'");
    await db.query("DELETE FROM missions WHERE description LIKE ?", [`${TAG}%`]);
    await db.query("DELETE FROM guides WHERE content LIKE ?", [`${TAG}%`]);
    await db.query("DELETE FROM equipment WHERE equipment_type LIKE ?", [`${TAG}%`]);
    console.log('   cleared previous demo rows');

    // ── Rooms (HIT campus coordinates) ──────────────────────────────────
    const room216 = await ensureRoom('Classroom 216', 'South-facing, heavy afternoon sun',
        32.0153, 34.7736, { top: 51.4, left: 38.0 });
    const auditorium = await ensureRoom('Auditorium', 'Main hall, 300 seats',
        32.0158, 34.7742, { top: 55.9, left: 59.2 });
    const lab = await ensureRoom('Physics Lab 104', 'Equipment-sensitive, needs stable temperature',
        32.0149, 34.7729, { top: 44.0, left: 30.0 });
    console.log('   rooms ready');

    // ── People ──────────────────────────────────────────────────────────
    const tom = await ensureUser('Tom', { email: 'bareltom33@gmail.com', role: 'admin',
        status: 'Active', speciality: null, work_area: null });
    const bob = await ensureUser('Bob', { email: 'bob@campus.edu', role: 'maintenance',
        status: 'Active', speciality: 'Electrical', work_area: 'Classroom 216' });
    const dana = await ensureUser('Dana', { email: 'dana@campus.edu', role: 'planner',
        status: 'Active', speciality: null, work_area: null });
    const yossi = await ensureUser('Yossi', { email: 'yossi@campus.edu', role: 'maintenance',
        status: 'Active', speciality: 'Mechanical', work_area: 'Auditorium' });

    // The registration a reviewer will approve live during the walkthrough
    await ensureUser('Maya', { email: 'maya@campus.edu', role: 'maintenance',
        status: 'Pending', speciality: 'HVAC', work_area: 'Physics Lab 104' });
    console.log('   users ready (Maya is Pending — approve her during the demo)');

    // ── Equipment, one in each service state ────────────────────────────
    const [m1] = await db.query(
        `INSERT INTO equipment (name, serial_number, equipment_type, area_id, company_id, status, installed_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        ['Shade Motor — North Window', 'SM-2201', `${TAG} Motor`, room216, 'Operational', '2024-03-11']);
    const [m2] = await db.query(
        `INSERT INTO equipment (name, serial_number, equipment_type, area_id, company_id, status, installed_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        ['Light Sensor Array', 'LS-4417', `${TAG} Sensor`, auditorium, 'NeedsService', '2023-09-02']);
    await db.query(
        `INSERT INTO equipment (name, serial_number, equipment_type, area_id, company_id, status, installed_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        ['Shade Motor — West Bank', 'SM-2208', `${TAG} Motor`, lab, 'OutOfOrder', '2022-11-20']);
    console.log('   equipment ready (3 items, one in each state)');

    // ── Missions across the whole lifecycle ─────────────────────────────

    // 1. Untouched, due today — the "Start my first mission" entry point
    await createMission(
        { area_id: room216, title: 'Quarterly shade service', description: 'Routine service',
          frequency_days: 90, scheduled_date: today(), assigned_to: bob, created_by: tom,
          status: 'Open', equipment_id: m1.insertId },
        [{ title: 'Clean and lubricate rails' },
         { title: 'Test motor travel, both directions' },
         { title: 'Verify limit switches' }]
    );

    // 2. Half done — shows the progress bar mid-flight
    await createMission(
        { area_id: auditorium, title: 'Monthly sensor calibration', description: 'Calibration round',
          frequency_days: 30, scheduled_date: today(), assigned_to: yossi, created_by: tom,
          status: 'InProgress', equipment_id: m2.insertId },
        [{ title: 'Clean sensor housing', status: 'Done' },
         { title: 'Compare reading against reference meter' },
         { title: 'Record calibration offset' }]
    );

    // 3. Failed — sits in the manager's queue for reassignment
    const failed = await createMission(
        { area_id: lab, title: 'Emergency motor inspection', description: 'Reported fault',
          frequency_days: 30, scheduled_date: daysFromNow(-2), assigned_to: bob, created_by: tom,
          status: 'Failed', completed_at: new Date(Date.now() - 2 * 86400000) },
        [{ title: 'Inspect gearbox', status: 'Done' },
         { title: 'Replace drive belt', status: 'Failed',
           comment: 'Belt size 8M-900 not in stock, ordered from supplier, ETA 5 days' }]
    );

    // The service ticket that failure opened automatically
    await db.query(
        `INSERT INTO alerts (area_id, created_by, description, priority, status)
         VALUES (?, ?, ?, 'High', 'Open')`,
        [lab, bob, '[Auto] Emergency motor inspection → Replace drive belt: ' +
         'Belt size 8M-900 not in stock, ordered from supplier, ETA 5 days ' +
         `(reported ${new Date(Date.now() - 2 * 86400000).toLocaleString()})`]
    );

    // 4. Completed last month — populates Location History
    await createMission(
        { area_id: room216, title: 'Quarterly shade service', description: 'Previous visit',
          frequency_days: 90, scheduled_date: daysFromNow(-30), assigned_to: yossi, created_by: tom,
          status: 'Completed', completed_at: new Date(Date.now() - 30 * 86400000),
          equipment_id: m1.insertId },
        [{ title: 'Clean and lubricate rails', status: 'Done' },
         { title: 'Test motor travel, both directions', status: 'Done',
           comment: 'Travel smooth, no adjustment needed' }]
    );
    console.log('   missions ready (open / in-progress / failed / completed)');

    // ── Knowledge base ──────────────────────────────────────────────────
    const [g1] = await db.query(
        `INSERT INTO guides (title, content, author_id, status, approved_by)
         VALUES (?, ?, ?, 'Approved', ?)`,
        ['Replacing a shade drive belt',
         `${TAG} Release tension at the idler pulley before removing the old belt — ` +
         'forcing it off bends the bracket. Size 8M-900 fits every motor on campus.',
         bob, tom]);
    const [g2] = await db.query(
        `INSERT INTO guides (title, content, author_id, status, approved_by)
         VALUES (?, ?, ?, 'Approved', ?)`,
        ['Calibrating the light sensor array',
         `${TAG} Take the reference reading at solar noon on a clear day. ` +
         'Readings taken under cloud drift by up to 15%.',
         yossi, tom]);
    // Left pending on purpose, so approval can be demonstrated live
    await db.query(
        `INSERT INTO guides (title, content, author_id, status)
         VALUES (?, ?, ?, 'Pending')`,
        ['Winter checklist for roof-mounted units',
         `${TAG} Draft — covers drainage, seal inspection and cable strain relief.`,
         bob]);

    // Ratings, so ordering by average has something to sort
    for (const [guide, user, rating] of [
        [g1.insertId, tom, 5], [g1.insertId, yossi, 5], [g1.insertId, dana, 4],
        [g2.insertId, tom, 4], [g2.insertId, bob, 3],
    ]) {
        await db.query(
            `INSERT INTO guide_ratings (guide_id, user_id, rating) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
            [guide, user, rating]);
    }
    console.log('   guides ready (2 approved and rated, 1 pending)');

    // ── A manually reported issue alongside the automatic one ───────────
    await db.query(
        `INSERT INTO alerts (area_id, created_by, description, priority, status)
         VALUES (?, ?, ?, 'Medium', 'Open')`,
        [auditorium, dana, `${TAG} Shade on the east side rattles audibly in wind`]);

    console.log('\n✅ Demo data ready.\n');
    console.log('   Sign in as Tom / password123');
    console.log('   Maya is awaiting approval in Manage');
    console.log('   One mission is failed and waiting in the manager queue\n');

    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
