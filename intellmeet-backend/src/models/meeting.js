// src/models/Meeting.js
const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['scheduled', 'live', 'completed'], default: 'scheduled' },
  aiSummary: { type: String, default: '' },
  actionItems: [{
    task: String,
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'done'], default: 'pending' }
  }],
  startTime: Date,
  endTime: Date,
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);