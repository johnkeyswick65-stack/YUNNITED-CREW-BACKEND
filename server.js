require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nome = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, nome + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

app.use('/uploads', express.static(uploadDir));

// Servir o frontend do YUNNITED CREW
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 2
  }
}));

const productsPath = path.join(__dirname, 'data', 'products.json');

// Status do backend
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Backend YUNNITED CREW funcionando!'
  });
});

// Login administrativo
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;

    return res.json({
      success: true,
      message: 'Login efetuado com sucesso.'
    });
  }

  res.status(401).json({
    success: false,
    message: 'Utilizador ou palavra-passe incorretos.'
  });
});

// Verificar sessão administrativa
app.get('/api/admin/check', (req, res) => {
  res.json({
    authenticated: req.session.isAdmin === true
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true,
      message: 'Sessão terminada.'
    });
  });
});

app.get('/admin/admin.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.css'));
});

// Página de login administrativa
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Proteger painel administrativo
app.get('/admin/admin.html', (req, res) => {
  if (req.session.isAdmin !== true) {
    return res.redirect('/admin/login.html');
  }

  res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

// Listar produtos
app.get('/api/products', (req, res) => {
  try {
    const products = JSON.parse(
      fs.readFileSync(productsPath, 'utf-8')
    );

    res.json({
      success: true,
      products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao ler os produtos.'
    });
  }
});


// Adicionar produto (apenas administrador)
app.post('/api/admin/products', upload.single('image'), (req, res) => {
  if (req.session.isAdmin !== true) {
    return res.status(401).json({
      success: false,
      message: 'Não autorizado.'
    });
  }

  const { name, price, category, stock, description } = req.body;

  if (!name || price === undefined || !category || stock === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Preencha os campos obrigatórios.'
    });
  }

  try {
    const products = JSON.parse(
      fs.readFileSync(productsPath, 'utf-8')
    );

    const product = {
      id: Date.now().toString(),
      name,
      price: Number(price),
      category,
      stock: Number(stock),
      description: description || '',
      image: req.file ? `/uploads/${req.file.filename}` : ''
    };

    products.push(product);

    fs.writeFileSync(
      productsPath,
      JSON.stringify(products, null, 2)
    );

    res.json({
      success: true,
      message: 'Produto adicionado com sucesso.',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao guardar o produto.'
    });
  }
});


// Editar produto (apenas administrador)
app.put('/api/admin/products/:id', upload.single('image'), (req, res) => {
  if (req.session.isAdmin !== true) {
    return res.status(401).json({
      success: false,
      message: 'Não autorizado.'
    });
  }

  try {
    const products = JSON.parse(
      fs.readFileSync(productsPath, 'utf-8')
    );

    const index = products.findIndex(
      product => product.id === req.params.id
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado.'
      });
    }

    const product = products[index];

    if (req.body.name !== undefined) product.name = req.body.name;
    if (req.body.price !== undefined) product.price = Number(req.body.price);
    if (req.body.category !== undefined) product.category = req.body.category;
    if (req.body.stock !== undefined) product.stock = Number(req.body.stock);
    if (req.body.description !== undefined) product.description = req.body.description;

    if (req.file) {
      product.image = `/uploads/${req.file.filename}`;
    }

    products[index] = product;

    fs.writeFileSync(
      productsPath,
      JSON.stringify(products, null, 2)
    );

    res.json({
      success: true,
      message: 'Produto atualizado com sucesso.',
      product
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar o produto.'
    });
  }
});


// Eliminar produto (apenas administrador)
app.delete('/api/admin/products/:id', (req, res) => {
  if (req.session.isAdmin !== true) {
    return res.status(401).json({
      success: false,
      message: 'Não autorizado.'
    });
  }

  try {
    const products = JSON.parse(
      fs.readFileSync(productsPath, 'utf-8')
    );

    const index = products.findIndex(
      product => product.id === req.params.id
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado.'
      });
    }

    const removed = products.splice(index, 1)[0];

    fs.writeFileSync(
      productsPath,
      JSON.stringify(products, null, 2)
    );

    res.json({
      success: true,
      message: 'Produto eliminado com sucesso.',
      product: removed
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao eliminar o produto.'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
