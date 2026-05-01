const router = require('express').Router();
const ctrl = require('../controllers/scheduler.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/optimize/:clientId', ctrl.optimizeSchedule);
router.post('/pattern/:clientId', ctrl.recordPattern);
router.get('/:clientId', ctrl.getSchedule);

module.exports = router;
