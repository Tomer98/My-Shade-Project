const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const areaController = require('../controllers/areaController'); // וודא שהנתיב נכון

// --- הגדרת Multer להעלאת קבצים ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // וודא שתיקיית uploads קיימת בשורש הפרויקט
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // שם ייחודי לקובץ
    }
});

const upload = multer({ storage: storage });


// --- הגדרת הנתיבים (API Endpoints) ---

// שליפת כל החדרים
router.get('/', areaController.getAllAreas);

// יצירת חדר חדש (כולל העלאת תמונה - 'mapImage' הוא השם שהפרונטנד צריך לשלוח)
router.post('/', upload.single('mapImage'), areaController.createArea);

// עדכון מיקום במפה (גרירה)
router.put('/:id/map-coordinates', areaController.updateMapCoordinates);

// --- העלאת תמונת מפה לחדר קיים ---
// התיקון: שינינו את הנתיב מ-'/:id/upload-map' ל-'/:id/image' כדי שיתאים לבקשה מהלקוח.
// בנוסף, שינינו את שם השדה ב-multer מ-'mapImage' ל-'roomImage' כדי שיתאים לשם שהלקוח שולח.
// זה פותר את שגיאת ה-404 (Not Found).
router.post('/:id/image', upload.single('roomImage'), areaController.uploadMapImage);

// עדכון מיקום חיישנים
router.put('/:id/sensor-positions', areaController.updateSensorPositions);

// עדכון סטטוס (ידני/אוטומטי) ופתיחת וילון
router.put('/:id/state', areaController.updateAreaState);

// עדכון גלובלי (כל החדרים יחד)
router.put('/global-state', areaController.updateGlobalState);

// מחיקת חדר
router.delete('/:id', areaController.deleteArea);

module.exports = router;