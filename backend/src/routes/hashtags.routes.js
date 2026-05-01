const router = require('express').Router();
const ctrl = require('../controllers/hashtags.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/generate', ctrl.generateHashtags);
router.get('/groups/:clientId', ctrl.getGroups);
router.post('/groups', ctrl.saveGroup);
router.delete('/groups/:id', ctrl.deleteGroup);

module.exports = router;
