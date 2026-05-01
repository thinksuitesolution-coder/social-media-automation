const router = require('express').Router();
const ctrl = require('../controllers/repurpose.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/text', ctrl.repurposeText);
router.post('/blog', ctrl.repurposeBlog);
router.post('/old-post', ctrl.refreshOldPost);
router.get('/:clientId', ctrl.getRepurposed);

module.exports = router;
