const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
// router.post('/register', authController.register); // אופציונלי להמשך

module.exports = router;