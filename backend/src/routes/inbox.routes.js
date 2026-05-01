const router = require('express').Router();
const ctrl = require('../controllers/inbox.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/:clientId', ctrl.getMessages);
router.post('/message', ctrl.saveMessage);
router.post('/suggest-reply/:messageId', ctrl.suggestReply);
router.post('/reply/:messageId', ctrl.sendReply);
router.put('/read/:messageId', ctrl.markRead);
router.put('/assign/:messageId', ctrl.assignMessage);

module.exports = router;
