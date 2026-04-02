const Meeting = require('../models/meeting');

exports.scheduleMeeting = async (req, res) => {
    try {
        const { title, date, time, roomId } = req.body;
        const newMeeting = await Meeting.create({ host: req.user._id, title, date, time, roomId });
        res.status(201).json(newMeeting);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getMeetings = async (req, res) => {
    try {
        const meetings = await Meeting.find({ host: req.user._id }).sort({ date: 1, time: 1 });
        res.status(200).json(meetings);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.deleteMeeting = async (req, res) => {
    try {
        // Find the meeting FIRST, and check if the logged-in user is the HOST
        const meeting = await Meeting.findOne({ _id: req.params.id, host: req.user._id });
        
        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found or you are not authorized to delete it' });
        }

        await meeting.deleteOne();
        res.status(200).json({ message: 'Meeting deleted successfully' });
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};