require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

const SEED = [
  { name: 'World Library', slug: 'world-library', order: 1 },
  { name: 'Acessórios',    slug: 'acessorios',    order: 2 },
  { name: 'Moda',          slug: 'moda',          order: 3 },
  { name: 'Nhonga',        slug: 'nhonga',        order: 4 },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    for (const c of SEED) {
      const exists = await Category.findOne({ slug: c.slug });
      if (exists) {
        console.log(`⏭  ${c.name} (já existe)`);
        continue;
      }
      await Category.create(c);
      console.log(`✅ ${c.name}`);
    }
    console.log('\nCategorias na DB:', await Category.countDocuments());
    process.exit(0);
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
})();
