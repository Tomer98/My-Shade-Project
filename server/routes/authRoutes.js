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
 * @route   POST /signup
 * @desc    Self-registration; the account waits for administrator approval
 * @access  Public
 */
router.post('/signup', authController.signup);

/**
 * @route   GET /companies
 * @desc    Companies a new user can register against (populates the signup form)
 * @access  Public
 */
router.get('/companies', authController.getCompanies);

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