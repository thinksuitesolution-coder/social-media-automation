const router = require('express').Router();
const ctrl = require('../controllers/abtest.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/create', ctrl.createTest);
router.post('/results/:testId', ctrl.submitResults);
router.post('/generate-variants/:clientId', ctrl.generateVariants);
router.get('/:clientId', ctrl.getTests);

module.exports = router;
