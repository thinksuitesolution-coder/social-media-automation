const router = require('express').Router();
const ctrl = require('../controllers/videoscript.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/generate', ctrl.generateScript);
router.get('/single/:scriptId', ctrl.getScript);
router.get('/:clientId', ctrl.getScripts);

module.exports = router;
