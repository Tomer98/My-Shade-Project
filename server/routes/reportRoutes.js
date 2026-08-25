/**
 * Report Routes
 * Aggregate views over maintenance activity — the specification's
 * "database questioning" for manager users.
 * Base Route: /api/reports
 */
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Reporting is a management function, so planners are excluded
router.use(verifyToken, checkRole(['admin', 'maintenance']));

/**
 * @route   GET /summary
 * @desc    Headline figures and breakdowns (?from=&to=)
 * @access  Private (Admin & Maintenance)
 */
router.get('/summary', reportController.getSummary);

/**
 * @route   GET /missions
 * @desc    Row-level mission export (?from=&to=&status=&area_id=)
 * @access  Private (Admin & Maintenance)
 */
router.get('/missions', reportController.getMissionReport);

module.exports = router;
