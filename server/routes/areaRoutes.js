const express = require('express');
const router = express.Router();
const areaController = require('../controllers/areaController');

router.get('/', areaController.getAllAreas);

// --- חשוב! הנתיב הספציפי (global) חייב להיות *לפני* הנתיב הדינמי (:id) ---
router.put('/global/state', areaController.updateGlobalState); // <--- הנה הוא ראשון

// עכשיו הנתיב הדינמי יתפוס רק מספרים אמיתיים
router.put('/:id/state', areaController.updateAreaState); 

module.exports = router;