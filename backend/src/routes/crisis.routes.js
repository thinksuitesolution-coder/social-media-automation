const router = require('express').Router();
const ctrl = require('../controllers/crisis.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/analyze/:clientId', ctrl.analyzeCrisis);
router.post('/mention', ctrl.addMention);
router.post('/resolve/:alertId', ctrl.resolveAlert);
router.get('/history/:clientId', ctrl.getCrisisHistory);
router.get('/:clientId', ctrl.getActiveAlerts);

module.exports = router;
