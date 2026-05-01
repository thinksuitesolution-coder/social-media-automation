const router = require('express').Router();
const { verifyWebhook, handleWebhook } = require('../controllers/webhook.controller');

router.get('/whatsapp', verifyWebhook);
router.post('/whatsapp', handleWebhook);

module.exports = router;
