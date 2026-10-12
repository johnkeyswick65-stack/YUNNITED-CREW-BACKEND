const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const LoginHistory = require('../models/LoginHistory');
const auth = require('../middleware/auth');

const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const sign = (user, sessionId) => jwt.sign(
  { id: user._id, username: user.username, role: user.role, sid: sessionId },
  process.env.JWT_SECRET,
  { expiresIn: JWT_EXPIRES }
);

const logAttempt = (data) => LoginHistory.create(data).catch(() => {});

const clientInfo = (req) => ({
  ip: req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || '',
  userAgent: (req.headers['user-agent'] || '').slice(0, 250),
});

// ---------------------------------------------------------------------------
// REGISTO
// ---------------------------------------------------------------------------
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const info = clientInfo(req);
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username e password obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password deve ter pelo menos 6 caracteres.' });
    }
    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(409).json({ success: false, message: 'Utilizador já existe.' });

    const user = await User.create({ username, password, role: 'user' });
    const sessionId = crypto.randomUUID();
    await Session.create({ userId: user._id, sessionId, ...info, active: true });
    await logAttempt({ userId: user._id, username: user.username, ...info, success: true });

    res.status(201).json({
      success: true,
      message: 'Utilizador criado.',
      token: sign(user, sessionId),
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// LOGIN — sessão única por utilizador
// ---------------------------------------------------------------------------
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const info = clientInfo(req);
    const uname = (username || '').toLowerCase().trim();

    if (!username || !password) {
      await logAttempt({ username: uname, ...info, success: false });
      return res.status(400).json({ success: false, message: 'Username e password obrigatórios.' });
    }

    const user = await User.findOne({ username: uname }).select('+password');
    if (!user) {
      await logAttempt({ username: uname, ...info, success: false });
      return res.status(401).json({ success: false, message: 'Utilizador ou palavra-passe incorretos.' });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      await logAttempt({ userId: user._id, username: user.username, ...info, success: false });
      return res.status(401).json({ success: false, message: 'Utilizador ou palavra-passe incorretos.' });
    }

    // Sessão única: encerra todas as sessões ativas anteriores deste user
    await Session.updateMany({ userId: user._id, active: true }, { active: false });

    const sessionId = crypto.randomUUID();
    await Session.create({ userId: user._id, sessionId, ...info, active: true });
    await logAttempt({ userId: user._id, username: user.username, ...info, success: true });

    res.json({
      success: true,
      token: sign(user, sessionId),
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// LOGOUT (encerra a sessão atual)
// ---------------------------------------------------------------------------
router.post('/logout', auth, async (req, res, next) => {
  try {
    await Session.updateOne({ sessionId: req.session.sessionId }, { active: false });
    res.json({ success: true, message: 'Sessão encerrada.' });
  } catch (e) { next(e); }
});

// Encerra todas as sessões do utilizador (noutros dispositivos também)
router.post('/logout-all', auth, async (req, res, next) => {
  try {
    await Session.updateMany({ userId: req.user.id }, { active: false });
    res.json({ success: true, message: 'Todas as sessões foram encerradas.' });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// PERFIL + histórico de acessos (últimos 5)
// ---------------------------------------------------------------------------
router.get('/me', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.get('/me/history', auth, async (req, res, next) => {
  try {
    const items = await LoginHistory
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('ip userAgent success createdAt -_id');
    res.json({ success: true, items });
  } catch (e) { next(e); }
});

module.exports = router;
