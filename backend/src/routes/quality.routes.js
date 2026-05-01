const router = require('express').Router();
const ctrl = require('../controllers/quality.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/check/:postId', ctrl.checkQuality);
router.get('/:postId', ctrl.getQualityCheck);
router.post('/check-text', ctrl.checkText);

module.exports = router;
