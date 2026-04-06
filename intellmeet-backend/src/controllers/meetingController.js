const Meeting = require('../models/meeting');

exports.scheduleMeeting = async (req, res) => {
    try {
        const { title, date, time, roomId, isWaitingRoom } = req.body;
        const meetDate = date || new Date().toISOString().split('T')[0];
        const meetTime = time || new Date().toTimeString().split(' ')[0];

        const newMeeting = await Meeting.create({ 
            host: req.user._id, 
            participants: [], 
            title: title || 'Instant Meeting', 
            date: meetDate, 
            time: meetTime, 
            roomId,
            isWaitingRoom: isWaitingRoom || false,
            status: 'Scheduled',
            tasks: [] 
        });
        res.status(201).json(newMeeting);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getMeetings = async (req, res) => {
    try {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const dateStr = twoDaysAgo.toISOString().split('T')[0];

        await Meeting.deleteMany({ host: req.user._id, date: { $lt: dateStr } });

        const meetings = await Meeting.find({ 
            $or: [{ host: req.user._id }, { participants: req.user._id }]
        }).sort({ date: 1, time: 1 });
        
        res.status(200).json(meetings);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getMeetingByRoomId = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ roomId: req.params.roomId });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
        res.status(200).json(meeting);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.deleteMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ _id: req.params.id });
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        if (meeting.host.toString() === req.user._id.toString()) {
            await meeting.deleteOne();
            return res.status(200).json({ message: 'Meeting deleted successfully' });
        } else if (meeting.participants.includes(req.user._id)) {
            await Meeting.updateOne({ _id: req.params.id }, { $pull: { participants: req.user._id } });
            return res.status(200).json({ message: 'Removed from your history' });
        } else {
            return res.status(403).json({ message: 'Not authorized' });
        }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateTaskStatus = async (req, res) => {
    try {
        const { roomId, taskId } = req.params;
        const { status } = req.body;
        
        const meeting = await Meeting.findOneAndUpdate(
            { roomId: roomId, "tasks.id": taskId },
            { $set: { "tasks.$.status": status } },
            { new: true }
        );

        if(!meeting) return res.status(404).json({message: "Task or Meeting not found"});
        res.status(200).json(meeting);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.deleteTask = async (req, res) => {
    try {
        const { roomId, taskId } = req.params;
        const meeting = await Meeting.findOneAndUpdate(
            { roomId: roomId },
            { $pull: { tasks: { id: taskId } } },
            { new: true }
        );
        if(!meeting) return res.status(404).json({message: "Meeting not found"});
        res.status(200).json(meeting);
    } catch (error) { res.status(500).json({ message: error.message }); }
};