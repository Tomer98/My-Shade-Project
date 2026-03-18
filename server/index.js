/**
 * Server Entry Point
 * Creates the HTTP server, initialises WebSockets, and starts listening.
 * Express app configuration lives in app.js.
 */
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { initScheduler } = require('./services/scheduler');

const PORT = process.env.PORT || 3001;

// --- HTTP Server & WebSockets Setup ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
app.set('io', io);


io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
});

// --- Start Listening ---
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    try {
        initScheduler(io);
    } catch (err) {
        console.error('Failed to start scheduler:', err);
    }
});
