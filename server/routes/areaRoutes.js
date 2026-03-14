const express = require('express');
const router = express.Router();
const areaController = require('../controllers/areaController'); 
const upload = require('../middleware/upload'); 

// --- הגדרת הנתיבים (API Endpoints) ---

// שליפת כל החדרים
router.get('/', areaController.getAllAreas);

// יצירת חדר חדש
router.post('/', upload.single('roomImage'), areaController.createArea);

// עדכון מיקום במפה
router.put('/:id/map-coordinates', areaController.updateMapCoordinates);

// העלאת תמונת מפה לחדר
router.post('/:id/image', upload.single('roomImage'), areaController.uploadMapImage);

// עדכון מיקום חיישנים
router.put('/:id/sensor-positions', areaController.updateSensorPositions);

// עדכון סטטוס וילון ספציפי
router.put('/:id/state', areaController.updateAreaState);

// מחיקת חדר
router.delete('/:id', areaController.deleteArea);

// ==========================================
// התיקון הקריטי: חיבור לפונקציה החדשה
// ==========================================
router.post('/:id/simulation', areaController.updateAreaSimulation);

module.exports = router;