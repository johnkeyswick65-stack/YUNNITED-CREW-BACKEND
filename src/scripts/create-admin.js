require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const [, , username, password] = process.argv;
  if (!username || !password) {
    console.error('Uso: node src/scripts/create-admin.js <username> <password>');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      existing.role = 'admin';
      existing.password = password; // trigger do pre-save re-hash
      await existing.save();
      console.log(`✅ Utilizador "${username}" promovido a admin e password atualizada.`);
    } else {
      await User.create({ username, password, role: 'admin' });
      console.log(`✅ Admin "${username}" criado.`);
    }
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  }
})();
