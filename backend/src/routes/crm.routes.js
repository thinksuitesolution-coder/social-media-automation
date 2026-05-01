const router = require('express').Router();
const ctrl = require('../controllers/crm.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/contacts/:clientId', ctrl.getContacts);
router.post('/contacts', ctrl.createContact);
router.put('/contacts/:id', ctrl.updateContact);
router.post('/score/:id', ctrl.scoreContact);
router.get('/deals/:clientId', ctrl.getDeals);
router.post('/deals', ctrl.createDeal);
router.put('/deals/:id', ctrl.updateDeal);

module.exports = router;
