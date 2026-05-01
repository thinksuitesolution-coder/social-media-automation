const router = require('express').Router();
const ctrl = require('../controllers/posts.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/generate', ctrl.generatePost);                       // matches existing frontend
router.post('/regenerate-caption/:id', ctrl.regenerateCaption);
router.post('/regenerate-image/:id', ctrl.regenerateImage);
router.post('/regenerate-hashtags/:id', ctrl.regenerateHashtags);
router.post('/send-whatsapp/:id', ctrl.sendToWhatsApp);
router.post('/approve/:id', ctrl.approvePost);
router.post('/reject/:id', ctrl.rejectPost);
router.post('/upload-instagram/:id', ctrl.uploadToInstagram);
router.get('/single/:id', ctrl.getPost);
router.get('/:clientId', ctrl.getPosts);

module.exports = router;
