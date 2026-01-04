const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ייבוא הנתיבים (Routes)
const userRoutes = require('./routes/userRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const areaRoutes = require('./routes/areaRoutes');
const alertRoutes = require('./routes/alertRoutes');
const initScheduler = require('./schedulerService');

const app = express();
const PORT = process.env.PORT || 3001;

// --- 1. Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // מומלץ להוסיף לקריאת טפסים רגילים

// --- 2. Static Files (התיקון כאן) ---
// שיניתי את הנתיב מ-'uploads/maps' ל-'uploads'
// זה חייב להתאים לתיקייה שבה Multer שומר את הקבצים ב-areaRoutes.js
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 3. Routes (הנתיבים) ---
app.use('/api/users', userRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/alerts', alertRoutes);

// --- 4. Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    
    // הפעלת המוח החכם (המתזמן)
    // אם initScheduler היא פונקציה אסינכרונית שצריכה חיבור לדאטהבייס, וודא שהיא מטפלת בשגיאות בתוכה
    if (typeof initScheduler === 'function') {
        initScheduler();
        console.log('🕒 Scheduler started.');
    }
});