const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const sign = (user) => jwt.sign(
  { id: user._id, username: user.username, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES || '7d' }
);

router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username e password obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password deve ter pelo menos 6 caracteres.' });
    }
    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(409).json({ success: false, message: 'Utilizador já existe.' });

    const user = await User.create({ username, password, role: 'user' });
    res.status(201).json({
      success: true,
      message: 'Utilizador criado.',
      token: sign(user),
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username e password obrigatórios.' });
    }
    const user = await User.findOne({ username: username.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Utilizador ou palavra-passe incorretos.' });
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Utilizador ou palavra-passe incorretos.' });
    }
    res.json({
      success: true,
      token: sign(user),
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (e) { next(e); }
});

router.get('/me', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
