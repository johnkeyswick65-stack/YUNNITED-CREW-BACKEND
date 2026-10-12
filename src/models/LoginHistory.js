const mongoose = require('mongoose');

// Nunca guardar password nem token aqui. Só IP, user-agent e resultado.
const loginHistorySchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  username: { type: String, default: '' },
  ip:       { type: String, default: '' },
  userAgent:{ type: String, default: '' },
  success:  { type: Boolean, required: true },
  createdAt:{ type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
}, { versionKey: false });

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
