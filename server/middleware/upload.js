const multer = require('multer');
const path = require('path');
const fs = require('fs');

// תיקון לדוקר: שימוש ב-process.cwd() מבטיח שאנחנו בתיקייה הראשית של השרת
const uploadDir = path.join(process.cwd(), 'uploads');

console.log(`📂 Upload middleware initialized. Directory: ${uploadDir}`);

// וודא שתיקיית uploads קיימת
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log("✅ Created 'uploads' directory successfully.");
    } catch (err) {
        console.error("❌ Failed to create 'uploads' directory. Check permissions!", err);
    }
}

// הגדרת האחסון
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // שמירה בתיקיית uploads
    },
    filename: function (req, file, cb) {
        // יצירת שם ייחודי לקובץ
        // תיקון קטן: החלפת רווחים בקו תחתון כדי למנוע בעיות ב-URL
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedOriginalName = file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueSuffix + path.extname(sanitizedOriginalName));
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
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = upload;