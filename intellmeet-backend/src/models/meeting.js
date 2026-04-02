const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    roomId: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);