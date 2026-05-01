const router = require('express').Router();
const ctrl = require('../controllers/workflows.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/:clientId', ctrl.getWorkflows);
router.post('/', ctrl.createWorkflow);
router.put('/:id/default', ctrl.setDefault);
router.delete('/:id', ctrl.deleteWorkflow);

module.exports = router;
