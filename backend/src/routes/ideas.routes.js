const router = require('express').Router();
const ctrl = require('../controllers/ideas.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/generate', ctrl.generateIdeas);
router.get('/:clientId', ctrl.getIdeas);
router.post('/', ctrl.saveIdea);
router.put('/:id', ctrl.updateIdea);

module.exports = router;
