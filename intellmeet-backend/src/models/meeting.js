const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 🔥 NEW: Meets join karne walo ki list
    title: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    roomId: { type: String, required: true, unique: true },
    isWaitingRoom: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);