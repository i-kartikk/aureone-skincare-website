const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const seed = require('./seed');

const IS_VERCEL = !!process.env.VERCEL;
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = IS_VERCEL ? '/tmp/aureone/data' : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = IS_VERCEL ? '/tmp/aureone/uploads' : path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- password hashing ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

/* ---------- JSON file database ---------- */
let db;
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  // ensure coupons array exists for existing databases
  if (!db.coupons) db.coupons = [];
} else {
  db = seed(hashPassword);
  save();
  console.log('Created data/db.json with starter content.');
}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
const uid = (prefix = '') => prefix + crypto.randomBytes(6).toString('hex');
const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uid();
const clean = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------- sessions ---------- */
const sessions = new Map(); // token -> { username, expires }
const SESSION_TTL = 1000 * 60 * 60 * 12;
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function requireAdmin(req, res, next) {
  const token = getCookie(req, 'aureone_admin');
  const s = token && sessions.get(token);
  if (!s || s.expires < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Not authenticated' });
  }
  s.expires = Date.now() + SESSION_TTL;
  req.admin = s;
  next();
}
const loginAttempts = new Map(); // ip -> { count, until }

/* ---------- uploads ---------- */
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${uid()}${ALLOWED[file.mimetype]}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => cb(ALLOWED[file.mimetype] ? null : new Error('Only image files are allowed'), !!ALLOWED[file.mimetype])
});

/* ---------- app ---------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(PUBLIC_DIR, { index: false }));

const publicProduct = p => {
  const { createdAt, updatedAt, ...rest } = p;
  return rest;
};

/* ---------- coupon helpers ---------- */
function validateCoupon(code, subtotal) {
  const c = (db.coupons || []).find(c => c.active && c.code.toUpperCase() === String(code).toUpperCase().trim());
  if (!c) return { valid: false, error: 'Invalid coupon code.' };
  const today = new Date().toISOString().slice(0, 10);
  if (c.validFrom && today < c.validFrom) return { valid: false, error: 'This coupon is not yet active.' };
  if (c.validUntil && today > c.validUntil) return { valid: false, error: 'This coupon has expired.' };
  if (c.usageLimit > 0 && c.usageCount >= c.usageLimit) return { valid: false, error: 'This coupon has been fully redeemed.' };
  if (subtotal < c.minOrder) return { valid: false, error: `Minimum order of ₹${c.minOrder} required for this coupon.` };
  let discount;
  if (c.type === 'percent') {
    discount = Math.round(subtotal * c.value / 100);
    if (c.maxDiscount > 0) discount = Math.min(discount, c.maxDiscount);
  } else {
    discount = c.value;
  }
  discount = Math.min(discount, subtotal);
  return { valid: true, coupon: c, discount, description: c.description };
}

/* ----- public API ----- */
app.get('/api/settings', (req, res) => res.json(db.settings));

app.get('/api/products', (req, res) => {
  res.json(db.products.filter(p => p.active).map(publicProduct));
});

app.get('/api/products/:slug', (req, res) => {
  const p = db.products.find(p => p.active && (p.slug === req.params.slug || p.id === req.params.slug));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(publicProduct(p));
});

app.get('/api/reviews', (req, res) => res.json(db.reviews || []));

/* ----- public coupon endpoints ----- */
app.get('/api/offers', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const active = (db.coupons || []).filter(c =>
    c.active &&
    (!c.validFrom || today >= c.validFrom) &&
    (!c.validUntil || today <= c.validUntil) &&
    (c.usageLimit <= 0 || c.usageCount < c.usageLimit)
  ).map(c => ({
    code: c.code,
    type: c.type,
    value: c.value,
    minOrder: c.minOrder,
    maxDiscount: c.maxDiscount,
    validUntil: c.validUntil,
    description: c.description
  }));
  res.json(active);
});

app.post('/api/coupons/apply', (req, res) => {
  const { code, subtotal } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Please enter a coupon code.' });
  const result = validateCoupon(code, Number(subtotal) || 0);
  if (!result.valid) return res.status(400).json({ error: result.error });
  res.json({ discount: result.discount, code: result.coupon.code, description: result.description });
});

app.post('/api/orders', (req, res) => {
  const c = req.body.customer || {};
  const customer = {
    name: clean(c.name, 120), email: clean(c.email, 160), phone: clean(c.phone, 30),
    address: clean(c.address, 400), city: clean(c.city, 80), state: clean(c.state, 80), pincode: clean(c.pincode, 12)
  };
  if (!customer.name || !isEmail(customer.email) || !customer.phone || !customer.address || !customer.city || !customer.pincode) {
    return res.status(400).json({ error: 'Please complete all required delivery details.' });
  }
  const items = [];
  for (const it of Array.isArray(req.body.items) ? req.body.items : []) {
    const p = db.products.find(p => p.id === it.id && p.active);
    const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
    if (!p) return res.status(400).json({ error: 'A product in your bag is no longer available.' });

    // Determine stock from variant if specified
    let variantSize = it.size || null;
    let stockSource = p;
    let itemPrice = p.price;
    let itemSize = p.size;
    if (variantSize && Array.isArray(p.variants)) {
      const v = p.variants.find(v => v.size === variantSize);
      if (v) { stockSource = v; itemPrice = v.price; itemSize = v.size; }
    }

    if (stockSource.stock < qty) return res.status(400).json({ error: `Only ${stockSource.stock} of ${p.name} (${itemSize}) left in stock.` });
    items.push({ id: p.id, name: p.name, subtitle: p.subtitle, image: p.images[0], price: itemPrice, size: itemSize, qty });
  }
  if (!items.length) return res.status(400).json({ error: 'Your bag is empty.' });

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  // Apply coupon if provided
  let discount = 0;
  let couponCode = null;
  const couponInput = clean(req.body.coupon, 60);
  if (couponInput) {
    const cv = validateCoupon(couponInput, subtotal);
    if (!cv.valid) return res.status(400).json({ error: cv.error });
    discount = cv.discount;
    couponCode = cv.coupon.code;
    cv.coupon.usageCount = (cv.coupon.usageCount || 0) + 1;
  }

  const shipping = (subtotal - discount) <= 0 || subtotal >= db.settings.freeShippingThreshold ? 0 : Number(db.settings.shippingFee) || 0;
  const total = Math.max(0, subtotal - discount) + shipping;

  // Deduct stock
  items.forEach(i => {
    const p = db.products.find(p => p.id === i.id);
    if (p) {
      // Deduct from variant if it exists
      if (i.size && Array.isArray(p.variants)) {
        const v = p.variants.find(v => v.size === i.size);
        if (v) v.stock = Math.max(0, v.stock - i.qty);
      }
      // Also deduct from main product stock if variant matches or no variants
      if (!Array.isArray(p.variants) || !p.variants.length || p.size === i.size) {
        p.stock = Math.max(0, p.stock - i.qty);
      }
    }
  });

  const order = {
    id: uid(),
    number: 'AUR' + String(1001 + db.orders.length),
    customer, items, subtotal, discount, coupon: couponCode, shipping, total,
    payment: 'Cash on Delivery',
    note: clean(req.body.note, 500),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  db.orders.unshift(order);
  save();
  res.status(201).json({ number: order.number, total: order.total });
});

app.post('/api/contact', (req, res) => {
  const m = { name: clean(req.body.name, 120), email: clean(req.body.email, 160), subject: clean(req.body.subject, 160), message: clean(req.body.message, 3000) };
  if (!m.name || !isEmail(m.email) || !m.message) return res.status(400).json({ error: 'Please share your name, a valid email and a message.' });
  db.messages.unshift({ id: uid(), ...m, read: false, createdAt: new Date().toISOString() });
  save();
  res.status(201).json({ ok: true });
});

app.post('/api/subscribe', (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!db.subscribers.some(s => s.email === email)) {
    db.subscribers.unshift({ id: uid(), email, createdAt: new Date().toISOString() });
    save();
  }
  res.status(201).json({ ok: true });
});

/* ----- admin auth ----- */
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip;
  const att = loginAttempts.get(ip);
  if (att && att.until > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const { username, password } = req.body || {};
  if (username !== db.admin.username || !verifyPassword(String(password || ''), db.admin.password)) {
    const count = (att?.count || 0) + 1;
    loginAttempts.set(ip, { count, until: count >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, expires: Date.now() + SESSION_TTL });
  res.setHeader('Set-Cookie', `aureone_admin=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${IS_VERCEL ? '; Secure' : ''}`);
  res.json({ username });
});

app.post('/api/admin/logout', (req, res) => {
  const token = getCookie(req, 'aureone_admin');
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `aureone_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${IS_VERCEL ? '; Secure' : ''}`);
  res.json({ ok: true });
});

app.use('/api/admin', requireAdmin);

app.get('/api/admin/me', (req, res) => res.json({ username: req.admin.username }));

app.post('/api/admin/password', (req, res) => {
  const { current, next, username } = req.body || {};
  if (!verifyPassword(String(current || ''), db.admin.password)) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (String(next || '').length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  db.admin.password = hashPassword(String(next));
  if (username && clean(username, 60)) db.admin.username = clean(username, 60);
  save();
  res.json({ ok: true });
});

/* ----- dashboard ----- */
app.get('/api/admin/stats', (req, res) => {
  const live = db.orders.filter(o => o.status !== 'cancelled');
  const revenue = live.reduce((s, o) => s + o.total, 0);
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    const dayOrders = live.filter(o => o.createdAt.slice(0, 10) === key);
    return { date: key, revenue: dayOrders.reduce((s, o) => s + o.total, 0), orders: dayOrders.length };
  });
  const sold = {};
  live.forEach(o => o.items.forEach(i => { sold[i.name] = (sold[i.name] || 0) + i.qty; }));
  res.json({
    revenue,
    orders: db.orders.length,
    pendingOrders: db.orders.filter(o => o.status === 'pending').length,
    products: db.products.length,
    lowStock: db.products.filter(p => p.stock <= 10).map(p => ({ id: p.id, name: p.name, stock: p.stock })),
    unreadMessages: db.messages.filter(m => !m.read).length,
    subscribers: db.subscribers.length,
    activeCoupons: (db.coupons || []).filter(c => c.active).length,
    days,
    topProducts: Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty })),
    recentOrders: db.orders.slice(0, 6)
  });
});

/* ----- products ----- */
function productFromBody(b, existing = {}) {
  const lines = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => clean(s, 200)).filter(Boolean);
  const ingredients = (Array.isArray(b.ingredients) ? b.ingredients : [])
    .map(i => ({ name: clean(i.name, 120), note: clean(i.note, 300) })).filter(i => i.name);
  const variants = (Array.isArray(b.variants) ? b.variants : [])
    .map(v => ({
      size: clean(v.size, 40),
      price: Math.max(0, Number(v.price) || 0),
      comparePrice: Math.max(0, Number(v.comparePrice) || 0),
      stock: Math.max(0, parseInt(v.stock, 10) || 0)
    })).filter(v => v.size);
  return {
    ...existing,
    name: clean(b.name, 120),
    subtitle: clean(b.subtitle, 160),
    category: clean(b.category, 60) || 'Treat',
    price: Math.max(0, Number(b.price) || 0),
    comparePrice: Math.max(0, Number(b.comparePrice) || 0),
    size: clean(b.size, 40),
    stock: Math.max(0, parseInt(b.stock, 10) || 0),
    variants,
    tagline: clean(b.tagline, 200),
    description: clean(b.description, 4000),
    benefits: lines(b.benefits),
    ingredients,
    howToUse: clean(b.howToUse, 1000),
    skinTypes: clean(b.skinTypes, 120),
    images: (Array.isArray(b.images) ? b.images : []).map(s => clean(s, 400)).filter(Boolean),
    featured: !!b.featured,
    active: b.active !== false,
    updatedAt: new Date().toISOString()
  };
}
function uniqueSlug(base, ignoreId) {
  let slug = slugify(base), n = 2;
  while (db.products.some(p => p.slug === slug && p.id !== ignoreId)) slug = `${slugify(base)}-${n++}`;
  return slug;
}

app.get('/api/admin/products', (req, res) => res.json(db.products));

app.post('/api/admin/products', (req, res) => {
  const p = productFromBody(req.body);
  if (!p.name) return res.status(400).json({ error: 'Product name is required.' });
  p.id = uid('p');
  p.slug = uniqueSlug(req.body.slug || p.name);
  p.createdAt = p.updatedAt;
  db.products.unshift(p);
  save();
  res.status(201).json(p);
});

app.put('/api/admin/products/:id', (req, res) => {
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Product not found' });
  const p = productFromBody(req.body, db.products[idx]);
  if (!p.name) return res.status(400).json({ error: 'Product name is required.' });
  p.slug = uniqueSlug(req.body.slug || p.name, p.id);
  db.products[idx] = p;
  save();
  res.json(p);
});

app.delete('/api/admin/products/:id', (req, res) => {
  const before = db.products.length;
  db.products = db.products.filter(p => p.id !== req.params.id);
  if (db.products.length === before) return res.status(404).json({ error: 'Product not found' });
  save();
  res.json({ ok: true });
});

app.post('/api/admin/upload', upload.array('files', 12), (req, res) => {
  res.json({ urls: (req.files || []).map(f => `/uploads/${f.filename}`) });
});

/* ----- orders ----- */
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
app.get('/api/admin/orders', (req, res) => res.json(db.orders));
app.patch('/api/admin/orders/:id', (req, res) => {
  const o = db.orders.find(o => o.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const status = req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  // return stock when an order is cancelled, take it again if un-cancelled
  if (status === 'cancelled' && o.status !== 'cancelled') o.items.forEach(i => { const p = db.products.find(p => p.id === i.id); if (p) p.stock += i.qty; });
  if (status !== 'cancelled' && o.status === 'cancelled') o.items.forEach(i => { const p = db.products.find(p => p.id === i.id); if (p) p.stock = Math.max(0, p.stock - i.qty); });
  o.status = status;
  o.updatedAt = new Date().toISOString();
  save();
  res.json(o);
});
app.delete('/api/admin/orders/:id', (req, res) => {
  db.orders = db.orders.filter(o => o.id !== req.params.id);
  save();
  res.json({ ok: true });
});

/* ----- messages & subscribers ----- */
app.get('/api/admin/messages', (req, res) => res.json(db.messages));
app.patch('/api/admin/messages/:id', (req, res) => {
  const m = db.messages.find(m => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Message not found' });
  m.read = !!req.body.read;
  save();
  res.json(m);
});
app.delete('/api/admin/messages/:id', (req, res) => {
  db.messages = db.messages.filter(m => m.id !== req.params.id);
  save();
  res.json({ ok: true });
});
app.get('/api/admin/subscribers', (req, res) => res.json(db.subscribers));
app.delete('/api/admin/subscribers/:id', (req, res) => {
  db.subscribers = db.subscribers.filter(s => s.id !== req.params.id);
  save();
  res.json({ ok: true });
});

/* ----- reviews ----- */
app.get('/api/admin/reviews', (req, res) => res.json(db.reviews || []));
app.post('/api/admin/reviews', (req, res) => {
  const r = { id: uid('r'), name: clean(req.body.name, 80), product: clean(req.body.product, 120), text: clean(req.body.text, 1000), rating: Math.min(5, Math.max(1, parseInt(req.body.rating, 10) || 5)) };
  if (!r.name || !r.text) return res.status(400).json({ error: 'Name and review text are required.' });
  (db.reviews ||= []).unshift(r);
  save();
  res.status(201).json(r);
});
app.delete('/api/admin/reviews/:id', (req, res) => {
  db.reviews = (db.reviews || []).filter(r => r.id !== req.params.id);
  save();
  res.json({ ok: true });
});

/* ----- coupons / offers ----- */
app.get('/api/admin/coupons', (req, res) => res.json(db.coupons || []));

app.post('/api/admin/coupons', (req, res) => {
  const b = req.body || {};
  const code = clean(b.code, 30).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return res.status(400).json({ error: 'Coupon code is required.' });
  if ((db.coupons || []).some(c => c.code === code)) return res.status(400).json({ error: 'A coupon with this code already exists.' });
  const c = {
    id: uid('c'),
    code,
    type: b.type === 'flat' ? 'flat' : 'percent',
    value: Math.max(0, Number(b.value) || 0),
    minOrder: Math.max(0, Number(b.minOrder) || 0),
    maxDiscount: Math.max(0, Number(b.maxDiscount) || 0),
    usageLimit: Math.max(0, parseInt(b.usageLimit, 10) || 0),
    usageCount: 0,
    validFrom: clean(b.validFrom, 10),
    validUntil: clean(b.validUntil, 10),
    active: b.active !== false,
    description: clean(b.description, 300)
  };
  (db.coupons ||= []).unshift(c);
  save();
  res.status(201).json(c);
});

app.put('/api/admin/coupons/:id', (req, res) => {
  const idx = (db.coupons || []).findIndex(c => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Coupon not found' });
  const b = req.body || {};
  const existing = db.coupons[idx];
  const code = clean(b.code, 30).toUpperCase().replace(/[^A-Z0-9]/g, '') || existing.code;
  if (db.coupons.some(c => c.code === code && c.id !== existing.id)) return res.status(400).json({ error: 'A coupon with this code already exists.' });
  db.coupons[idx] = {
    ...existing,
    code,
    type: b.type === 'flat' ? 'flat' : 'percent',
    value: Math.max(0, Number(b.value) || 0),
    minOrder: Math.max(0, Number(b.minOrder) || 0),
    maxDiscount: Math.max(0, Number(b.maxDiscount) || 0),
    usageLimit: Math.max(0, parseInt(b.usageLimit, 10) || 0),
    validFrom: clean(b.validFrom, 10),
    validUntil: clean(b.validUntil, 10),
    active: b.active !== false,
    description: clean(b.description, 300)
  };
  save();
  res.json(db.coupons[idx]);
});

app.delete('/api/admin/coupons/:id', (req, res) => {
  const before = (db.coupons || []).length;
  db.coupons = (db.coupons || []).filter(c => c.id !== req.params.id);
  if (db.coupons.length === before) return res.status(404).json({ error: 'Coupon not found' });
  save();
  res.json({ ok: true });
});

/* ----- settings ----- */
app.get('/api/admin/settings', (req, res) => res.json(db.settings));
app.put('/api/admin/settings', (req, res) => {
  const next = { ...db.settings };
  for (const key of Object.keys(db.settings)) {
    if (!(key in req.body)) continue;
    next[key] = typeof db.settings[key] === 'number' ? Math.max(0, Number(req.body[key]) || 0) : clean(req.body[key], 4000);
  }
  db.settings = next;
  save();
  res.json(db.settings);
});

/* ---------- errors & page routing ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Vercel invokes this Express app as a serverless function. Serve the HTML
// entry points explicitly there as well as locally; express.static has
// index:false above, so it will not automatically serve /index.html for /.
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(400).json({ error: err.message || 'Something went wrong' });
});

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  AUREONÉ is live  →  http://localhost:${PORT}`);
    console.log(`  Admin panel        →  http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
