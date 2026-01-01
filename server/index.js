const express = require('express');
const cors = require('cors');
const path = require('path'); // עדיף לרכז אימפורטים למעלה
require('dotenv').config();

// ייבוא הנתיבים (Routes)
const userRoutes = require('./routes/userRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const areaRoutes = require('./routes/areaRoutes');
const alertRoutes = require('./routes/alertRoutes');
const initScheduler = require('./schedulerService');

const app = express();
const PORT = process.env.PORT || 3001;

// --- 1. Middleware (חייב להיות ראשון!) ---
// זה מבטיח שכל בקשה שנכנסת לשרת עוברת קודם כל אישור ואפשור קריאת JSON
app.use(cors()); 
app.use(express.json()); 

// --- 2. Static Files ---
// חשיפת תיקיית התמונות (כדי שהמפה תוצג באתר)
// שמנו את זה אחרי ה-CORS כדי למנוע בעיות בטעינת תמונות
app.use('/uploads', express.static(path.join(__dirname, 'uploads/maps')));

// --- 3. Routes (הנתיבים) ---
app.use('/api/users', userRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/alerts', alertRoutes);

// --- 4. Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    
    // הפעלת המוח החכם (המתזמן)
    // שמנו אותו כאן כדי שנדע שהוא רץ רק אחרי שהשרת עלה בהצלחה
    initScheduler();
});