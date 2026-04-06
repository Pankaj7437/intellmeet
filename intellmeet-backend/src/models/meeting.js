const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    title: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    roomId: { type: String, required: true, unique: true },
    isWaitingRoom: { type: Boolean, default: false },
    status: { type: String, default: 'Scheduled' },
    summary: { type: String, default: null },
    tasks: [{
        id: { type: String, required: true },
        text: { type: String, required: true },
        status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);