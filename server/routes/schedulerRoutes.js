/**
 * Scheduler Routes
 * Handles retrieving, creating, and deleting automated system schedules.
 * Base Route: /api/schedules
 */
const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');
const { verifyToken, checkRole } = require('../middleware/auth');

/**
 * Global Middleware
 * Ensures all requests to this router require a valid JWT token.
 */
router.use(verifyToken);

/**
 * @route   GET /
 * @desc    Get all automated schedules
 * @access  Private (All authenticated users)
 */
router.get('/', schedulerController.getAllSchedules);

/**
 * @route   POST /
 * @desc    Create a new schedule (e.g., set area to AUTO at 08:00 AM)
 * @access  Private (Admin & Maintenance only)
 */
router.post('/', checkRole(['admin', 'maintenance']), schedulerController.createSchedule);

/**
 * @route   DELETE /:id
 * @desc    Delete a specific schedule
 * @access  Private (Admin & Maintenance only)
 */
router.delete('/:id', checkRole(['admin', 'maintenance']), schedulerController.deleteSchedule);

module.exports = router;