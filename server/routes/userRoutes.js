const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authController = require('../controllers/authController'); // מייבאים גם את האימות
const { verifyToken, checkRole } = require('../middleware/auth');

/**
 * Public Routes
 */
// הנתיב הזה הולך ל-authController
router.post('/login', authController.login);

/**
 * Protected Routes (Staff/Admin)
 */
// שליפת כל המשתמשים - רק למנהלים
router.get('/', verifyToken, checkRole(['admin']), userController.getAllUsers);

// יצירת משתמש חדש - רק למנהלים
router.post('/register', verifyToken, checkRole(['admin']), userController.createUser);

// מחיקת משתמש - רק למנהלים
router.delete('/:id', verifyToken, checkRole(['admin']), userController.deleteUser);

module.exports = router;