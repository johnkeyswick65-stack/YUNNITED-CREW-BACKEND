const router = require('express').Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Guarda a imagem em memória (max 5 MB), depois stream para o Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Só imagens são aceites.'));
    }
    cb(null, true);
  },
});

const streamToCloudinary = (buffer, folder = 'yunnited/products') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    Readable.from(buffer).pipe(stream);
  });

// ---------------------------------------------------------------------------
// PÚBLICO
// ---------------------------------------------------------------------------

// GET /api/products — lista produtos ativos
router.get('/', async (req, res, next) => {
  try {
    const { category, q, limit = 100, page = 1 } = req.query;
    const filter = { active: true };
    if (category && category !== 'Todas') filter.category = category;
    if (q) filter.$or = [
      { name: new RegExp(q, 'i') },
      { description: new RegExp(q, 'i') },
    ];

    const perPage = Math.min(Number(limit) || 100, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

    const [items, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage),
      Product.countDocuments(filter),
    ]);

    res.json({ success: true, total, page: Number(page) || 1, perPage, items });
  } catch (e) { next(e); }
});

// GET /api/products/stats — contagem por categoria
router.get('/stats', async (req, res, next) => {
  try {
    const agg = await Product.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const stats = {};
    agg.forEach(({ _id, count }) => { stats[_id] = count; });
    res.json({ success: true, stats });
  } catch (e) { next(e); }
});

// GET /api/products/categories — lista do enum
router.get('/categories', (req, res) => {
  res.json({ success: true, categories: Product.CATEGORIES || [] });
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.active) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    res.json({ success: true, product });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// ADMIN (JWT obrigatório)
// ---------------------------------------------------------------------------

// POST /api/products/upload — recebe multipart, sobe ao Cloudinary, devolve URL
router.post('/upload', auth, admin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }
    const url = await streamToCloudinary(req.file.buffer);
    res.status(201).json({ success: true, url });
  } catch (e) { next(e); }
});

// POST /api/products — cria produto (image deve ser a URL do Cloudinary)
router.post('/', auth, admin, async (req, res, next) => {
  try {
    const { name, price, category, stock, image, description } = req.body || {};
    if (!name || price == null || !category) {
      return res.status(400).json({
        success: false,
        message: 'Nome, preço e categoria são obrigatórios.',
      });
    }
    const product = await Product.create({
      name: name.trim(),
      price: Number(price),
      category,
      stock: Number(stock) || 0,
      image: image || '',
      description: (description || '').trim(),
    });
    res.status(201).json({ success: true, message: 'Produto adicionado.', product });
  } catch (e) { next(e); }
});

// PUT /api/products/:id — atualiza
router.put('/:id', auth, admin, async (req, res, next) => {
  try {
    const allowed = ['name', 'price', 'category', 'stock', 'image', 'description', 'active'];
    const patch = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
    if (patch.price != null) patch.price = Number(patch.price);
    if (patch.stock != null) patch.stock = Number(patch.stock);
    if (patch.name) patch.name = patch.name.trim();
    if (patch.description) patch.description = patch.description.trim();

    const product = await Product.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    res.json({ success: true, message: 'Produto atualizado.', product });
  } catch (e) { next(e); }
});

// DELETE /api/products/:id — soft delete
router.delete('/:id', auth, admin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    res.json({ success: true, message: 'Produto eliminado.' });
  } catch (e) { next(e); }
});

module.exports = router;
