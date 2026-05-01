const router = require('express').Router();
const ctrl = require('../controllers/linkbio.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Public routes (no auth)
router.get('/public/:slug', ctrl.getPublicBio);
router.post('/click/:linkId', ctrl.trackClick);

// Authenticated routes
router.use(authenticate);
router.get('/single/:id', ctrl.getSingleBio);
router.get('/:clientId', ctrl.getBios);
router.post('/', ctrl.createBio);
router.put('/:id', ctrl.updateBio);
router.post('/ai-copy', ctrl.aiCopy);
router.post('/:id/links', ctrl.addLink);
router.delete('/:id/links/:linkId', ctrl.deleteLink);

module.exports = router;
