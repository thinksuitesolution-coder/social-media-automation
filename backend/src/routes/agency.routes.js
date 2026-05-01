const router = require('express').Router();
const ctrl = require('../controllers/agency.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/stats', ctrl.getStats);
router.get('/health', ctrl.getHealth);

module.exports = router;
