const jwt = require('jsonwebtoken');
const Session = require('../models/Session');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token em falta.' });
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado.' });
  }
  try {
    const session = await Session.findOne({ sessionId: payload.sid, userId: payload.id });
    if (!session || !session.active) {
      return res.status(401).json({ success: false, message: 'Sessão encerrada. Faça login novamente.' });
    }
    req.user = payload;
    req.session = session;
    next();
  } catch (e) {
    next(e);
  }
};
