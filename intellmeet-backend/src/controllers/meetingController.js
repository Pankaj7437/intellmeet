const Meeting = require('../models/meeting');

exports.scheduleMeeting = async (req, res) => {
    try {
        const { title, date, time, roomId, isWaitingRoom } = req.body;
        
        const meetDate = date || new Date().toISOString().split('T')[0];
        const meetTime = time || new Date().toTimeString().split(' ')[0];

        const newMeeting = await Meeting.create({ 
            host: req.user._id, 
            participants: [], // Starts empty
            title: title || 'Instant Meeting', 
            date: meetDate, 
            time: meetTime, 
            roomId,
            isWaitingRoom: isWaitingRoom || false
        });
        res.status(201).json(newMeeting);
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};

exports.getMeetings = async (req, res) => {
    try {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const dateStr = twoDaysAgo.toISOString().split('T')[0];

        // Host ki 2 din purani meeting auto-delete hogi
        await Meeting.deleteMany({ host: req.user._id, date: { $lt: dateStr } });

        // 🔥 NAYA: Find meetings jahan aap Host ho YA Participants list mein ho
        const meetings = await Meeting.find({ 
            $or: [
                { host: req.user._id },
                { participants: req.user._id }
            ]
        }).sort({ date: 1, time: 1 });
        
        res.status(200).json(meetings);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.deleteMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ _id: req.params.id });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        if (meeting.host.toString() === req.user._id.toString()) {
            // Agar Host ne delete kiya to sabke liye delete
            await meeting.deleteOne();
            return res.status(200).json({ message: 'Meeting deleted successfully' });
        } else if (meeting.participants.includes(req.user._id)) {
            // Agar participant ne kiya toh sirf uski history se hatega
            await Meeting.updateOne({ _id: req.params.id }, { $pull: { participants: req.user._id } });
            return res.status(200).json({ message: 'Removed from your history' });
        } else {
            return res.status(403).json({ message: 'Not authorized' });
        }
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
};