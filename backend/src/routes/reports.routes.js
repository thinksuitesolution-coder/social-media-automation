const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/generate', ctrl.generateReport);
router.get('/:clientId', ctrl.getReports);

module.exports = router;
