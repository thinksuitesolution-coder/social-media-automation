const router = require('express').Router();
const ctrl = require('../controllers/voice.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/train/:clientId', ctrl.trainVoice);
router.get('/:clientId', ctrl.getVoice);
router.post('/test/:clientId', ctrl.testVoice);
router.put('/retrain/:clientId', ctrl.retrainVoice);

module.exports = router;
