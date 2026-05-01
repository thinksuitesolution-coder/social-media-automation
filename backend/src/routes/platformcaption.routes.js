const router = require('express').Router();
const ctrl = require('../controllers/platformcaption.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/generate', ctrl.generateMultiPlatform);
router.post('/adapt', ctrl.adaptCaption);

module.exports = router;
