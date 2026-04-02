const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { scheduleMeeting, getMeetings, deleteMeeting } = require('../controllers/meetingController');

router.post('/schedule', protect, scheduleMeeting);
router.get('/', protect, getMeetings);
router.delete('/:id', protect, deleteMeeting);

module.exports = router;