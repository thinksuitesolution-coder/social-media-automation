const router = require('express').Router();
const ctrl = require('../controllers/competitors.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/:clientId', ctrl.getCompetitors);
router.post('/', ctrl.addCompetitor);
router.post('/analyze/:id', ctrl.analyzeCompetitor);
router.delete('/:id', ctrl.deleteCompetitor);

module.exports = router;
