const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/login', userController.login);
router.get('/', userController.getAllUsers);      // שליפת רשימה
router.post('/', userController.createUser);      // יצירה
router.delete('/:id', userController.deleteUser); // מחיקה

module.exports = router;