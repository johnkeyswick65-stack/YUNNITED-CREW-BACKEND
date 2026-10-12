// Centraliza: JWT, chamadas à API, upload Cloudinary, mapeamento de categorias.
(function () {
  const TOKEN_KEY = 'yc_admin_token';
  const USER_KEY = 'yc_admin_user';

  // JSON (slug) <-> Backend (enum)
  const CAT_MAP_TO_API = {
    'world-library': 'World Library',
    'acessorios': 'Acessórios',
    'moda': 'Moda',
    'nhonga': 'Nhonga',
  };
  const CAT_MAP_FROM_API = Object.fromEntries(
    Object.entries(CAT_MAP_TO_API).map(([k, v]) => [v, k])
  );

  const toApiCategory = (slug) => CAT_MAP_TO_API[slug] || slug;
  const fromApiCategory = (label) => CAT_MAP_FROM_API[label] || label;

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  };
  const setSession = (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  };
  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };
  const isLogged = () => !!getToken();

  const requireLogin = () => {
    if (!isLogged()) {
      window.location.href = '/admin/login.html';
      return false;
    }
    return true;
  };

  const authHeaders = (extra = {}) => {
    const h = { ...extra };
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  };

  const request = async (path, options = {}) => {
    const res = await fetch(path, {
      ...options,
      headers: authHeaders(options.headers || {}),
    });
    if (res.status === 401) {
      clearSession();
      window.location.href = '/admin/login.html';
      throw new Error('Sessão expirada.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Erro no servidor.');
    return data;
  };

  const api = {
    // AUTH
    async login(username, password) {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Falha no login.');
      setSession(data.token, data.user);
      return data.user;
    },
    logout() { clearSession(); window.location.href = '/admin/login.html'; },

    // PERFIL
    async getMe() {
      const data = await request('/api/me');
      return data.user;
    },
    async getHistory() {
      const data = await request('/api/me/history');
      return data.items || [];
    },
    async logoutRemote() {
      try { await request('/api/logout', { method: 'POST' }); } catch {}
      clearSession();
      window.location.href = '/admin/login.html';
    },
    async logoutAll() {
      await request('/api/logout-all', { method: 'POST' });
      clearSession();
      window.location.href = '/admin/login.html';
    },

    // PRODUTOS
    async listProducts() {
      const data = await request('/api/products');
      return (data.items || []).map((p) => ({
        ...p,
        id: p._id,
        category: fromApiCategory(p.category),
      }));
    },

    async createProduct({ name, price, category, stock, description, imageUrl }) {
      return request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, price, category: toApiCategory(category),
          stock, description, image: imageUrl || '',
        }),
      });
    },

    async updateProduct(id, patch) {
      const body = { ...patch };
      if (body.category) body.category = toApiCategory(body.category);
      if (body.imageUrl !== undefined) {
        body.image = body.imageUrl;
        delete body.imageUrl;
      }
      return request('/api/products/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },

    async deleteProduct(id) {
      return request('/api/products/' + id, { method: 'DELETE' });
    },

    // CATEGORIAS
    async listCategories() {
      const data = await request('/api/categories');
      return data.items || [];
    },
    async listAllCategories() {
      const data = await request('/api/categories/all');
      return data.items || [];
    },
    async createCategory(payload) {
      return request('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async updateCategory(id, patch) {
      return request('/api/categories/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    },
    async deleteCategory(id) {
      return request('/api/categories/' + id, { method: 'DELETE' });
    },

    // UPLOAD
    async uploadImage(fileOrBlob, filename = 'produto.jpg') {
      const fd = new FormData();
      const file = fileOrBlob instanceof File
        ? fileOrBlob
        : new File([fileOrBlob], filename, { type: 'image/jpeg' });
      fd.append('image', file);
      const res = await fetch('/api/products/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      if (res.status === 401) {
        clearSession();
        window.location.href = '/admin/login.html';
        throw new Error('Sessão expirada.');
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Falha no upload.');
      return data.url;
    },
  };

  window.YCAdmin = {
    api, isLogged, requireLogin, getUser, clearSession,
    toApiCategory, fromApiCategory,
    CATEGORIES: [
      { id: 'world-library', nome: 'World Library' },
      { id: 'acessorios', nome: 'Acessórios' },
      { id: 'moda', nome: 'Moda' },
      { id: 'nhonga', nome: 'Nhonga' },
    ],
  };
})();
