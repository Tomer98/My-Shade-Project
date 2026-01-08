const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');

router.get('/', schedulerController.getAllSchedules);
router.post('/', schedulerController.createSchedule);
router.delete('/:id', schedulerController.deleteSchedule);

module.exports = router;