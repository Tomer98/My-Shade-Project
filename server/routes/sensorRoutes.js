const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

router.post('/data', sensorController.addSensorData);
router.get('/history/:areaId', sensorController.getHistoryByArea);
router.get('/logs', sensorController.getGlobalLogs); // <--- זה הנתיב של הלוגים

module.exports = router;