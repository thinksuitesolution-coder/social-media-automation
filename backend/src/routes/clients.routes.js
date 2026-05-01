const router = require('express').Router();
const ctrl = require('../controllers/clients.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/stats', ctrl.getDashboardStats);
router.post('/', ctrl.createClient);
router.get('/', ctrl.getClients);
router.get('/:id', ctrl.getClient);
router.put('/:id', ctrl.updateClient);
router.delete('/:id', ctrl.deleteClient);
router.post('/:id/chat', ctrl.chatWithBrand);

module.exports = router;
