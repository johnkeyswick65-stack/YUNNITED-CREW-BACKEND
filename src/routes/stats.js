const router = require('express').Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

router.get('/', auth, admin, async (req, res, next) => {
  try {
    const [total, published, draft, archived, byCategoryRaw, totalValue] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ active: true, status: 'published' }),
      Product.countDocuments({ active: true, status: 'draft' }),
      Product.countDocuments({ active: false }),
      Product.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Product.aggregate([
        { $match: { active: true } },
        { $group: { _id: null, value: { $sum: { $multiply: ['$price', '$stock'] } } } },
      ]),
    ]);

    const categoriesCount = await Category.countDocuments({ active: true });

    const byCategory = byCategoryRaw.map((c) => ({
      name: c._id || '(sem categoria)',
      count: c.count,
    }));

    const topCategory = byCategory[0] || null;
    const stockValue = totalValue[0]?.value || 0;

    res.json({
      success: true,
      totals: { total, published, draft, archived, categories: categoriesCount },
      stockValue,
      byCategory,
      topCategory,
    });
  } catch (e) { next(e); }
});

module.exports = router;
