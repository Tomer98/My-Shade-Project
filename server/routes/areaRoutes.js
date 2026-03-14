/**
 * Area Routes
 * Handles retrieving, creating, updating, and deleting physical areas/rooms.
 * Includes map coordinates, sensor positions, and manual/simulation controls.
 * Base Route: /api/areas
 */
const express = require('express');
const router = express.Router();
const areaController = require('../controllers/areaController'); 
const upload = require('../middleware/upload'); 
const { verifyToken, checkRole } = require('../middleware/auth'); // הוספנו אבטחה!

/**
 * @route   GET /
 * @desc    Get all areas/rooms
 * @access  Private (All authenticated users)
 */
router.get('/', verifyToken, areaController.getAllAreas);

/**
 * @route   POST /
 * @desc    Create a new area (with optional map image)
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, checkRole(['admin']), upload.single('roomImage'), areaController.createArea);

/**
 * @route   POST /:id/image
 * @desc    Upload or update the map image for a specific area
 * @access  Private (Admin only)
 */
router.post('/:id/image', verifyToken, checkRole(['admin']), upload.single('roomImage'), areaController.uploadMapImage);

/**
 * @route   PUT /:id/map-coordinates
 * @desc    Update the X/Y coordinates of an area on the global campus map
 * @access  Private (Admin only)
 */
router.put('/:id/map-coordinates', verifyToken, checkRole(['admin']), areaController.updateMapCoordinates);

/**
 * @route   PUT /:id/sensor-positions
 * @desc    Update the positions of sensors within a specific area's layout
 * @access  Private (Admin only)
 */
router.put('/:id/sensor-positions', verifyToken, checkRole(['admin']), areaController.updateSensorPositions);

/**
 * @route   PUT /:id/state
 * @desc    Manually update the shade state (open/close/percent) for an area
 * @access  Private (All authenticated users)
 */
router.put('/:id/state', verifyToken, areaController.updateAreaState);

/**
 * @route   PUT /:id/simulation
 * @desc    Update real-time simulation parameters (temp, light) for an area
 * @access  Private (All authenticated users)
 */
// תיקון: שונה מ-POST ל-PUT כדי להתאים ל-Axios ב-React
router.put('/:id/simulation', verifyToken, areaController.updateAreaSimulation);

/**
 * @route   DELETE /:id
 * @desc    Delete an area completely from the system
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, checkRole(['admin']), areaController.deleteArea);

module.exports = router;