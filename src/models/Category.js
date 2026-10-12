const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name:   { type: String, required: true, unique: true, trim: true, maxlength: 60 },
  slug:   { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  icon:   { type: String, default: '' },   // URL Cloudinary (opcional)
  color:  { type: String, default: '#000000' },
  order:  { type: Number, default: 0, index: true },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
