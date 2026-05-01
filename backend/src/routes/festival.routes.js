const router = require('express').Router();
const ctrl = require('../controllers/festival.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/upcoming', ctrl.getUpcomingFestivals);
router.post('/generate', ctrl.generateFestivalContent);
router.get('/client/:clientId', ctrl.getClientFestivalContent);

module.exports = router;
