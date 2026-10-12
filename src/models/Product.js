const mongoose = require('mongoose');

const CATEGORIES = ['World Library', 'Acessórios', 'Moda', 'Nhonga'];

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, enum: CATEGORIES, index: true },
  stock: { type: Number, default: 0, min: 0 },
  image: { type: String, default: '' },
  description: { type: String, default: '', maxlength: 2000 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
module.exports.CATEGORIES = CATEGORIES;
