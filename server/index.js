/**
 * Main Application Entry Point
 * Configures the Express server, connects middleware, establishes WebSocket
 * communication, and mounts all route handlers.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http'); 
const { Server } = require("socket.io"); 
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 

// Database Connection
const db = require('./config/db');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const areaRoutes = require('./routes/areaRoutes');
const alertRoutes = require('./routes/alertRoutes');
const schedulerRoutes = require('./routes/schedulerRoutes');

// Service Imports
const { initScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// --- HTTP Server & WebSockets Setup ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// ==========================================
// 🛡️ Security Middleware
// ==========================================

// 1. Helmet: Security headers (crossOriginResourcePolicy disabled to allow image loading)
app.use(helmet({
    crossOriginResourcePolicy: false, 
}));

// 2. Rate Limiting: Prevent brute-force & DDoS (1000 requests per minute)
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 1000, 
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter); 

// ==========================================
// 🧰 Standard Middleware
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inject Socket.io into every incoming request object
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ==========================================
// 📂 Static File Management (Uploads)
// ==========================================
// Expose the uploads directory for serving room maps
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 🛣️ API Routes
// ==========================================

// 1. Authentication (Public - Generates Tokens)
app.use('/api/auth', authRoutes);

// 2. Core System Routes (Protected by Middleware inside their files)
app.use('/api/users', userRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/schedules', schedulerRoutes);
app.use('/api/alerts', alertRoutes);


// ==========================================
// 🚨 Fallback & Error Handling
// ==========================================

// 404 Route Not Found Handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `API Route not found: ${req.originalUrl}`
    });
});

// Global Error Handler (Catches all unhandled errors in the app)
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.message);
    
    // Prevent sensitive stack traces from leaking to the client in production
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});


// ==========================================
// 🚀 Server Initialization
// ==========================================

// WebSocket Connection Handling
io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
});

// Start listening
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    
    // Initialize the Smart Automation Scheduler
    try {
        initScheduler(io); 
    } catch (err) {
        console.error('Failed to start scheduler:', err);
    }
});