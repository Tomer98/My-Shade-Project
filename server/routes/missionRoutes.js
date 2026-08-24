/**
 * Mission Routes
 * Maintenance missions and their subtask checklists.
 * Base Route: /api/missions
 */
const express = require('express');
const router = express.Router();
const missionController = require('../controllers/missionController');
const upload = require('../middleware/upload');
const { verifyToken, checkRole } = require('../middleware/auth');

router.use(verifyToken);

/**
 * @route   GET /
 * @desc    List missions (workers see their own; managers/admins see all).
 *          Supports ?scope=today and ?status=Failed
 * @access  Private (All authenticated users)
 */
router.get('/', missionController.getMissions);

/**
 * @route   GET /history/:areaId
 * @desc    Location history — past visits, who performed them, and their notes
 * @access  Private (All authenticated users)
 */
router.get('/history/:areaId', missionController.getAreaHistory);

/**
 * @route   POST /
 * @desc    Create a mission with its subtask checklist
 * @access  Private (Admin & Maintenance)
 */
router.post('/', checkRole(['admin', 'maintenance']), missionController.createMission);

/**
 * @route   PUT /:id/assign
 * @desc    Assign or reassign a mission to a worker
 * @access  Private (Admin & Maintenance)
 */
router.put('/:id/assign', checkRole(['admin', 'maintenance']), missionController.assignMission);

/**
 * @route   PUT /subtasks/:subtaskId
 * @desc    Mark a subtask Done/Failed, with a comment and optional photo
 * @access  Private (All authenticated users; workers limited to own missions)
 */
router.put('/subtasks/:subtaskId', upload.single('photo'), missionController.updateSubtask);

/**
 * @route   PUT /:id/complete
 * @desc    Finish a mission — completes and reschedules, or fails to the manager
 * @access  Private (All authenticated users; workers limited to own missions)
 */
router.put('/:id/complete', missionController.completeMission);

/**
 * @route   POST /close-day
 * @desc    Roll all still-open missions over to tomorrow
 * @access  Private (All authenticated users)
 */
router.post('/close-day', missionController.closeDay);

/**
 * @route   DELETE /:id
 * @desc    Delete a mission
 * @access  Private (Admin only)
 */
router.delete('/:id', checkRole(['admin']), missionController.deleteMission);

module.exports = router;
