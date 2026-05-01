const router = require('express').Router();
const ctrl = require('../controllers/campaigns.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/generate', ctrl.generateCampaign);
router.get('/:clientId', ctrl.getCampaigns);
router.post('/:id/activate', ctrl.activateCampaign);

module.exports = router;
