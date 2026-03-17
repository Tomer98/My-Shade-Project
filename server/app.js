/**
 * Express Application Setup
 * Configures middleware, mounts routes, and exports the app for both
 * the production server (index.js) and integration tests.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const areaRoutes = require('./routes/areaRoutes');
const alertRoutes = require('./routes/alertRoutes');
const schedulerRoutes = require('./routes/schedulerRoutes');

const app = express();

// ==========================================
// 🛡️ Security Middleware
// ==========================================

app.use(helmet({ crossOriginResourcePolicy: false }));

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

// ==========================================
// 📂 Static File Management (Uploads)
// ==========================================

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 🛣️ API Routes
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/schedules', schedulerRoutes);
app.use('/api/alerts', alertRoutes);

// ==========================================
// 🚨 Fallback & Error Handling
// ==========================================

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `API Route not found: ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

module.exports = app;
