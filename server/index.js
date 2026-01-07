const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http'); // מודול HTTP מובנה
const { Server } = require("socket.io"); // Socket.io
const multer = require('multer'); // <--- חדש: לניהול העלאת קבצים
const fs = require('fs');         // <--- חדש: לניהול מערכת הקבצים
require('dotenv').config();

// ייבוא הנתיבים (Routes)
const userRoutes = require('./routes/userRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const areaRoutes = require('./routes/areaRoutes');
const alertRoutes = require('./routes/alertRoutes');
const initScheduler = require('./schedulerService');

const app = express();
const PORT = process.env.PORT || 3001;

// --- יצירת שרת HTTP ועטיפת Express ---
const server = http.createServer(app);

// --- הגדרת Socket.io ---
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- הזרקת Socket.io לכל בקשה ---
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ==========================================
// חלק חדש: הגדרות להעלאת תמונות (Multer)
// ==========================================

// 1. הגדרת התיקייה לשמירת התמונות (public/images)
const uploadDir = path.join(__dirname, 'public/images');

// בדיקה אם התיקייה קיימת, ואם לא - יצירה שלה
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. הגדרת האחסון (שם הקובץ והמיקום)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // שם ייחודי לקובץ: זמן נוכחי + סיומת מקורית
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 3. חשיפת התיקייה לדפדפן (כדי שיוכל להציג את התמונות)
// בקשות לכתובת http://localhost:3001/images/... יגיעו לתיקייה הזו
app.use('/images', express.static(uploadDir));

// (משאיר את ה-uploads הישן שלך למקרה שיש בו שימוש אחר)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ==========================================
// נתיבים (Routes)
// ==========================================

app.use('/api/users', userRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/alerts', alertRoutes);

// --- נתיב חדש: העלאת תמונה ---
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // יצירת ה-URL שהלקוח ישתמש בו
        const imageUrl = `/images/${req.file.filename}`;
        console.log(`📸 Image uploaded: ${imageUrl}`);

        res.json({ 
            success: true, 
            filePath: imageUrl, 
            message: 'Image uploaded successfully' 
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Server error during upload' });
    }
});


// --- ניהול חיבורי Socket ---
io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    
    // הפעלת המתזמן
    if (typeof initScheduler === 'function') {
        initScheduler();
        console.log('🕒 Scheduler started.');
    }
});