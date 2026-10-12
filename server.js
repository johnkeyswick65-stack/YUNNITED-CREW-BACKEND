require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const categoryRoutes = require('./src/routes/categories');
const statsRoutes = require('./src/routes/stats');
const cloudinaryRoutes = require('./src/routes/cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Render / Cloudflare / qualquer proxy reverso

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: process.env.NODE_ENV !== 'production' ? false : undefined,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('tiny'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas tentativas. Tente novamente em 15 minutos.' },
});

app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);

if (process.env.NODE_ENV !== 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, 'public')));
  console.log('📁 [dev] a servir public/');
}

app.use((req, res) => res.status(404).json({ success: false, message: 'Rota não encontrada.' }));

app.use((err, req, res, next) => {
  console.error('[ERRO]', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Erro interno.' });
});

(async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI não definido.');
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não definido.');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB conectado');
    app.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));
  } catch (e) {
    console.error('❌ Falha ao arrancar:', e.message);
    process.exit(1);
  }
})();
