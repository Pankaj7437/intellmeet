const Meeting = require('../models/meeting'); // Notice the lowercase 'm' to match your file name!

// 1. Create a new meeting
exports.createMeeting = async (req, res) => {
    try {
        const { title, hostId } = req.body;
        
        const newMeeting = await Meeting.create({
            title,
            host: hostId,
            status: 'scheduled'
        });

        res.status(201).json(newMeeting);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Get all meetings
exports.getAllMeetings = async (req, res) => {
    try {
        const meetings = await Meeting.find();
        res.status(200).json(meetings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};