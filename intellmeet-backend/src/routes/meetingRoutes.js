const express = require('express');
const router = express.Router();
const { createMeeting, getAllMeetings } = require('../controllers/meetingController');

// When a POST request hits '/create', run the createMeeting function
router.post('/create', createMeeting);

// When a GET request hits '/all', run the getAllMeetings function
router.get('/all', getAllMeetings);

module.exports = router;