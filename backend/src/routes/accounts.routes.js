const router = require('express').Router();
const ctrl = require('../controllers/accounts.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/connect', ctrl.addAccount);
router.get('/:clientId', ctrl.getAccounts);
router.put('/:id/toggle', ctrl.toggleAccount);
router.delete('/:id', ctrl.deleteAccount);
router.get('/:id/health', ctrl.checkHealth);
router.post('/:id/refresh', ctrl.refreshToken);

module.exports = router;
