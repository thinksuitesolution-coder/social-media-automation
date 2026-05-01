const router = require('express').Router();
const ctrl = require('../controllers/growth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/advise/:clientId', ctrl.generateAdvice);
router.get('/latest/:clientId', ctrl.getLatestAdvice);
router.get('/:clientId', ctrl.getAdvice);

module.exports = router;
