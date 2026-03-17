/**
 * Integration Tests — API Endpoints
 *
 * These tests cover the full HTTP request lifecycle:
 *   HTTP Request → Express Route → Controller → (mocked) DB → HTTP Response
 *
 * Key concepts used here:
 *
 * 1. jest.mock('../config/db') — replaces the real MySQL pool with a fake object
 *    so tests run without a real database. Every controller that calls db.query()
 *    gets our mock instead.
 *
 * 2. supertest — fires real HTTP requests against the Express app in memory,
 *    no port needed, no browser needed.
 *
 * 3. jwt.sign() — we forge valid JWTs directly in tests. verifyToken middleware
 *    only checks the signature against JWT_SECRET, it never queries the DB,
 *    so a token we create here is 100% valid as far as Express is concerned.
 */

// --- Mock the database BEFORE anything requires it ---
// Jest intercepts all require('../config/db') calls across the whole app
// and replaces them with this fake object.
jest.mock('../config/db', () => ({
    query: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = require('../app');
const db = require('../config/db');

// ============================================================
// Helper: generate a signed JWT for any role without hitting DB
// ============================================================
const makeToken = (role) =>
    jwt.sign({ id: 1, username: 'testuser', role }, process.env.JWT_SECRET || 'test_secret');

// ============================================================
// Reset mock call history between every test so one test's
// mock setup doesn't bleed into the next test.
// ============================================================
beforeEach(() => {
    jest.clearAllMocks();
});


// ============================================================
// 1. AUTH — Login endpoint
// ============================================================
describe('POST /api/auth/login', () => {

    test('returns 200 and a JWT token for valid credentials', async () => {
        // Why bcrypt.hash here? The controller receives the plaintext password
        // from the request, then compares it against the hashed password stored
        // in the DB. We simulate what the DB "returns" by hashing first.
        const hashedPassword = await bcrypt.hash('correctpassword', 10);

        // Tell the mock: next time execute() is called, return this fake DB row.
        // The double array [[...]] mirrors what mysql2 actually returns:
        //   [rows, fieldMetadata] — we only ever use rows[0].
        db.query.mockResolvedValueOnce([[
            { id: 1, username: 'admin', email: 'admin@hit.ac.il', password: hashedPassword, role: 'admin' }
        ]]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'correctpassword' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined(); // A JWT token must be in the response
    });

    test('returns 401 for wrong password', async () => {
        const hashedPassword = await bcrypt.hash('correctpassword', 10);

        db.query.mockResolvedValueOnce([[
            { id: 1, username: 'admin', email: 'admin@hit.ac.il', password: hashedPassword, role: 'admin' }
        ]]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('returns 401 when user does not exist', async () => {
        // Empty array = no user found in DB
        db.query.mockResolvedValueOnce([[]]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'nobody', password: 'somepassword' });

        expect(res.status).toBe(401);
    });
});


// ============================================================
// 2. NO TOKEN — Request without authentication
// ============================================================
describe('Unauthenticated requests', () => {

    test('GET /api/areas without a token returns 403', async () => {
        // verifyToken returns 403 (not 401) when no token is provided at all.
        // This is worth knowing: 401 = "your token is invalid", 403 = "no token".
        const res = await request(app).get('/api/areas');
        expect(res.status).toBe(403);
    });

    test('GET /api/users without a token returns 403', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(403);
    });
});


// ============================================================
// 3. RBAC — What a 'maintenance' user CAN do
// ============================================================
describe('Maintenance role — permitted actions', () => {
    let token;

    beforeAll(() => {
        // Create one maintenance token for the whole describe block
        token = makeToken('maintenance');
    });

    test('GET /api/areas returns 200 (can view rooms)', async () => {
        // Mock the DB returning a list of areas
        db.query.mockResolvedValueOnce([[
            { id: 1, name: 'Library', room: 'Library', shade_state: 'OPEN' }
        ]]);

        const res = await request(app)
            .get('/api/areas')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    test('GET /api/sensors/logs returns 200 (can view activity log)', async () => {
        db.query.mockResolvedValueOnce([[
            { id: 1, action_type: 'OPEN', area_name: 'Library', created_at: new Date() }
        ]]);

        const res = await request(app)
            .get('/api/sensors/logs')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    test('PUT /api/areas/1/state returns 200 (can manually open/close a shade)', async () => {
        // updateAreaState does two DB calls: UPDATE then SELECT to return new state
        db.query
            .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE query
            .mockResolvedValueOnce([[{ id: 1, shade_state: 'OPEN' }]]); // SELECT query

        const res = await request(app)
            .put('/api/areas/1/state')
            .set('Authorization', `Bearer ${token}`)
            .send({ shade_state: 'OPEN', mode: 'manual' });

        expect(res.status).toBe(200);
    });
});


// ============================================================
// 4. RBAC — What a 'maintenance' user CANNOT do
// ============================================================
describe('Maintenance role — forbidden actions', () => {
    let token;

    beforeAll(() => {
        token = makeToken('maintenance');
    });

    test('POST /api/areas returns 403 (cannot create a room)', async () => {
        const res = await request(app)
            .post('/api/areas')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'New Room' });

        // checkRole(['admin']) blocks this and returns 403 before DB is ever touched
        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled(); // DB was never reached
    });

    test('DELETE /api/areas/1 returns 403 (cannot delete a room)', async () => {
        const res = await request(app)
            .delete('/api/areas/1')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('PUT /api/areas/1/map-coordinates returns 403 (cannot move map pins)', async () => {
        const res = await request(app)
            .put('/api/areas/1/map-coordinates')
            .set('Authorization', `Bearer ${token}`)
            .send({ x_percent: 50, y_percent: 50 });

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('PUT /api/areas/1/sensor-positions returns 403 (cannot reposition sensors)', async () => {
        const res = await request(app)
            .put('/api/areas/1/sensor-positions')
            .set('Authorization', `Bearer ${token}`)
            .send({ positions: [] });

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('GET /api/users returns 403 (cannot access user management)', async () => {
        const res = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(db.query).not.toHaveBeenCalled();
    });
});


// ============================================================
// 5. RBAC — Admin has full access
// ============================================================
describe('Admin role — full access', () => {
    let token;

    beforeAll(() => {
        token = makeToken('admin');
    });

    test('GET /api/users returns 200 (admin can manage users)', async () => {
        db.query.mockResolvedValueOnce([[
            { id: 1, username: 'admin', role: 'admin' },
            { id: 2, username: 'bob', role: 'maintenance' }
        ]]);

        const res = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    test('DELETE /api/areas/1 returns 200 (admin can delete a room)', async () => {
        db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(app)
            .delete('/api/areas/1')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });
});
