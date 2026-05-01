const router = require('express').Router();
const ctrl = require('../controllers/visualstyle.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/train/:clientId', ctrl.trainVisualStyle);
router.get('/:clientId', ctrl.getVisualStyle);
router.post('/generate/:clientId', ctrl.generateBrandedImagePrompt);

module.exports = router;
