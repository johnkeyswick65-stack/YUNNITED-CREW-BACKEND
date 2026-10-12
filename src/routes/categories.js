const router = require('express').Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const slugify = (s) => s
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// Público — lista categorias ativas + contagem de produtos
router.get('/', async (req, res, next) => {
  try {
    const cats = await Category.find({ active: true }).sort({ order: 1, name: 1 }).lean();
    const counts = await Product.aggregate([
      { $match: { active: true, status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    res.json({
      success: true,
      items: cats.map((c) => ({ ...c, productCount: map[c.name] || 0 })),
    });
  } catch (e) { next(e); }
});

// Admin — lista todas (inclui inativas)
router.get('/all', auth, admin, async (req, res, next) => {
  try {
    const cats = await Category.find().sort({ order: 1, name: 1 });
    res.json({ success: true, items: cats });
  } catch (e) { next(e); }
});

// Criar
router.post('/', auth, admin, async (req, res, next) => {
  try {
    const { name, order, active, icon, color } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome obrigatório.' });
    }
    const slug = slugify(name);
    const exists = await Category.findOne({ $or: [{ name: name.trim() }, { slug }] });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Categoria já existe.' });
    }
    const cat = await Category.create({
      name: name.trim(),
      slug,
      order: Number(order) || 0,
      active: active !== false,
      icon: icon || '',
      color: color || '#000000',
    });
    res.status(201).json({ success: true, category: cat });
  } catch (e) { next(e); }
});

// Editar
router.put('/:id', auth, admin, async (req, res, next) => {
  try {
    const patch = {};
    if (req.body.name !== undefined) {
      patch.name = req.body.name.trim();
      patch.slug = slugify(req.body.name);
    }
    if (req.body.order !== undefined) patch.order = Number(req.body.order);
    if (req.body.active !== undefined) patch.active = !!req.body.active;
    if (req.body.icon !== undefined) patch.icon = req.body.icon || '';
    if (req.body.color !== undefined) patch.color = req.body.color || '#000000';

    const before = await Category.findById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });

    // Se o nome mudou, atualizar produtos que a usavam
    if (patch.name && patch.name !== before.name) {
      await Product.updateMany({ category: before.name }, { category: patch.name });
    }

    const cat = await Category.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    res.json({ success: true, category: cat });
  } catch (e) { next(e); }
});

// Apagar (só se vazia)
router.delete('/:id', auth, admin, async (req, res, next) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });

    const inUse = await Product.countDocuments({ category: cat.name, active: true });
    if (inUse > 0) {
      return res.status(409).json({
        success: false,
        message: `Categoria tem ${inUse} produto(s). Move-os ou desativa a categoria.`,
      });
    }
    await Category.deleteOne({ _id: cat._id });
    res.json({ success: true, message: 'Categoria removida.' });
  } catch (e) { next(e); }
});

module.exports = router;
