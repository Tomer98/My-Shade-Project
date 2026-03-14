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

module.exports = router;