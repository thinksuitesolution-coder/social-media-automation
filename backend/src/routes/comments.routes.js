const router = require('express').Router();
const ctrl = require('../controllers/comments.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/generate', ctrl.generateComments);
router.post('/log', ctrl.logComment);
router.get('/logs/:clientId', ctrl.getCommentLogs);
router.get('/:clientId', ctrl.getCommentStrategies);

module.exports = router;
