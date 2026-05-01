const router = require('express').Router();
const ctrl = require('../controllers/predict.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/improve/:postId', ctrl.improvePost);
router.post('/:postId', ctrl.predictPost);
router.get('/:postId', ctrl.getPrediction);

module.exports = router;
