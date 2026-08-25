/**
 * Equipment Routes
 * Serviceable items installed in the rooms.
 * Base Route: /api/equipment
 */
const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const { verifyToken, checkRole } = require('../middleware/auth');

router.use(verifyToken);

/**
 * @route   GET /
 * @desc    List equipment (supports ?area_id= and ?status=)
 * @access  Private (All authenticated users)
 */
router.get('/', equipmentController.getAllEquipment);

/**
 * @route   POST /
 * @desc    Register a new piece of equipment
 * @access  Private (Admin & Maintenance)
 */
router.post('/', checkRole(['admin', 'maintenance']), equipmentController.createEquipment);

/**
 * @route   PUT /:id
 * @desc    Update an item's details or service status
 * @access  Private (Admin & Maintenance)
 */
router.put('/:id', checkRole(['admin', 'maintenance']), equipmentController.updateEquipment);

/**
 * @route   DELETE /:id
 * @desc    Remove an item, leaving past missions intact
 * @access  Private (Admin only)
 */
router.delete('/:id', checkRole(['admin']), equipmentController.deleteEquipment);

module.exports = router;
