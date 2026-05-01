const router = require('express').Router();
const ctrl = require('../controllers/persona.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/build/:clientId', ctrl.buildPersona);
router.get('/:clientId', ctrl.getPersonas);
router.delete('/:personaId', ctrl.deletePersona);

module.exports = router;
