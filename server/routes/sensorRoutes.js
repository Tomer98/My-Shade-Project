/**
 * Sensor Routes
 * Handles retrieving real-time sensor data, global logs, historical charts,
 * and receiving raw data from physical or simulated sensors.
 * Base Route: /api/sensors
 */
const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const { verifyToken } = require('../middleware/auth');

/**
 * @route   GET /latest
 * @desc    Get the latest global weather data and algorithm score (top monitoring bar)
 * @access  Private (All authenticated users)
 */
router.get('/latest', verifyToken, sensorController.getLatest);

/**
 * @route   GET /logs
 * @desc    Get global system action logs for the activity sidebar
 * @access  Private (All authenticated users)
 */
router.get('/logs', verifyToken, sensorController.getGlobalLogs);

/**
 * @route   GET /history/:areaId
 * @desc    Get historical sensor data for a specific area to render charts
 * @access  Private (All authenticated users)
 */
router.get('/history/:areaId', verifyToken, sensorController.getHistoryByArea);

/**
 * @route   POST /update-sim
 * @desc    Inject simulated temp, light, and weather data into an area
 * @access  Private (All authenticated users)
 */
router.post('/update-sim', verifyToken, sensorController.updateAreaSensors); 

/**
 * @route   POST /
 * @desc    Add raw sensor data (Typically called by physical IoT hardware)
 * @access  Public (Open for hardware integration / API Key checking can be added)
 */
router.post('/', sensorController.addSensorData);

module.exports = router;