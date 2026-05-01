const router = require('express').Router();
const ctrl = require('../controllers/billing.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/subscription', ctrl.getSubscription);
router.get('/usage', ctrl.getUsage);
router.get('/invoices', ctrl.getInvoices);
router.post('/upgrade', ctrl.upgrade);

module.exports = router;
