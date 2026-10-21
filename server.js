const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const seed = require('./seed');

/* ---------- load environment variables safely ---------- */
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    } catch (e) {
      console.warn('Notice: Could not parse .env file:', e.message);
    }
  }
}
loadEnv();

// Turn off debug mode by setting production default
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}
const IS_PROD = process.env.NODE_ENV === 'production';
const IS_VERCEL = !!process.env.VERCEL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const postgresSql = POSTGRES_URL ? neon(POSTGRES_URL) : null;
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = IS_VERCEL ? '/tmp/aureone/data' : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = IS_VERCEL ? '/tmp/aureone/uploads' : path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- password hashing & verification (scrypt + timingSafeEqual) ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  if (typeof pw !== 'string' || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const test = crypto.scryptSync(pw, salt, 64);
    const real = Buffer.from(hash, 'hex');
    return real.length === test.length && crypto.timingSafeEqual(real, test);
  } catch {
    return false;
  }
}

/* ---------- JSON file database with atomic writes ---------- */
let db;
if (IS_VERCEL && !fs.existsSync(DB_FILE)) {
  const rootDb = path.join(ROOT, 'data', 'db.json');
  if (fs.existsSync(rootDb)) {
    try {
      fs.copyFileSync(rootDb, DB_FILE);
    } catch (e) {
      console.warn('Could not copy bundled db.json:', e);
    }
  }
}
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!db.coupons) db.coupons = [];
    if (!db.messages) db.messages = [];
    if (!db.subscribers) db.subscribers = [];
    if (!db.reviews) db.reviews = [];
    if (!db.orders) db.orders = [];
    if (!db.customers) db.customers = [];
  } catch (err) {
    console.error('Error reading db.json, reseeding safely:', err.message);
    db = seed(hashPassword);
    save();
  }
} else {
  db = seed(hashPassword);
  if (!db.customers) db.customers = [];
  save();
  console.log('Created data/db.json with starter content.');
}

// Support overriding admin credentials via environment variables
if (process.env.ADMIN_USERNAME) {
  db.admin.username = process.env.ADMIN_USERNAME;
}
if (process.env.ADMIN_PASSWORD) {
  db.admin.password = hashPassword(process.env.ADMIN_PASSWORD);
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}

let postgresSchemaReady;
async function ensurePostgresSchema() {
  if (!postgresSql) throw new Error('POSTGRES_URL is not configured');
  if (!postgresSchemaReady) {
    postgresSchemaReady = (async () => {
      await postgresSql`
        CREATE TABLE IF NOT EXISTS aureone_customers (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        )
      `;
      await postgresSql`
        CREATE TABLE IF NOT EXISTS aureone_orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT REFERENCES aureone_customers(id) ON DELETE CASCADE,
          order_number TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        )
      `;
      await postgresSql`
        ALTER TABLE aureone_orders ALTER COLUMN customer_id DROP NOT NULL
      `;
      await postgresSql`
        CREATE TABLE IF NOT EXISTS aureone_order_sequence (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          value INTEGER NOT NULL
        )
      `;
      await postgresSql`
        INSERT INTO aureone_order_sequence (id, value)
        VALUES (1, 1000)
        ON CONFLICT (id) DO NOTHING
      `;
    })();
  }
  try {
    await postgresSchemaReady;
  } catch (err) {
    postgresSchemaReady = null;
    throw err;
  }
}

function requireAccountStorage(res) {
  if (IS_VERCEL && !postgresSql) {
    res.status(503).json({ error: 'Customer accounts and order tracking require a configured Vercel Postgres connection.' });
    return false;
  }
  return true;
}

function reportStorageError(res, err) {
  console.error('Customer/order storage request failed:', err);
  if (!res.headersSent) res.status(503).json({ error: 'Account and order storage is temporarily unavailable. Please try again.' });
}

async function findCustomerByEmail(email) {
  if (!postgresSql) return db.customers.find(account => account.email === email) || null;
  await ensurePostgresSchema();
  const rows = await postgresSql`
    SELECT id, name, email, password_hash AS password, created_at AS "createdAt"
    FROM aureone_customers WHERE email = ${email} LIMIT 1
  `;
  return rows[0] || null;
}

async function findCustomerById(id) {
  if (!postgresSql) return db.customers.find(account => account.id === id) || null;
  await ensurePostgresSchema();
  const rows = await postgresSql`
    SELECT id, name, email, password_hash AS password, created_at AS "createdAt"
    FROM aureone_customers WHERE id = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

async function createCustomer(account) {
  if (!postgresSql) {
    db.customers.push(account);
    save();
    return account;
  }
  await ensurePostgresSchema();
  const inserted = await postgresSql`
    INSERT INTO aureone_customers (id, email, name, password_hash, created_at)
    VALUES (${account.id}, ${account.email}, ${account.name}, ${account.password}, ${account.createdAt})
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  return inserted.length ? account : findCustomerByEmail(account.email);
}

async function getCustomerOrders(customerId) {
  if (!postgresSql) return db.orders.filter(order => order.customerId === customerId);
  await ensurePostgresSchema();
  const rows = await postgresSql`
    SELECT data FROM aureone_orders
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
  `;
  return rows.map(row => row.data);
}

async function getAllOrders() {
  if (!postgresSql) return db.orders;
  await ensurePostgresSchema();
  const rows = await postgresSql`SELECT data FROM aureone_orders ORDER BY created_at DESC`;
  return rows.map(row => row.data);
}

async function persistOrder(order) {
  if (!postgresSql) {
    db.orders.unshift(order);
    save();
    return order;
  }
  await ensurePostgresSchema();
  const sequence = await postgresSql`
    UPDATE aureone_order_sequence SET value = value + 1
    WHERE id = 1 RETURNING value
  `;
  order.number = `AUR${sequence[0].value}`;
  await postgresSql`
    INSERT INTO aureone_orders (id, customer_id, order_number, status, data, created_at)
    VALUES (
      ${order.id}, ${order.customerId}, ${order.number}, ${order.status},
      ${JSON.stringify(order)}::jsonb, ${order.createdAt}
    )
  `;
  return order;
}

async function getOrderById(id) {
  if (!postgresSql) return db.orders.find(order => order.id === id) || null;
  await ensurePostgresSchema();
  const rows = await postgresSql`SELECT data FROM aureone_orders WHERE id = ${id} LIMIT 1`;
  return rows[0]?.data || null;
}

async function updatePersistentOrder(order) {
  if (!postgresSql) {
    save();
    return;
  }
  await ensurePostgresSchema();
  await postgresSql`
    UPDATE aureone_orders
    SET status = ${order.status}, data = ${JSON.stringify(order)}::jsonb
    WHERE id = ${order.id}
  `;
}

async function deletePersistentOrder(id) {
  if (!postgresSql) {
    db.orders = db.orders.filter(order => order.id !== id);
    save();
    return;
  }
  await ensurePostgresSchema();
  await postgresSql`DELETE FROM aureone_orders WHERE id = ${id}`;
}

const uid = (prefix = '') => prefix + crypto.randomBytes(8).toString('hex');
const slugify = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uid();

/* ---------- input sanitization & XSS protection ---------- */
function sanitizeText(v, max = 2000) {
  if (v == null) return '';
  let str = String(v).normalize('NFC').replace(/\0/g, ''); // strip null bytes
  // Strip script tags and their contents
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Strip all HTML tags
  str = str.replace(/<[^>]*>?/gm, '');
  // Strip javascript pseudo-protocol
  str = str.replace(/javascript\s*:/gi, '');
  return str.trim().slice(0, max);
}

const clean = (v, max = 2000) => sanitizeText(v, max);
const isEmail = e => typeof e === 'string' && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim()) && e.trim().length <= 160;
const isPhone = p => typeof p === 'string' && /^[+]?[\d\s\-().]{7,25}$/.test(p.trim());

/* ---------- sessions & authentication ---------- */
const SESSION_TTL = 1000 * 60 * 60 * 24; // 24 hours
const SESSION_SECRET = process.env.SESSION_SECRET || 'aureone_production_admin_session_key_2026';
const sessions = new Map(); // token -> { username, expires }

function createSessionToken(username) {
  const rand = crypto.randomBytes(16).toString('hex');
  const expires = Date.now() + SESSION_TTL;
  const payload = `${username}.${rand}.${expires}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const token = `${payload}.${sig}`;
  sessions.set(token, { username, expires });
  return token;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const s = sessions.get(token);
  if (s && s.expires > Date.now()) return s;

  // Stateless signature verification (ensures persistent auth across serverless instances)
  const parts = token.split('.');
  if (parts.length === 4) {
    const [username, rand, expiresStr, sig] = parts;
    const expires = parseInt(expiresStr, 10);
    if (!isNaN(expires) && expires > Date.now()) {
      const payload = `${username}.${rand}.${expiresStr}`;
      const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
      try {
        if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
          const verified = { username, expires };
          sessions.set(token, verified);
          return verified;
        }
      } catch {}
    }
  }
  return null;
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions.entries()) {
    if (s.expires < now) sessions.delete(token);
  }
}, 1000 * 60 * 15).unref();

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
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const s = verifySessionToken(token);
  if (!s) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  s.expires = Date.now() + SESSION_TTL; // Rolling session
  req.admin = s;
  next();
}

/* ---------- in-memory sliding rate limiters ---------- */
function createRateLimiter({ windowMs = 900000, max = 100, message = 'Too many requests' }) {
  const hits = new Map(); // ip -> [timestamps]
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = hits.get(ip) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= max) {
      const retryAfterSec = Math.ceil((timestamps[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ error: message });
    }

    timestamps.push(now);
    hits.set(ip, timestamps);

    if (hits.size > 5000) {
      for (const [k, v] of hits.entries()) {
        if (!v.some(t => t > windowStart)) hits.delete(k);
      }
    }
    next();
  };
}

// Dedicated Rate Limiters
const globalApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'API rate limit exceeded. Please wait a few minutes.'
});
const contactLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: 'Too many messages sent. Please try again later.'
});
const subscribeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: 'Too many newsletter signups. Please try again later.'
});
const orderLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Order creation limit reached. Please wait before placing another order.'
});
const couponLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many coupon validation attempts. Please try again in 15 minutes.'
});

const loginAttempts = new Map(); // ip -> { count, until }
const customerAuthLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sign-in attempts. Please wait before trying again.'
});

/* ---------- upload hardening ---------- */
const ALLOWED_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif'
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = ALLOWED_MIME[file.mimetype] || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      return cb(new Error('Only safe image formats (JPG, PNG, WEBP, GIF, SVG, AVIF) are allowed.'));
    }
    cb(null, true);
  }
});

/* ---------- express application setup ---------- */
const app = express();
app.disable('x-powered-by');

/* 1. Security Headers Middleware */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https: http:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));

  next();
});

/* 2. Path Traversal & Sensitive File Guard */
app.use((req, res, next) => {
  try {
    const decoded = decodeURIComponent(req.path);
    if (decoded.includes('..') || decoded.includes('\0')) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    const lower = decoded.toLowerCase();
    if (
      lower.includes('.env') ||
      lower.includes('.git') ||
      lower.includes('db.json') ||
      lower.includes('seed.js') ||
      lower.includes('server.js') ||
      lower.includes('package.json') ||
      lower.includes('package-lock.json') ||
      lower.endsWith('.tmp') ||
      lower.endsWith('.bak')
    ) {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch {
    return res.status(400).json({ error: 'Malformed request path' });
  }
  next();
});

/* 3. CORS Configuration — Permissive and secure */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

/* 4. Request Body Parser with payload limit */
app.use(express.json({ limit: '1mb' }));

/* 5. Static File Serving with security constraints */
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  dotfiles: 'deny',
  fallthrough: false
}));
app.use(express.static(PUBLIC_DIR, {
  index: false,
  dotfiles: 'deny'
}));

/* Apply general API rate limiting & ensure real-time no-cache headers on all API responses */
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}, globalApiLimiter);

const publicProduct = p => {
  const { createdAt, updatedAt, ...rest } = p;
  return rest;
};

/* ---------- coupon validation helper ---------- */
function validateCoupon(code, subtotal) {
  const cleanCode = sanitizeText(code, 30).toUpperCase().trim();
  const c = (db.coupons || []).find(c => c.active && c.code.toUpperCase() === cleanCode);
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

/* ==========================================================================
   PUBLIC API ENDPOINTS
   ========================================================================== */

app.get('/api/settings', (req, res) => {
  res.json(db.settings);
});

app.get('/api/products', (req, res) => {
  res.json(db.products.filter(p => p.active).map(publicProduct));
});

app.get('/api/products/:slug', (req, res) => {
  const slug = clean(req.params.slug, 120);
  const p = db.products.find(p => p.active && (p.slug === slug || p.id === slug));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(publicProduct(p));
});

app.get('/api/reviews', (req, res) => {
  res.json(db.reviews || []);
});

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

app.post('/api/coupons/apply', couponLimiter, (req, res) => {
  const { code, subtotal } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Please enter a coupon code.' });
  const numSubtotal = Math.max(0, Number(subtotal) || 0);
  const result = validateCoupon(code, numSubtotal);
  if (!result.valid) return res.status(400).json({ error: result.error });
  res.json({ discount: result.discount, code: result.coupon.code, description: result.description });
});

async function customerFromRequest(req) {
  const session = verifySessionToken(getCookie(req, 'aureone_customer'));
  if (!session?.username.startsWith('customer-')) return null;
  return findCustomerById(session.username.slice('customer-'.length));
}

function setCustomerSession(req, res, customer) {
  const token = createSessionToken(`customer-${customer.id}`);
  const flags = [
    `aureone_customer=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL / 1000}`
  ];
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

function publicCustomer(customer) {
  return { id: customer.id, name: customer.name, email: customer.email };
}

app.post('/api/account/checkout', customerAuthLimiter, async (req, res) => {
  if (!requireAccountStorage(res)) return;
  const name = clean(req.body?.name, 120);
  const email = clean(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || '');
  if (!name || !isEmail(email) || password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ error: 'Enter your name, a valid email, and a password with at least 8 characters, including a letter and a number.' });
  }

  try {
    let customer = await findCustomerByEmail(email);
    if (!customer) {
      const account = { id: uid('cus_'), name, email, password: hashPassword(password), createdAt: new Date().toISOString() };
      customer = await createCustomer(account);
    }
    if (!customer) throw new Error('Customer account could not be loaded after registration.');
    if (!verifyPassword(password, customer.password)) {
      return res.status(401).json({ error: 'An account already exists for this email. Enter its password to continue.' });
    }

    setCustomerSession(req, res, customer);
    res.json({ customer: publicCustomer(customer) });
  } catch (err) {
    reportStorageError(res, err);
  }
});

app.post('/api/account/login', customerAuthLimiter, async (req, res) => {
  if (!requireAccountStorage(res)) return;
  const email = clean(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || '');
  try {
    const customer = await findCustomerByEmail(email);
    if (!customer || !verifyPassword(password, customer.password)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    setCustomerSession(req, res, customer);
    res.json({ customer: publicCustomer(customer) });
  } catch (err) {
    reportStorageError(res, err);
  }
});

app.post('/api/account/logout', (req, res) => {
  const token = getCookie(req, 'aureone_customer');
  if (token) sessions.delete(token);
  const flags = ['aureone_customer=', 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
  res.json({ ok: true });
});

app.get('/api/account/me', async (req, res) => {
  if (!requireAccountStorage(res)) return;
  try {
    const customer = await customerFromRequest(req);
    res.json({ customer: customer ? publicCustomer(customer) : null });
  } catch (err) {
    reportStorageError(res, err);
  }
});

app.get('/api/account/orders', async (req, res) => {
  if (!requireAccountStorage(res)) return;
  try {
    const customer = await customerFromRequest(req);
    if (!customer) return res.status(401).json({ error: 'Sign in to view your orders.' });
    const orders = await getCustomerOrders(customer.id);
    res.json(orders.map(order => ({
      number: order.number,
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      payment: order.payment,
      items: order.items.map(item => ({ name: item.name, size: item.size, price: item.price, qty: item.qty }))
    })));
  } catch (err) {
    reportStorageError(res, err);
  }
});

app.post('/api/orders', orderLimiter, async (req, res) => {
  if (!requireAccountStorage(res)) return;
  let account = null;
  try {
    account = await customerFromRequest(req);
  } catch (err) {
    return reportStorageError(res, err);
  }
  const c = req.body.customer || {};
  const customer = {
    name: clean(c.name, 120),
    email: clean(c.email, 160).toLowerCase(),
    phone: clean(c.phone, 30),
    address: clean(c.address, 400),
    city: clean(c.city, 80),
    state: clean(c.state, 80),
    pincode: clean(c.pincode, 12)
  };

  if (!customer.name || !isEmail(customer.email) || !isPhone(customer.phone) || !customer.address || !customer.city || !customer.pincode) {
    return res.status(400).json({ error: 'Please provide valid delivery and contact details.' });
  }
  if (account && customer.email !== account.email) {
    return res.status(400).json({ error: 'The delivery email must match the signed-in account.' });
  }

  const items = [];
  for (const it of Array.isArray(req.body.items) ? req.body.items : []) {
    const p = db.products.find(p => p.id === clean(it.id, 40) && p.active);
    const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
    if (!p) return res.status(400).json({ error: 'A product in your bag is no longer available.' });

    let variantSize = it.size ? clean(it.size, 40) : null;
    let stockSource = p;
    let itemPrice = p.price;
    let itemSize = p.size;
    if (variantSize && Array.isArray(p.variants)) {
      const v = p.variants.find(v => v.size === variantSize);
      if (v) { stockSource = v; itemPrice = v.price; itemSize = v.size; }
    }

    if (stockSource.stock < qty) {
      return res.status(400).json({ error: `Only ${stockSource.stock} of ${p.name} (${itemSize}) left in stock.` });
    }
    items.push({ id: p.id, name: p.name, subtitle: p.subtitle, image: p.images[0], price: itemPrice, size: itemSize, qty });
  }
  if (!items.length) return res.status(400).json({ error: 'Your bag is empty.' });

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  let discount = 0;
  let couponCode = null;
  const couponInput = clean(req.body.coupon, 30);
  if (couponInput) {
    const cv = validateCoupon(couponInput, subtotal);
    if (!cv.valid) return res.status(400).json({ error: cv.error });
    discount = cv.discount;
    couponCode = cv.coupon.code;
    cv.coupon.usageCount = (cv.coupon.usageCount || 0) + 1;
  }

  const shipping = (subtotal - discount) <= 0 || subtotal >= db.settings.freeShippingThreshold ? 0 : Number(db.settings.shippingFee) || 0;
  const total = Math.max(0, subtotal - discount) + shipping;

  // Deduct inventory
  items.forEach(i => {
    const p = db.products.find(p => p.id === i.id);
    if (p) {
      if (i.size && Array.isArray(p.variants)) {
        const v = p.variants.find(v => v.size === i.size);
        if (v) v.stock = Math.max(0, v.stock - i.qty);
      }
      if (!Array.isArray(p.variants) || !p.variants.length || p.size === i.size) {
        p.stock = Math.max(0, p.stock - i.qty);
      }
    }
  });

  const order = {
    id: uid(),
    customerId: account?.id || null,
    number: 'AUR' + String(1001 + db.orders.length),
    customer,
    items,
    subtotal,
    discount,
    coupon: couponCode,
    shipping,
    total,
    payment: 'Cash on Delivery',
    note: clean(req.body.note, 500),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  try {
    await persistOrder(order);
    if (postgresSql && !IS_VERCEL) save();
    res.status(201).json({ number: order.number, total: order.total });
  } catch (err) {
    reportStorageError(res, err);
  }
});

app.post('/api/contact', contactLimiter, (req, res) => {
  const m = {
    name: clean(req.body.name, 120),
    email: clean(req.body.email, 160).toLowerCase(),
    subject: clean(req.body.subject, 160),
    message: clean(req.body.message, 3000)
  };
  if (!m.name || !isEmail(m.email) || !m.message) {
    return res.status(400).json({ error: 'Please provide your name, a valid email address and a message.' });
  }
  db.messages.unshift({ id: uid(), ...m, read: false, createdAt: new Date().toISOString() });
  save();
  res.status(201).json({ ok: true });
});

app.post('/api/subscribe', subscribeLimiter, (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!db.subscribers.some(s => s.email === email)) {
    db.subscribers.unshift({ id: uid(), email, createdAt: new Date().toISOString() });
    save();
  }
  res.status(201).json({ ok: true });
});

/* ==========================================================================
   ADMIN AUTHENTICATION & PROTECTED ENDPOINTS
   ========================================================================== */

app.post('/api/admin/login', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
  const att = loginAttempts.get(ip);
  if (att && att.until > Date.now()) {
    const remainingSec = Math.ceil((att.until - Date.now()) / 1000);
    res.setHeader('Retry-After', String(remainingSec));
    return res.status(429).json({ error: 'Too many failed login attempts. Try again later.' });
  }

  const { username, password } = req.body || {};
  const cleanUser = clean(username, 80);
  const cleanPass = String(password || '');

  if (cleanUser !== db.admin.username || !verifyPassword(cleanPass, db.admin.password)) {
    const count = (att?.count || 0) + 1;
    loginAttempts.set(ip, {
      count,
      until: count >= 5 ? Date.now() + 15 * 60 * 1000 : 0 // 15-minute lockout after 5 fails
    });
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  loginAttempts.delete(ip);
  const token = createSessionToken(cleanUser);

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieFlags = [
    `aureone_admin=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL / 1000}`
  ];
  if (isHttps) cookieFlags.push('Secure');

  res.setHeader('Set-Cookie', cookieFlags.join('; '));
  res.json({ username: cleanUser });
});

app.post('/api/admin/logout', (req, res) => {
  const token = getCookie(req, 'aureone_admin');
  if (token) sessions.delete(token);

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieFlags = [
    'aureone_admin=',
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isHttps) cookieFlags.push('Secure');

  res.setHeader('Set-Cookie', cookieFlags.join('; '));
  res.json({ ok: true });
});

/* Enforce authentication for all /api/admin routes */
app.use('/api/admin', requireAdmin);

app.get('/api/admin/me', (req, res) => {
  res.json({ username: req.admin.username });
});

app.post('/api/admin/password', (req, res) => {
  const { current, next, username } = req.body || {};
  if (!verifyPassword(String(current || ''), db.admin.password)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  const nextPw = String(next || '');
  if (nextPw.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }
  if (!/\d/.test(nextPw) || !/[a-zA-Z]/.test(nextPw)) {
    return res.status(400).json({ error: 'New password must contain both letters and numbers.' });
  }
  db.admin.password = hashPassword(nextPw);
  if (username && clean(username, 60)) {
    db.admin.username = clean(username, 60);
  }
  save();
  res.json({ ok: true });
});

/* Dashboard statistics */
app.get('/api/admin/stats', async (req, res) => {
  if (!requireAccountStorage(res)) return;
  let orders;
  try {
    orders = await getAllOrders();
  } catch (err) {
    return reportStorageError(res, err);
  }
  const live = orders.filter(o => o.status !== 'cancelled');
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
    orders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    products: db.products.length,
    lowStock: db.products.filter(p => p.stock <= 10).map(p => ({ id: p.id, name: p.name, stock: p.stock })),
    unreadMessages: db.messages.filter(m => !m.read).length,
    subscribers: db.subscribers.length,
    activeCoupons: (db.coupons || []).filter(c => c.active).length,
    days,
    topProducts: Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty })),
    recentOrders: orders.slice(0, 6)
  });
});

/* Admin Product Management */
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
  const idx = db.products.findIndex(p => p.id === clean(req.params.id, 40));
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
  db.products = db.products.filter(p => p.id !== clean(req.params.id, 40));
  if (db.products.length === before) return res.status(404).json({ error: 'Product not found' });
  save();
  res.json({ ok: true });
});

app.post('/api/admin/upload', upload.array('files', 6), (req, res) => {
  res.json({ urls: (req.files || []).map(f => `/uploads/${f.filename}`) });
});

/* Admin Order Management */
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
app.get('/api/admin/orders', async (req, res) => {
  if (!requireAccountStorage(res)) return;
  try {
    res.json(await getAllOrders());
  } catch (err) {
    reportStorageError(res, err);
  }
});

app.patch('/api/admin/orders/:id', async (req, res) => {
  if (!requireAccountStorage(res)) return;
  let o;
  try {
    o = await getOrderById(clean(req.params.id, 40));
  } catch (err) {
    return reportStorageError(res, err);
  }
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const status = clean(req.body.status, 20);
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  if (status === 'cancelled' && o.status !== 'cancelled') {
    o.items.forEach(i => {
      const p = db.products.find(p => p.id === i.id);
      if (p) p.stock += i.qty;
    });
  }
  if (status !== 'cancelled' && o.status === 'cancelled') {
    o.items.forEach(i => {
      const p = db.products.find(p => p.id === i.id);
      if (p) p.stock = Math.max(0, p.stock - i.qty);
    });
  }
  o.status = status;
  o.updatedAt = new Date().toISOString();
  try {
    await updatePersistentOrder(o);
    if (postgresSql && !IS_VERCEL) save();
    res.json(o);
  } catch (err) {
    reportStorageError(res, err);
  }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
  if (!requireAccountStorage(res)) return;
  try {
    await deletePersistentOrder(clean(req.params.id, 40));
    res.json({ ok: true });
  } catch (err) {
    reportStorageError(res, err);
  }
});

/* Admin Messages & Subscribers */
app.get('/api/admin/messages', (req, res) => res.json(db.messages));

app.patch('/api/admin/messages/:id', (req, res) => {
  const m = db.messages.find(m => m.id === clean(req.params.id, 40));
  if (!m) return res.status(404).json({ error: 'Message not found' });
  m.read = !!req.body.read;
  save();
  res.json(m);
});

app.delete('/api/admin/messages/:id', (req, res) => {
  db.messages = db.messages.filter(m => m.id !== clean(req.params.id, 40));
  save();
  res.json({ ok: true });
});

app.get('/api/admin/subscribers', (req, res) => res.json(db.subscribers));

app.delete('/api/admin/subscribers/:id', (req, res) => {
  db.subscribers = db.subscribers.filter(s => s.id !== clean(req.params.id, 40));
  save();
  res.json({ ok: true });
});

/* Admin Reviews */
app.get('/api/admin/reviews', (req, res) => res.json(db.reviews || []));

app.post('/api/admin/reviews', (req, res) => {
  const r = {
    id: uid('r'),
    name: clean(req.body.name, 80),
    product: clean(req.body.product, 120),
    text: clean(req.body.text, 1000),
    rating: Math.min(5, Math.max(1, parseInt(req.body.rating, 10) || 5))
  };
  if (!r.name || !r.text) return res.status(400).json({ error: 'Name and review text are required.' });
  (db.reviews ||= []).unshift(r);
  save();
  res.status(201).json(r);
});

app.delete('/api/admin/reviews/:id', (req, res) => {
  db.reviews = (db.reviews || []).filter(r => r.id !== clean(req.params.id, 40));
  save();
  res.json({ ok: true });
});

/* Admin Coupons */
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
  const idx = (db.coupons || []).findIndex(c => c.id === clean(req.params.id, 40));
  if (idx < 0) return res.status(404).json({ error: 'Coupon not found' });
  const b = req.body || {};
  const existing = db.coupons[idx];
  const code = clean(b.code, 30).toUpperCase().replace(/[^A-Z0-9]/g, '') || existing.code;
  if (db.coupons.some(c => c.code === code && c.id !== existing.id)) {
    return res.status(400).json({ error: 'A coupon with this code already exists.' });
  }
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
  db.coupons = (db.coupons || []).filter(c => c.id !== clean(req.params.id, 40));
  if (db.coupons.length === before) return res.status(404).json({ error: 'Coupon not found' });
  save();
  res.json({ ok: true });
});

/* Admin Settings */
app.get('/api/admin/settings', (req, res) => res.json(db.settings));

app.put('/api/admin/settings', (req, res) => {
  const next = { ...db.settings };
  for (const key of Object.keys(db.settings)) {
    if (!(key in req.body)) continue;
    next[key] = typeof db.settings[key] === 'number'
      ? Math.max(0, Number(req.body[key]) || 0)
      : clean(req.body[key], 4000);
  }
  db.settings = next;
  save();
  res.json(db.settings);
});

/* Catch-all API 404 handler */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/* SPA Page Routes */
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/* Centralized production-safe error handler (no stack trace leak) */
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Server Error:`, err.message);
  if (!IS_PROD && err.stack) {
    console.error(err.stack);
  }
  const status = err.status || (err.message && err.message.includes('allowed') ? 400 : 500);
  const clientMessage = (status < 500 && err.message)
    ? sanitizeText(err.message, 200)
    : 'An unexpected error occurred. Please try again later.';
  res.status(status).json({ error: clientMessage });
});

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  AUREONÉ is live  →  http://localhost:${PORT}`);
    console.log(`  Admin panel        →  http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
