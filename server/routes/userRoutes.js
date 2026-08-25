/**
 * User Routes
 * Handles administrative management of users (create, read, delete).
 * Base Route: /api/users
 */
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkRole } = require('../middleware/auth');

router.use(verifyToken, checkRole(['admin']));

/**
 * @route   GET /
 * @desc    Get a list of all users (excluding passwords)
 * @access  Private (Admin only)
 */
router.get('/', userController.getAllUsers);

/**
 * @route   POST /
 * @desc    Create a new user account (Staff/Admin)
 * @access  Private (Admin only)
 */
router.post('/', userController.createUser);

/**
 * @route   PUT /:id/review
 * @desc    Approve or reject a self-registered account
 * @access  Private (Admin only)
 */
router.put('/:id/review', userController.reviewUser);

/**
 * @route   PUT /:id
 * @desc    Update an existing user's role/permission
 * @access  Private (Admin only)
 */
router.put('/:id', userController.updateUser);

/**
 * @route   DELETE /:id
 * @desc    Delete a user from the system
 * @access  Private (Admin only)
 */
router.delete('/:id', userController.deleteUser);

module.exports = router;