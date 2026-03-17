/**
 * Authentication Routes
 * Handles user login and session management.
 * Base Route: /api/auth
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @route   POST /login
 * @desc    Authenticate a user and return a JWT token
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /forgot-password
 * @desc    Generate a reset token and send a reset email
 * @access  Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route   POST /reset-password
 * @desc    Validate token and update the user's password
 * @access  Public
 */
router.post('/reset-password', authController.resetPassword);

module.exports = router;