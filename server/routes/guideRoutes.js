/**
 * Guide Routes
 * Knowledge base with an approval workflow and user ratings.
 * Base Route: /api/guides
 */
const express = require('express');
const router = express.Router();
const guideController = require('../controllers/guideController');
const upload = require('../middleware/upload');
const { verifyToken, checkRole } = require('../middleware/auth');

router.use(verifyToken);

/**
 * @route   GET /
 * @desc    List guides ordered by average rating
 * @access  Private (All authenticated users)
 */
router.get('/', guideController.getGuides);

/**
 * @route   POST /
 * @desc    Submit a new guide (starts Pending until approved)
 * @access  Private (All authenticated users)
 */
router.post('/', upload.single('media'), guideController.createGuide);

/**
 * @route   PUT /:id/review
 * @desc    Approve or reject a pending guide
 * @access  Private (Admin & Maintenance)
 */
router.put('/:id/review', checkRole(['admin', 'maintenance']), guideController.reviewGuide);

/**
 * @route   POST /:id/rate
 * @desc    Rate a guide 1–5
 * @access  Private (All authenticated users)
 */
router.post('/:id/rate', guideController.rateGuide);

/**
 * @route   DELETE /:id
 * @desc    Delete a guide (own guide, or any as admin)
 * @access  Private (Author or Admin)
 */
router.delete('/:id', guideController.deleteGuide);

module.exports = router;
