const router = require('express').Router();
const cloudinary = require('cloudinary').v2;
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FOLDER_PREFIX = 'yunnited/products/';

// Extrai public_id do URL Cloudinary
const publicIdFromUrl = (url) => {
  if (!url) return null;
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  return m ? m[1] : null;
};

// GET /api/cloudinary/usage — quota + uso + últimas imagens
router.get('/usage', auth, admin, async (req, res, next) => {
  try {
    const usage = await cloudinary.api.usage();
    const resources = await cloudinary.api.resources({
      resource_type: 'image', type: 'upload', max_results: 5, direction: 'desc',
    }).catch(() => ({ resources: [] }));

    const storage = usage.storage || {};
    const usedBytes = storage.usage || 0;
    const quotaBytes = storage.limit || 0;
    const usedMB = +(usedBytes / 1024 / 1024).toFixed(2);
    const quotaMB = +(quotaBytes / 1024 / 1024).toFixed(2);
    const percent = quotaBytes ? +((usedBytes / quotaBytes) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      plan: usage.plan || 'unknown',
      storage: {
        usedBytes, quotaBytes, usedMB, quotaMB, percent,
        usedFormatted: (usedMB / 1024).toFixed(3) + ' GB',
        quotaFormatted: (quotaMB / 1024).toFixed(3) + ' GB',
      },
      credits: usage.credits || null,
      objects: usage.objects || null,
      bandwidth: usage.bandwidth || null,
      recent: (resources.resources || []).map((r) => ({
        public_id: r.public_id, url: r.secure_url, bytes: r.bytes,
        createdAt: r.created_at, format: r.format,
      })),
    });
  } catch (e) { next(e); }
});

// GET /api/cloudinary/all-images — todas as imagens + marca de uso
router.get('/all-images', auth, admin, async (req, res, next) => {
  try {
    // Paginação até acabar
    let all = [];
    let cursor = null;
    do {
      const opts = { resource_type: 'image', type: 'upload', max_results: 500, prefix: FOLDER_PREFIX };
      if (cursor) opts.next_cursor = cursor;
      const page = await cloudinary.api.resources(opts);
      all = all.concat(page.resources || []);
      cursor = page.next_cursor || null;
    } while (cursor && all.length < 2000);

    // Todos os public_ids em uso
    const products = await Product.find({}, 'image images').lean();
    const inUse = new Set();
    products.forEach((p) => {
      if (p.image) {
        const id = publicIdFromUrl(p.image);
        if (id) inUse.add(id);
      }
      (p.images || []).forEach((url) => {
        const id = publicIdFromUrl(url);
        if (id) inUse.add(id);
      });
    });

    const items = all.map((r) => ({
      public_id: r.public_id,
      url: r.secure_url,
      bytes: r.bytes,
      format: r.format,
      width: r.width,
      height: r.height,
      createdAt: r.created_at,
      inUse: inUse.has(r.public_id),
    }));

    const orphans = items.filter((i) => !i.inUse);
    const totalBytes = items.reduce((s, i) => s + (i.bytes || 0), 0);
    const orphanBytes = orphans.reduce((s, i) => s + (i.bytes || 0), 0);

    res.json({
      success: true,
      total: items.length,
      inUse: items.length - orphans.length,
      orphans: orphans.length,
      totalBytes,
      orphanBytes,
      items,
    });
  } catch (e) { next(e); }
});

// DELETE /api/cloudinary/image/:publicId — só permite órfãs
router.delete('/image/:publicId(*)'.replace('(*)', '(*)'), auth, admin, async (req, res, next) => {
  try {
    const publicId = req.params.publicId;
    if (!publicId) {
      return res.status(400).json({ success: false, message: 'public_id em falta.' });
    }

    // Verificar uso
    const products = await Product.find({}, 'image images').lean();
    const used = products.some((p) => {
      const urls = [p.image, ...(p.images || [])].filter(Boolean);
      return urls.some((u) => publicIdFromUrl(u) === publicId);
    });
    if (used) {
      return res.status(409).json({
        success: false,
        message: 'Imagem em uso por um produto. Remova primeiro do produto.',
      });
    }

    const r = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    if (r.result !== 'ok' && r.result !== 'not found') {
      return res.status(500).json({ success: false, message: 'Cloudinary: ' + r.result });
    }
    res.json({ success: true, message: 'Imagem eliminada.', result: r.result });
  } catch (e) { next(e); }
});

module.exports = router;
