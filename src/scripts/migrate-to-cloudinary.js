require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Product = require('../models/Product');

// Mapeamento: JSON (slug) -> Model (enum)
const CATEGORY_MAP = {
  'world-library': 'World Library',
  'acessorios': 'Acessórios',
  'moda': 'Moda',
  'nhonga': 'Nhonga',
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ROOT = path.join(__dirname, '..', '..');
const JSON_PATH = path.join(ROOT, 'data', 'products.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

const uploadImage = (localPath) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      localPath,
      { folder: 'yunnited/products', use_filename: true, unique_filename: true },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
  });

(async () => {
  const args = process.argv.slice(2);
  const clean = args.includes('--clean');

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Mongo conectado');

    const existing = await Product.countDocuments();
    if (existing > 0 && !clean) {
      console.log(`⚠️  Já existem ${existing} produtos na DB.`);
      console.log('   Para limpar antes de migrar: node src/scripts/migrate-to-cloudinary.js --clean');
      process.exit(1);
    }
    if (existing > 0 && clean) {
      await Product.deleteMany({});
      console.log(`🗑️  Removidos ${existing} produtos existentes`);
    }

    const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    console.log(`📦 ${raw.length} produtos a migrar\n`);

    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const tag = `[${i + 1}/${raw.length}]`;

      const category = CATEGORY_MAP[p.category];
      if (!category) {
        console.log(`${tag} ⏭  "${p.name}" — categoria "${p.category}" desconhecida, saltado`);
        continue;
      }

      let imageUrl = '';
      if (p.image && p.image.startsWith('/uploads/')) {
        const filename = path.basename(p.image);
        const localPath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(localPath)) {
          try {
            imageUrl = await uploadImage(localPath);
            console.log(`${tag} ⬆️  ${p.name} → ${imageUrl.slice(-40)}`);
          } catch (e) {
            console.log(`${tag} ❌ upload falhou "${filename}": ${e.message}`);
          }
        } else {
          console.log(`${tag} ⚠️  imagem em falta: ${filename}`);
        }
      }

      await Product.create({
        name: p.name.trim(),
        price: Number(p.price),
        category,
        stock: Number(p.stock) || 0,
        image: imageUrl,
        description: (p.description || '').trim(),
        active: true,
      });
    }

    const total = await Product.countDocuments();
    console.log(`\n✅ Migração concluída. Total na DB: ${total}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  }
})();
