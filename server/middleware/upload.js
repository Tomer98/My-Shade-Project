// server/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// וודא שתיקיית uploads קיימת
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// הגדרת האחסון
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // שמירה בתיקיית uploads
    },
    filename: function (req, file, cb) {
        // יצירת שם ייחודי לקובץ (זמן + שם מקורי) כדי למנוע דריסות
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// סינון קבצים (רק תמונות)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // הגבלת גודל ל-5MB
});

module.exports = upload;