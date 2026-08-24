/**
 * Integration Tests — Missions & Guides
 *
 * Same approach as api.integration.test.js: the MySQL pool is replaced with a
 * mock so the controllers run without a real database, and supertest drives
 * real HTTP requests through the Express app.
 */

jest.mock('../config/db', () => ({
    query: jest.fn(),
}));

// Object storage is never exercised in tests — stub the upload away.
jest.mock('../services/storageService', () => ({
    uploadFile: jest.fn().mockResolvedValue('https://example.com/uploads/test.png'),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const db = require('../config/db');

const makeToken = (role, id = 1) =>
    jwt.sign({ id, username: 'testuser', role }, process.env.JWT_SECRET || 'test_secret');

beforeEach(() => {
    jest.clearAllMocks();
});

// ============================================================
// 1. Access control
// ============================================================
describe('Missions — access control', () => {

    test('GET /api/missions without a token returns 403', async () => {
        const res = await request(app).get('/api/missions');
        expect(res.status).toBe(403);
    });

    test('planner cannot create a mission (403)', async () => {
        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', `Bearer ${makeToken('planner')}`)
            .send({ area_id: 1, title: 'Check filters', scheduled_date: '2026-01-01' });

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('maintenance cannot delete a mission — deletion is admin-only (403)', async () => {
        const res = await request(app)
            .delete('/api/missions/1')
            .set('Authorization', `Bearer ${makeToken('maintenance')}`);

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });
});

// ============================================================
// 2. Mission creation
// ============================================================
describe('POST /api/missions', () => {

    test('rejects a mission with no title (400)', async () => {
        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ area_id: 1, scheduled_date: '2026-01-01' });

        expect(res.status).toBe(400);
    });

    test('creates a mission and inserts its subtask checklist', async () => {
        db.query
            .mockResolvedValueOnce([{ insertId: 42 }])          // INSERT mission
            .mockResolvedValueOnce([{}])                        // INSERT subtasks
            .mockResolvedValueOnce([[{ room: 'Classroom 216' }]]) // SELECT room
            .mockResolvedValueOnce([{}]);                       // INSERT log

        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({
                area_id: 1,
                title: 'Quarterly shade service',
                scheduled_date: '2026-01-01',
                subtasks: ['Clean rails', 'Test motor'],
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(42);

        // The bulk subtask insert should carry both checklist items
        const subtaskCall = db.query.mock.calls.find(c => c[0].includes('INSERT INTO mission_subtasks'));
        expect(subtaskCall).toBeDefined();
        expect(subtaskCall[1][0]).toHaveLength(2);
    });
});

// ============================================================
// 3. Subtask outcomes — the core checklist rule
// ============================================================
describe('PUT /api/missions/subtasks/:id', () => {

    test('rejects a Failed subtask with no explanation (400)', async () => {
        const res = await request(app)
            .put('/api/missions/subtasks/5')
            .set('Authorization', `Bearer ${makeToken('maintenance')}`)
            .send({ status: 'Failed' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/comment is required/i);
    });

    test('rejects an unknown status value (400)', async () => {
        const res = await request(app)
            .put('/api/missions/subtasks/5')
            .set('Authorization', `Bearer ${makeToken('maintenance')}`)
            .send({ status: 'Maybe' });

        expect(res.status).toBe(400);
    });

    test("a worker cannot touch a subtask on someone else's mission (403)", async () => {
        db.query.mockResolvedValueOnce([[
            { subtask_title: 'Clean rails', mission_id: 7, mission_title: 'Service',
              assigned_to: 999, area_id: 1, room_name: 'Lab' }
        ]]);

        const res = await request(app)
            .put('/api/missions/subtasks/5')
            .set('Authorization', `Bearer ${makeToken('maintenance', 1)}`)
            .send({ status: 'Done' });

        expect(res.status).toBe(403);
    });

    test('marking a subtask Failed opens a service ticket automatically', async () => {
        db.query
            .mockResolvedValueOnce([[
                { subtask_title: 'Test motor', mission_id: 7, mission_title: 'Service',
                  assigned_to: 1, area_id: 3, room_name: 'Auditorium' }
            ]])                                   // SELECT subtask + mission
            .mockResolvedValueOnce([{}])          // UPDATE subtask
            .mockResolvedValueOnce([{}])          // UPDATE mission -> InProgress
            .mockResolvedValueOnce([{ insertId: 88 }]) // INSERT alert (service ticket)
            .mockResolvedValueOnce([{}]);         // INSERT log

        const res = await request(app)
            .put('/api/missions/subtasks/5')
            .set('Authorization', `Bearer ${makeToken('maintenance', 1)}`)
            .send({ status: 'Failed', comment: 'Motor seized, part on order' });

        expect(res.status).toBe(200);
        expect(res.body.ticketId).toBe(88);

        // The auto-created ticket must carry the area and the worker's explanation
        const alertCall = db.query.mock.calls.find(c => c[0].includes('INSERT INTO alerts'));
        expect(alertCall).toBeDefined();
        expect(alertCall[1][0]).toBe(3);                       // area_id
        expect(alertCall[1][2]).toMatch(/Motor seized/);       // description
    });

    test('marking a subtask Done does NOT open a ticket', async () => {
        db.query
            .mockResolvedValueOnce([[
                { subtask_title: 'Clean rails', mission_id: 7, mission_title: 'Service',
                  assigned_to: 1, area_id: 3, room_name: 'Auditorium' }
            ]])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{}]);

        const res = await request(app)
            .put('/api/missions/subtasks/5')
            .set('Authorization', `Bearer ${makeToken('maintenance', 1)}`)
            .send({ status: 'Done' });

        expect(res.status).toBe(200);
        expect(res.body.ticketId).toBeNull();
        expect(db.query.mock.calls.some(c => c[0].includes('INSERT INTO alerts'))).toBe(false);
    });
});

// ============================================================
// 4. Finishing a mission
// ============================================================
describe('PUT /api/missions/:id/complete', () => {

    test('refuses to finish while subtasks are still Pending (400)', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 7, area_id: 3, assigned_to: 1, room_name: 'Lab',
                                       frequency_days: 30, title: 'Service' }]])
            .mockResolvedValueOnce([[{ status: 'Done' }, { status: 'Pending' }]]);

        const res = await request(app)
            .put('/api/missions/7/complete')
            .set('Authorization', `Bearer ${makeToken('maintenance', 1)}`);

        expect(res.status).toBe(400);
    });

    test('all subtasks Done -> Completed and the next visit is scheduled', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 7, area_id: 3, assigned_to: 1, room_name: 'Lab',
                                       frequency_days: 30, title: 'Service', description: null,
                                       created_by: 2 }]])
            .mockResolvedValueOnce([[{ status: 'Done' }, { status: 'Done' }]]) // all done
            .mockResolvedValueOnce([{}])                    // UPDATE -> Completed
            .mockResolvedValueOnce([{ insertId: 101 }])     // INSERT next mission
            .mockResolvedValueOnce([[{ title: 'Clean rails', sort_order: 0 }]]) // template
            .mockResolvedValueOnce([{}])                    // INSERT next subtasks
            .mockResolvedValueOnce([{}]);                   // INSERT log

        const res = await request(app)
            .put('/api/missions/7/complete')
            .set('Authorization', `Bearer ${makeToken('maintenance', 1)}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Completed');
        expect(res.body.nextMissionId).toBe(101);
    });

    test('any Failed subtask -> Failed, and no follow-up mission is created', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 7, area_id: 3, assigned_to: 1, room_name: 'Lab',
                                       frequency_days: 30, title: 'Service' }]])
            .mockResolvedValueOnce([[{ status: 'Done' }, { status: 'Failed' }]])
            .mockResolvedValueOnce([{}])   // UPDATE -> Failed
            .mockResolvedValueOnce([{}]);  // INSERT log

        const res = await request(app)
            .put('/api/missions/7/complete')
            .set('Authorization', `Bearer ${makeToken('maintenance', 1)}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Failed');
        expect(res.body.nextMissionId).toBeNull();
    });
});

// ============================================================
// 5. Close day
// ============================================================
describe('POST /api/missions/close-day', () => {

    test('rolls open missions to tomorrow and reports the count', async () => {
        db.query.mockResolvedValueOnce([{ affectedRows: 3 }]);

        const res = await request(app)
            .post('/api/missions/close-day')
            .set('Authorization', `Bearer ${makeToken('maintenance', 1)}`);

        expect(res.status).toBe(200);
        expect(res.body.moved).toBe(3);

        // A worker's close-day must only affect their own missions
        const call = db.query.mock.calls[0];
        expect(call[0]).toMatch(/assigned_to = \?/);
        expect(call[1]).toContain(1);
    });
});

// ============================================================
// 6. Room GPS — the destination navigation routes to
// ============================================================
describe('PUT /api/areas/:id/gps', () => {

    test('rejects a latitude outside -90..90 (400)', async () => {
        const res = await request(app)
            .put('/api/areas/1/gps')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ latitude: 130, longitude: 34.8 });

        expect(res.status).toBe(400);
    });

    test('rejects a non-numeric coordinate (400)', async () => {
        const res = await request(app)
            .put('/api/areas/1/gps')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ latitude: 'here', longitude: 34.8 });

        expect(res.status).toBe(400);
    });

    test('maintenance cannot set a room location — admin only (403)', async () => {
        const res = await request(app)
            .put('/api/areas/1/gps')
            .set('Authorization', `Bearer ${makeToken('maintenance')}`)
            .send({ latitude: 32.01, longitude: 34.77 });

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('admin saves valid coordinates', async () => {
        db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(app)
            .put('/api/areas/1/gps')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ latitude: 32.0153, longitude: 34.7736 });

        expect(res.status).toBe(200);
        expect(res.body.latitude).toBeCloseTo(32.0153);
    });

    test('returns 404 for a room that does not exist', async () => {
        db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

        const res = await request(app)
            .put('/api/areas/999/gps')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ latitude: 32.0153, longitude: 34.7736 });

        expect(res.status).toBe(404);
    });
});

// ============================================================
// 7. Guides — approval workflow and ratings
// ============================================================
describe('Guides', () => {

    test('a planner cannot approve a guide (403)', async () => {
        const res = await request(app)
            .put('/api/guides/1/review')
            .set('Authorization', `Bearer ${makeToken('planner')}`)
            .send({ status: 'Approved' });

        expect(res.status).toBe(403);
    });

    test('a manager can approve a guide', async () => {
        db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(app)
            .put('/api/guides/1/review')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ status: 'Approved' });

        expect(res.status).toBe(200);
    });

    test('rejects an invalid review status (400)', async () => {
        const res = await request(app)
            .put('/api/guides/1/review')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ status: 'Sideways' });

        expect(res.status).toBe(400);
    });

    test('rejects an out-of-range rating (400)', async () => {
        const res = await request(app)
            .post('/api/guides/1/rate')
            .set('Authorization', `Bearer ${makeToken('planner')}`)
            .send({ rating: 9 });

        expect(res.status).toBe(400);
    });

    test('accepts a valid rating from any authenticated user', async () => {
        db.query.mockResolvedValueOnce([{}]);

        const res = await request(app)
            .post('/api/guides/1/rate')
            .set('Authorization', `Bearer ${makeToken('planner')}`)
            .send({ rating: 4 });

        expect(res.status).toBe(200);
    });

    test('a planner only ever receives approved guides', async () => {
        db.query.mockResolvedValueOnce([[]]);

        await request(app)
            .get('/api/guides')
            .set('Authorization', `Bearer ${makeToken('planner')}`);

        expect(db.query.mock.calls[0][0]).toMatch(/status = 'Approved'/);
    });

    test('a manager receives pending guides too (no status filter)', async () => {
        db.query.mockResolvedValueOnce([[]]);

        await request(app)
            .get('/api/guides')
            .set('Authorization', `Bearer ${makeToken('admin')}`);

        expect(db.query.mock.calls[0][0]).not.toMatch(/status = 'Approved'/);
    });
});
