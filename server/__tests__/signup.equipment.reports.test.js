/**
 * Integration Tests — Signup/Approval, Equipment and Reports
 *
 * Same pattern as the other integration suites: the MySQL pool is mocked so
 * the controllers run without a database, and supertest drives real HTTP
 * requests through the Express app.
 */

jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../services/emailService', () => ({
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = require('../app');
const db = require('../config/db');

const makeToken = (role, companyId = 1, id = 1) =>
    jwt.sign({ id, username: 'tester', role, companyId }, process.env.JWT_SECRET || 'test_secret');

beforeEach(() => { jest.clearAllMocks(); });

// ============================================================
// 1. Self-registration
// ============================================================
describe('POST /api/auth/signup', () => {

    test('requires username, password and email', async () => {
        const res = await request(app).post('/api/auth/signup').send({ username: 'x' });
        expect(res.status).toBe(400);
    });

    test('rejects a password shorter than six characters', async () => {
        const res = await request(app)
            .post('/api/auth/signup')
            .send({ username: 'x', password: '123', email: 'x@y.com' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/6 characters/i);
    });

    test('rejects a username or email that already exists', async () => {
        db.query.mockResolvedValueOnce([[{ id: 1 }]]);

        const res = await request(app)
            .post('/api/auth/signup')
            .send({ username: 'taken', password: 'pw12345', email: 'taken@y.com' });

        expect(res.status).toBe(409);
    });

    test('creates the account as a Pending maintenance worker', async () => {
        db.query
            .mockResolvedValueOnce([[]])            // no existing user
            .mockResolvedValueOnce([{ insertId: 9 }]); // insert

        const res = await request(app)
            .post('/api/auth/signup')
            .send({ username: 'newbie', password: 'pw12345', email: 'n@y.com' });

        expect(res.status).toBe(201);

        // The applicant must not be able to choose their own role or status
        const insert = db.query.mock.calls.find(c => c[0].includes('INSERT INTO users'));
        expect(insert[0]).toMatch(/'maintenance'/);
        expect(insert[0]).toMatch(/'Pending'/);
    });
});

// ============================================================
// 2. Login gating on approval status
// ============================================================
describe('Login respects approval status', () => {

    const userRow = async (status) => ({
        id: 1, username: 'newbie', email: 'n@y.com', role: 'maintenance',
        password: await bcrypt.hash('pw12345', 10), status, company_id: 1,
    });

    test('a Pending account cannot log in', async () => {
        db.query.mockResolvedValueOnce([[await userRow('Pending')]]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'newbie', password: 'pw12345' });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/approval/i);
    });

    test('a Rejected account cannot log in', async () => {
        db.query.mockResolvedValueOnce([[await userRow('Rejected')]]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'newbie', password: 'pw12345' });

        expect(res.status).toBe(403);
    });

    test('an Active account logs in and the token carries the company', async () => {
        db.query.mockResolvedValueOnce([[await userRow('Active')]]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'newbie', password: 'pw12345' });

        expect(res.status).toBe(200);
        const decoded = jwt.decode(res.body.token);
        expect(decoded.companyId).toBe(1);
    });

    test('a wrong password is refused before the status is considered', async () => {
        db.query.mockResolvedValueOnce([[await userRow('Pending')]]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'newbie', password: 'wrong' });

        // 401, not 403 — the response must not reveal that the account exists
        expect(res.status).toBe(401);
    });
});

// ============================================================
// 3. Administrator approval
// ============================================================
describe('PUT /api/users/:id/review', () => {

    test('rejects a status outside Active/Rejected', async () => {
        const res = await request(app)
            .put('/api/users/5/review')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ status: 'Maybe' });

        expect(res.status).toBe(400);
    });

    test('only an admin may approve (403 for maintenance)', async () => {
        const res = await request(app)
            .put('/api/users/5/review')
            .set('Authorization', `Bearer ${makeToken('maintenance')}`)
            .send({ status: 'Active' });

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('approving scopes the update to the admin\'s own company', async () => {
        db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(app)
            .put('/api/users/5/review')
            .set('Authorization', `Bearer ${makeToken('admin', 7)}`)
            .send({ status: 'Active' });

        expect(res.status).toBe(200);
        expect(db.query.mock.calls[0][0]).toMatch(/company_id = \?/);
        expect(db.query.mock.calls[0][1]).toContain(7);
    });

    test('returns 404 for a user in another company', async () => {
        db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

        const res = await request(app)
            .put('/api/users/5/review')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ status: 'Active' });

        expect(res.status).toBe(404);
    });
});

// ============================================================
// 4. Equipment
// ============================================================
describe('Equipment', () => {

    test('requires a name', async () => {
        const res = await request(app)
            .post('/api/equipment')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ serial_number: 'X-1' });

        expect(res.status).toBe(400);
    });

    test('rejects an unknown status', async () => {
        const res = await request(app)
            .post('/api/equipment')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ name: 'Motor', status: 'Broken' });

        expect(res.status).toBe(400);
    });

    test('a planner cannot register equipment', async () => {
        const res = await request(app)
            .post('/api/equipment')
            .set('Authorization', `Bearer ${makeToken('planner')}`)
            .send({ name: 'Motor' });

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('maintenance can register equipment against their company', async () => {
        db.query.mockResolvedValueOnce([{ insertId: 3 }]);

        const res = await request(app)
            .post('/api/equipment')
            .set('Authorization', `Bearer ${makeToken('maintenance', 4)}`)
            .send({ name: 'Motor', area_id: 1 });

        expect(res.status).toBe(201);
        expect(db.query.mock.calls[0][1]).toContain(4); // company_id
    });

    test('listing is scoped to the caller\'s company', async () => {
        db.query.mockResolvedValueOnce([[]]);

        await request(app)
            .get('/api/equipment')
            .set('Authorization', `Bearer ${makeToken('planner', 9)}`);

        expect(db.query.mock.calls[0][0]).toMatch(/e\.company_id = \?/);
        expect(db.query.mock.calls[0][1]).toContain(9);
    });

    test('only an admin may delete equipment', async () => {
        const res = await request(app)
            .delete('/api/equipment/1')
            .set('Authorization', `Bearer ${makeToken('maintenance')}`);

        expect(res.status).toBe(403);
    });

    test('an update with no fields is refused', async () => {
        const res = await request(app)
            .put('/api/equipment/1')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({});

        expect(res.status).toBe(400);
    });
});

// ============================================================
// 5. Reports
// ============================================================
describe('Reports', () => {

    /** The summary endpoint issues six aggregate queries. */
    const mockSummaryQueries = () => {
        db.query
            .mockResolvedValueOnce([[{ status: 'Completed', count: 8 }, { status: 'Failed', count: 2 }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);
    };

    test('a planner cannot read reports', async () => {
        const res = await request(app)
            .get('/api/reports/summary')
            .set('Authorization', `Bearer ${makeToken('planner')}`);

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('computes the completion rate from finished missions', async () => {
        mockSummaryQueries();

        const res = await request(app)
            .get('/api/reports/summary')
            .set('Authorization', `Bearer ${makeToken('admin')}`);

        expect(res.status).toBe(200);
        // 8 completed of 10 finished
        expect(res.body.data.missions.completionRate).toBe(80);
        expect(res.body.data.missions.total).toBe(10);
    });

    test('reports a null completion rate when nothing finished', async () => {
        db.query
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);

        const res = await request(app)
            .get('/api/reports/summary')
            .set('Authorization', `Bearer ${makeToken('admin')}`);

        // Distinguishes "no data" from a genuine 0%
        expect(res.body.data.missions.completionRate).toBeNull();
    });

    test('defaults to a thirty-day window', async () => {
        mockSummaryQueries();

        const res = await request(app)
            .get('/api/reports/summary')
            .set('Authorization', `Bearer ${makeToken('admin')}`);

        const { from, to } = res.body.data.range;
        const days = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
        expect(Math.round(days)).toBe(30);
    });

    test('honours an explicit range and passes it as parameters', async () => {
        mockSummaryQueries();

        const res = await request(app)
            .get('/api/reports/summary?from=2026-01-01&to=2026-01-31')
            .set('Authorization', `Bearer ${makeToken('admin')}`);

        expect(res.body.data.range).toEqual({ from: '2026-01-01', to: '2026-01-31' });
        // The dates must travel as bound parameters, never interpolated
        expect(db.query.mock.calls[0][1]).toContain('2026-01-01');
    });

    test('the mission export is scoped to the company', async () => {
        db.query.mockResolvedValueOnce([[]]);

        await request(app)
            .get('/api/reports/missions')
            .set('Authorization', `Bearer ${makeToken('admin', 5)}`);

        expect(db.query.mock.calls[0][0]).toMatch(/a\.company_id = \?/);
        expect(db.query.mock.calls[0][1]).toContain(5);
    });
});
