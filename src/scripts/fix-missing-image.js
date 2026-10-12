require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Product = require('../models/Product');

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
      { folder: 'yunnited/products', use_filename: true, unique_filename: true, timeout: 60000 },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
  });

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

    const noImage = await Product.find({ image: '' });
    console.log(`📦 ${noImage.length} produto(s) sem imagem\n`);

    for (const prod of noImage) {
      // procura no JSON o produto correspondente (mesmo nome)
      const match = raw.find((p) => p.name.trim() === prod.name.trim() && p.image);
      if (!match) {
        console.log(`⏭  "${prod.name}" não encontrado no JSON`);
        continue;
      }
      const filename = path.basename(match.image);
      const localPath = path.join(UPLOADS_DIR, filename);
      if (!fs.existsSync(localPath)) {
        console.log(`⚠️  ficheiro em falta: ${filename}`);
        continue;
      }
      try {
        const url = await uploadImage(localPath);
        prod.image = url;
        await prod.save();
        console.log(`✅ "${prod.name}" → ${url.slice(-40)}`);
      } catch (e) {
        console.log(`❌ "${prod.name}": ${e.message}`);
      }
    }

    const remaining = await Product.countDocuments({ image: '' });
    console.log(`\nProdutos ainda sem imagem: ${remaining}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  }
})();
