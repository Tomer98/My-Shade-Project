const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// --- הסדר כאן קריטי! ---

// 1. הנתיב שהיה חסר לך! (חייב להיות ראשון)
router.get('/latest', sensorController.getLatest);

// 2. נתיבים ספציפיים אחרים
router.get('/logs', sensorController.getGlobalLogs);
router.get('/history/:areaId', sensorController.getHistoryByArea);

// 3. נתיב כללי (שורש)
router.post('/', sensorController.addSensorData);

module.exports = router;