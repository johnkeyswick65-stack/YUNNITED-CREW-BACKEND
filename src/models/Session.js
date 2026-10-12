const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId:{ type: String, required: true, unique: true, index: true },
  ip:       { type: String, default: '' },
  userAgent:{ type: String, default: '' },
  active:   { type: Boolean, default: true, index: true },
  createdAt:{ type: Date, default: Date.now, expires: 60 * 60 * 24 * 8 },
}, { versionKey: false });

module.exports = mongoose.model('Session', sessionSchema);
