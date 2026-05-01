const router = require('express').Router();
const ctrl = require('../controllers/calendar.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/generate', ctrl.generateCalendar);
router.get('/:clientId/:month/:year', ctrl.getCalendar);
router.put('/day/:dayId', ctrl.updateCalendarDay);
router.delete('/:clientId/:month/:year', ctrl.deleteCalendar);

module.exports = router;
