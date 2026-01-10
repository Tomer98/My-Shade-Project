const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http'); 
const { Server } = require("socket.io"); 
const fs = require('fs'); 
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 


require('dotenv').config();

// ייבוא בסיס הנתונים
const db = require('./config/db');

// ייבוא הנתיבים
const userRoutes = require('./routes/userRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const areaRoutes = require('./routes/areaRoutes');
const alertRoutes = require('./routes/alertRoutes');
const schedulerRoutes = require('./routes/schedulerRoutes');

// ייבוא הגדרות ה-multer המרכזיות
const upload = require('./middleware/upload');

// ייבוא המתזמן החכם
const { initScheduler, updateSimulation } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// --- יצירת שרת HTTP ---
const server = http.createServer(app);

// --- הגדרת Socket.io ---
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// ==========================================
// 🛡️ Security Middleware
// ==========================================

// 1. Helmet: הגדרות אבטחה (מאפשר טעינת תמונות ממקורות שונים)
app.use(helmet({
    crossOriginResourcePolicy: false, 
}));

// 2. Rate Limiting: הגנה מהפצצות (1000 בקשות בדקה - מרווח לפיתוח)
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 1000, 
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter); 

// ==========================================
// Standard Middleware
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// הזרקת Socket.io לכל בקשה
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ==========================================
// 📂 ניהול קבצים (שימוש בתיקייה הקיימת uploads)
// ==========================================

// חשיפת תיקיית התמונות הסטטיות.
// הלקוח יבקש /uploads/filename.jpg והשרת יחזיר את הקובץ מהתיקייה
// server/uploads/filename.jpg.
// זה מתאים גם להגדרות הדוקר.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// נתיבים (Routes)
// ==========================================

app.use('/api/users', userRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/schedules', schedulerRoutes);

// נתיב להעלאת תמונה
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
        
        // ה-URL שהלקוח מקבל (מתחיל ב-/uploads/)
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, filePath: imageUrl, message: 'Image uploaded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during upload' });
    }
});

// ==========================================
// 🛠️ נתיבי שירות ותיקון
// ==========================================

app.get('/create-schedules-table', async (req, res) => {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                area_id INT NOT NULL,
                execution_time VARCHAR(10) NOT NULL,
                action_type ENUM('OPEN', 'CLOSE') NOT NULL,
                target_position INT DEFAULT 0,
                days VARCHAR(50) DEFAULT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
            )
        `;
        await db.query(sql);
        res.send("✅ Table 'schedules' created successfully!");
    } catch (err) { res.send("❌ Error: " + err.message); }
});

app.get('/fix-db', async (req, res) => {
    try {
        await db.query("ALTER TABLE weather_logs ADD COLUMN score FLOAT DEFAULT 0;");
        res.send("✅ Database Fixed! Added 'score' column.");
    } catch (err) { res.send("ℹ️ Note: " + err.message); }
});

// Endpoint להפעלת סימולציה (Test AI)
app.post('/api/simulation', (req, res) => {
    const { isActive, temp, light } = req.body;
    
    // קריאה לפונקציה שיצרנו ב-scheduler.js
    updateSimulation(isActive, temp, light);

    res.json({ 
        success: true, 
        message: isActive ? 'Simulation Started' : 'Simulation Stopped',
        data: { temp, light }
    });
});

// ==========================================
// הפעלת השרת
// ==========================================

io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`🔌 Client disconnected: ${socket.id}`));
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    
    // הפעלת המתזמן החכם
    try {
        initScheduler(io); 
    } catch (err) {
        console.error('Failed to start scheduler:', err);
    }
});