/**
 * Alert Routes
 * Handles retrieving, creating, updating, and deleting system alerts.
 * Base Route: /api/alerts
 */
const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { verifyToken, checkRole } = require('../middleware/auth');

/**
 * Global Middleware for Alert Routes
 * Ensures all requests to this router require a valid JWT token.
 */
router.use(verifyToken);

/**
 * @route   GET /
 * @desc    Get all system alerts
 * @access  Private (All authenticated users)
 */
router.get('/', alertController.getAllAlerts);

/**
 * @route   POST /
 * @desc    Create a new system alert
 * @access  Private (All authenticated users)
 */
router.post('/', alertController.createAlert);

/**
 * @route   PUT /:id
 * @desc    Update alert status (e.g., mark as resolved/in-progress)
 * @access  Private (Admin & Maintenance only)
 */
router.put('/:id', checkRole(['admin', 'maintenance']), alertController.updateAlert);

/**
 * @route   DELETE /:id
 * @desc    Delete an alert from history
 * @access  Private (Admin only)
 */
router.delete('/:id', checkRole(['admin']), alertController.deleteAlert);

module.exports = router;