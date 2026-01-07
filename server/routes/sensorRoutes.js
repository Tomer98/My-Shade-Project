const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// --- הסדר כאן קריטי! ---

// 1. קודם כל נתיבים ספציפיים (כמו 'logs' או 'history')
router.get('/logs', sensorController.getGlobalLogs);

// הנה השורה שחסרה לך כרגע:
router.get('/history/:areaId', sensorController.getHistoryByArea);

// 2. רק אחר כך נתיבים עם פרמטרים כלליים (אם יש) או שורש
router.post('/', sensorController.addSensorData);

module.exports = router;