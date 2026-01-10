const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// --- הסדר כאן קריטי! ---

// 1. נתיב לנתונים האחרונים (עבור הסטריפ העליון)
router.get('/latest', sensorController.getLatest);

// 2. נתיבים ספציפיים ללוגים והיסטוריה
router.get('/logs', sensorController.getGlobalLogs);
router.get('/history/:areaId', sensorController.getHistoryByArea);

// 3. הוספת הנתיב לסימולציה (חובה עבור Inject Data)
// נתיב זה מאפשר לעדכן טמפרטורה, אור ומזג אוויר בו-זמנית
router.post('/update-sim', sensorController.updateAreaSensors); 

// 4. נתיב כללי לחיישנים (POST /api/sensors)
router.post('/', sensorController.addSensorData);

module.exports = router;