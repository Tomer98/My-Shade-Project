const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { verifyToken, checkRole } = require('../middleware/auth'); // <--- ייבוא האבטחה

// 1. חובה להיות מחובר כדי לעשות כל פעולה בנתיב הזה
router.use(verifyToken);

// 2. הגדרת הנתיבים עם הרשאות ספציפיות

// כולם (מחוברים) יכולים לראות התראות וליצור חדשות
router.get('/', alertController.getAllAlerts);
router.post('/', alertController.createAlert);

// רק אנשי תחזוקה ומנהלים יכולים לעדכן סטטוס (לטפל בתקלה)
router.put('/:id', checkRole(['admin', 'maintenance']), alertController.updateAlert);

// רק מנהל מערכת (Admin) יכול למחוק התראות מההיסטוריה
router.delete('/:id', checkRole(['admin']), alertController.deleteAlert);

module.exports = router;