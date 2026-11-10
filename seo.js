/**
 * AUREONÉ SEO layer for the Express server.
 *
 *   const seo = require('./seo');
 *   seo.early(app, { PUBLIC_DIR });            // BEFORE express.static(PUBLIC_DIR)
 *   seo.pages(app, { PUBLIC_DIR, getDb: () => db });  // REPLACES the final app.get('*') catch-all
 *
 * What it does
 *  - /robots.txt and /sitemap.xml as real files (they currently return the homepage HTML)
 *  - one-hop 301s: trailing slashes, /index.html, demo pages
 *  - per-URL <title>, meta description, canonical, robots, Open Graph, Twitter, JSON-LD
 *  - crawlable server-rendered H1, breadcrumbs, intro text and links inside <main id="app">
 *  - real 404 status for unknown URLs and unknown/inactive products (fixes soft 404s)
 *  - noindex on checkout / account / order / admin / API
 *  - legal pages + FAQ fully server-rendered
 *  - defers render-blocking scripts, serves .webp twins of JPG/PNG when they exist
 */
const fs = require('fs');
const path = require('path');
const cfg = require('./site.config');
const legal = require('./legal-content');
const { esc, has } = legal;

const SITE = cfg.siteUrl.replace(/\/$/, '');
const abs = p => (!p ? '' : /^https?:\/\//.test(p) ? p : SITE + (p.startsWith('/') ? p : '/' + p));
const clip = (s = '', n = 155) => {
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\-–—]$/, '') + '…';
};
const CATEGORIES = { Cleanse: 'Face Cleansers', Treat: 'Face Serums', Moisturize: 'Moisturisers', Protect: 'Sunscreens' };
const STATIC_PAGES = ['privacy-policy', 'terms-and-conditions', 'cookie-policy', 'refund-policy', 'shipping-policy'];
const PRIVATE = /^\/(checkout|account|order)(\/|$)/;

/* ------------------------------------------------------------------ */
/* EARLY middleware: runs before express.static                       */
/* ------------------------------------------------------------------ */
function early(app, { PUBLIC_DIR }) {
  // Startup check: list business details still missing (never rendered as placeholders)
  const missing = ['legalName', 'registeredAddress', 'email', 'phone'].filter(k => !has(cfg[k]));
  if (!has(cfg.grievanceOfficer && cfg.grievanceOfficer.name)) missing.push('grievanceOfficer.name');
  if (missing.length) console.warn('[seo] site.config.js is missing:', missing.join(', '));

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const p = req.path;

    // Keep API + admin out of the index (Googlebot can still fetch the JSON it needs to render pages)
    if (p.startsWith('/api/') || p === '/admin' || p.startsWith('/admin/')) res.set('X-Robots-Tag', 'noindex, nofollow');

    // Demo / duplicate files: noindex, and redirect the standalone copy page home
    if (p === '/ritual-3d.html') res.set('X-Robots-Tag', 'noindex');
    const legacy = { '/index.html': '/', '/skin-care-home-copy.html': '/', '/demo-ritual': '/', '/demo-ritual/': '/' }[p];
    if (legacy) return res.redirect(301, legacy);

    // One-hop trailing-slash normalisation (/shop/ -> /shop), keeps the query string
    if (p.length > 1 && p.endsWith('/') && !p.startsWith('/api/')) {
      const q = req.originalUrl.slice(req.path.length);
      return res.redirect(301, p.replace(/\/+$/, '') + q);
    }

    // Cache static assets (filenames are not hashed, so a day + background revalidation)
    if (p.startsWith('/assets/')) res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

    // Serve a .webp twin of any JPG/PNG when the browser supports it (run scripts/optimize-images.mjs)
    if (/^\/(assets|uploads)\/.+\.(jpe?g|png)$/i.test(p) && /image\/webp/.test(req.headers.accept || '')) {
      const base = p.startsWith('/uploads/') ? null : PUBLIC_DIR;
      if (base) {
        const webp = path.join(base, decodeURIComponent(p).replace(/\.(jpe?g|png)$/i, '.webp'));
        if (webp.startsWith(base) && fs.existsSync(webp)) {
          res.set('Vary', 'Accept');
          res.type('image/webp');
          return res.sendFile(webp, { maxAge: '1d' });
        }
      }
    }
    next();
  });

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin/
Disallow: /api/account/
Disallow: /checkout
Disallow: /account
Disallow: /order/
Disallow: /shop?q=
Disallow: /ritual-3d.html

Sitemap: ${SITE}/sitemap.xml
`);
  });
}

/* ------------------------------------------------------------------ */
/* Route → metadata                                                    */
/* ------------------------------------------------------------------ */
function crumbs(list) { return [{ name: 'Home', url: '/' }, ...list]; }

function productSchema(p, settings) {
  const url = abs('/product/' + p.slug);
  const images = [...(p.images || []), p.cardImage].filter(x => x && !x.startsWith('/uploads/')).map(abs);
  const price = Number(p.price) || 0;
  const offer = {
    '@type': 'Offer', url, priceCurrency: cfg.currency, price: price.toFixed(2),
    availability: Number(p.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': SITE + '/#organization' },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy', applicableCountry: 'IN',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: cfg.policy.returnWindowDays, returnMethod: 'https://schema.org/ReturnByMail'
    }
  };
  // NOTE: no aggregateRating — current reviews are admin-entered, not verified purchases.
  return {
    '@type': 'Product', '@id': url + '#product', name: p.name,
    description: clip([p.tagline, p.description].filter(Boolean).join('. '), 500),
    image: images.length ? images : undefined, sku: p.id || p.slug,
    category: CATEGORIES[p.category] || p.category,
    brand: { '@type': 'Brand', name: cfg.brandName }, offers: offer
  };
}

function productFaq(p) {
  const list = v => Array.isArray(v) ? v.join(', ') : v;
  const qa = [];
  if (has(p.howToUse)) qa.push({ q: `How do I use ${p.name}?`, a: list(p.howToUse) });
  if (has(list(p.skinTypes))) qa.push({ q: `Which skin types is ${p.name} for?`, a: `${p.name} is formulated for ${list(p.skinTypes)} skin. Patch-test before first use.` });
  if (has(list(p.ingredients))) qa.push({ q: `What are the key ingredients in ${p.name}?`, a: list(p.ingredients) });
  return qa;
}

function resolve(pathname, query, db) {
  const settings = db.settings || {};
  const products = (db.products || []).filter(p => p.active !== false);
  const brand = cfg.brandName;
  const productLinks = products.map(p => `<li><a href="/product/${esc(p.slug)}">${esc(p.name)}</a>${p.subtitle ? ` — ${esc(p.subtitle)}` : ''}</li>`).join('');

  const base = { status: 200, robots: 'index, follow', ogType: 'website', image: cfg.defaultOgImage, schema: [] };

  if (pathname === '/') return {
    ...base, canonical: '/',
    title: `${brand} | Skincare Made in India — Cleanser, Serums, Moisturiser & SPF`,
    description: cfg.defaultDescription,
    h1: `${brand} skincare, made in India`,
    intro: settings.heroSubtitle || cfg.defaultDescription,
    body: `<h2>Shop the ritual</h2><ul>${productLinks}</ul>`
  };

  if (pathname === '/shop') {
    const c = query.c && CATEGORIES[query.c] ? query.c : null;
    const inCat = c ? products.filter(p => p.category === c) : products;
    const label = c ? CATEGORIES[c] : 'All Skincare';
    return {
      ...base,
      canonical: c ? `/shop?c=${encodeURIComponent(c)}` : '/shop',
      robots: query.q ? 'noindex, follow' : base.robots,
      title: `${label} | Shop ${brand}`,
      description: c ? `Shop ${brand} ${label.toLowerCase()}: ${inCat.map(p => p.name).join(', ')}. Made in India, free shipping above ₹${settings.freeShippingThreshold || 999}.`
                     : `Shop all ${brand} skincare: cleanser, serums, moisturiser and sunscreen. Made in India.`,
      h1: label,
      crumbs: crumbs(c ? [{ name: 'Shop', url: '/shop' }, { name: label, url: `/shop?c=${c}` }] : [{ name: 'Shop', url: '/shop' }]),
      body: `<ul>${inCat.map(p => `<li><a href="/product/${esc(p.slug)}">${esc(p.name)}</a> — ₹${esc(p.price)}</li>`).join('')}</ul>
<p>Browse by category: ${Object.entries(CATEGORIES).map(([k, v]) => `<a href="/shop?c=${k}">${v}</a>`).join(' · ')}</p>`
    };
  }

  const pm = pathname.match(/^\/product\/([^/]+)$/);
  if (pm) {
    const p = products.find(x => x.slug === decodeURIComponent(pm[1]));
    if (!p) return notFound();
    const faq = productFaq(p);
    const img = [p.cardImage, ...(p.images || [])].find(x => x && !x.startsWith('/uploads/'));
    return {
      ...base, ogType: 'product', image: img || base.image,
      canonical: '/product/' + p.slug,
      title: `${p.name}${p.subtitle ? ' — ' + p.subtitle : ''} | ${brand}`.slice(0, 70),
      description: clip(`${p.name}${p.subtitle ? ', ' + p.subtitle : ''}: ${p.description || p.tagline || ''}`),
      h1: p.name + (p.subtitle ? ` — ${p.subtitle}` : ''),
      intro: p.description || p.tagline || '',
      crumbs: crumbs([{ name: 'Shop', url: '/shop' }, ...(CATEGORIES[p.category] ? [{ name: CATEGORIES[p.category], url: `/shop?c=${p.category}` }] : []), { name: p.name, url: '/product/' + p.slug }]),
      schema: [productSchema(p, settings), ...(faq.length ? [faqSchema(faq)] : [])],
      body: `${faq.map(f => `<h2>${esc(f.q)}</h2><p>${esc(f.a)}</p>`).join('')}
<h2>More from the ritual</h2><ul>${products.filter(x => x.slug !== p.slug).map(x => `<li><a href="/product/${esc(x.slug)}">${esc(x.name)}</a></li>`).join('')}</ul>`
    };
  }

  const simple = {
    '/about': ['Our Story', `About ${brand}`, settings.aboutText || settings.story || `The people and philosophy behind ${brand} skincare.`],
    '/ritual': ['The Ritual', 'The Five-Step Skincare Ritual', `How to layer ${brand} products: cleanse, treat, moisturise and protect, morning and night.`],
    '/offers': ['Offers', `Current Offers & Coupon Codes`, `Current ${brand} offers and coupon codes on skincare.`],
    '/contact': ['Contact', `Contact ${brand}`, `Questions about an order or a product? Contact the ${brand} team${has(cfg.email) ? ' at ' + cfg.email : ''}.`]
  }[pathname];
  if (simple) return {
    ...base, canonical: pathname,
    title: `${simple[1]} | ${brand}`, description: clip(simple[2]), h1: simple[1], intro: simple[2],
    crumbs: crumbs([{ name: simple[0], url: pathname }]),
    body: pathname === '/contact' ? contactHtml() : (pathname === '/about' ? authorHtml() : '') + `<ul>${productLinks}</ul>`,
    schema: pathname === '/about' && authorSchema() ? [authorSchema()] : []
  };

  if (pathname === '/faq') {
    const f = legal.faqPage(cfg, settings);
    return { ...base, canonical: '/faq', title: `${f.title} | ${brand}`, description: f.description, h1: f.title,
      crumbs: crumbs([{ name: 'FAQ', url: '/faq' }]), schema: [faqSchema(f.items)], body: f.body, staticPage: true };
  }

  const slug = pathname.slice(1);
  if (STATIC_PAGES.includes(slug)) {
    const pg = legal.pages[slug](cfg, settings);
    return { ...base, canonical: pathname, title: `${pg.title} | ${brand}`, description: pg.description, h1: pg.title,
      crumbs: crumbs([{ name: pg.title, url: pathname }]), body: pg.body, staticPage: true };
  }

  if (PRIVATE.test(pathname)) return {
    ...base, robots: 'noindex, nofollow', canonical: null,
    title: `${pathname.startsWith('/checkout') ? 'Checkout' : pathname.startsWith('/order') ? 'Your Order' : 'Your Account'} | ${brand}`,
    description: cfg.defaultDescription, h1: '', body: ''
  };

  return notFound();

  function notFound() {
    return {
      ...base, status: 404, robots: 'noindex, follow', canonical: null,
      title: `Page not found | ${brand}`, description: 'This page does not exist.',
      h1: 'This page doesn’t exist',
      intro: 'The link may be old or mistyped. Try one of these instead:',
      body: `<ul><li><a href="/shop">Shop all skincare</a></li><li><a href="/ritual">The ritual</a></li><li><a href="/contact">Contact us</a></li></ul>`,
      notFound: true
    };
  }
}

function contactHtml() {
  const rows = [];
  if (has(cfg.email)) rows.push(`Email: <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>`);
  if (has(cfg.phone)) rows.push(`Phone: <a href="tel:${esc(cfg.phone.replace(/[^\d+]/g, ''))}">${esc(cfg.phone)}</a>`);
  if (has(cfg.registeredAddress)) rows.push(esc(cfg.registeredAddress));
  if (has(cfg.supportHours)) rows.push(esc(cfg.supportHours));
  return rows.length ? `<p>${rows.join('<br>')}</p>` : '';
}

function authorHtml() {
  const a = cfg.author || {};
  if (!has(a.name)) return '';
  return `<section class="author-box" aria-label="About the founder">
${has(a.image) ? `<img src="${esc(a.image)}" alt="${esc(a.name)}" width="96" height="96" loading="lazy">` : ''}
<div><h2>${esc(a.name)}${has(a.role) ? `, ${esc(a.role)}` : ''}</h2>
${has(a.credentials) ? `<p class="author-cred">${esc(a.credentials)}</p>` : ''}
${has(a.bio) ? `<p>${esc(a.bio)}</p>` : ''}</div></section>`;
}

function authorSchema() {
  const a = cfg.author || {};
  if (!has(a.name)) return null;
  const p = { '@type': 'Person', name: a.name, worksFor: { '@id': SITE + '/#organization' } };
  if (has(a.role)) p.jobTitle = a.role;
  if (has(a.bio)) p.description = a.bio;
  if (has(a.image)) p.image = abs(a.image);
  if (a.sameAs && a.sameAs.length) p.sameAs = a.sameAs;
  return p;
}

function faqSchema(items) {
  return { '@type': 'FAQPage', mainEntity: items.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) };
}

function orgSchema() {
  const sameAs = [cfg.instagram, cfg.facebook].filter(u => has(u) && !/^https?:\/\/(www\.)?(instagram|facebook)\.com\/?$/.test(u));
  const org = {
    '@type': 'Organization', '@id': SITE + '/#organization', name: cfg.brandName, url: SITE + '/',
    logo: abs('/assets/img/monogram.png')
  };
  if (has(cfg.legalName)) org.legalName = cfg.legalName;
  if (has(cfg.email)) org.email = cfg.email;
  if (has(cfg.phone)) org.telephone = cfg.phone;
  if (sameAs.length) org.sameAs = sameAs;
  if (has(cfg.registeredAddress)) org.address = { '@type': 'PostalAddress', streetAddress: cfg.registeredAddress, addressLocality: cfg.city, addressRegion: cfg.region, postalCode: cfg.postalCode, addressCountry: cfg.country };
  return org;
}

/* ------------------------------------------------------------------ */
/* HTML rendering                                                      */
/* ------------------------------------------------------------------ */
function crumbsHtml(list) {
  if (!list) return '';
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${list.map((c, i) =>
    i === list.length - 1 ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${esc(c.url)}">${esc(c.name)}</a></li>`).join('')}</ol></nav>`;
}

function headHtml(m) {
  const url = m.canonical ? abs(m.canonical) : null;
  const graph = [orgSchema(), { '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: cfg.brandName, publisher: { '@id': SITE + '/#organization' } }, ...m.schema];
  if (m.crumbs) graph.push({ '@type': 'BreadcrumbList', itemListElement: m.crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.url) })) });
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return [
    `<meta name="robots" content="${m.robots}">`,
    url && `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="${esc(cfg.brandName)}">`,
    `<meta property="og:type" content="${m.ogType}">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    url && `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(abs(m.image))}">`,
    `<meta property="og:locale" content="${cfg.locale}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="/assets/img/monogram.png">`,
    `<link rel="stylesheet" href="/assets/css/fixes.css?v=1">`,
    `<script>window.AUREONE_SEO=${JSON.stringify({ titles: m.titleMap }).replace(/</g, '\\u003c')};</script>`,
    `<script src="/assets/js/consent.js?v=1" defer></script>`,
    `<script type="application/ld+json">${ld}</script>`
  ].filter(Boolean).join('\n  ');
}

function bodyHtml(m) {
  if (!m.h1 && !m.body) return '';
  const cls = m.staticPage ? 'legal-page' : m.notFound ? 'legal-page not-found' : 'ssr-shell';
  return `<div class="${cls}" ${m.staticPage ? 'data-ssr-static' : ''}><div class="legal-wrap">
${crumbsHtml(m.crumbs)}
${m.h1 ? `<h1>${esc(m.h1)}</h1>` : ''}
${m.intro ? `<p class="lede">${esc(clip(m.intro, 400))}</p>` : ''}
${m.body || ''}
</div></div>`;
}

function footerExtras() {
  const contact = [];
  if (has(cfg.phone)) contact.push(`<a href="tel:${esc(cfg.phone.replace(/[^\d+]/g, ''))}">${esc(cfg.phone)}</a>`);
  if (has(cfg.email)) contact.push(`<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>`);
  const biz = [cfg.legalName, cfg.registeredAddress, has(cfg.gstin) ? 'GSTIN ' + cfg.gstin : ''].filter(has).map(esc).join(', ');
  return `<div class="footer-legal wrap">
  <nav aria-label="Legal"><a href="/faq">FAQ</a><a href="/shipping-policy">Shipping</a><a href="/refund-policy">Refunds &amp; Returns</a><a href="/privacy-policy">Privacy</a><a href="/terms-and-conditions">Terms</a><a href="/cookie-policy">Cookies</a><button type="button" class="link-btn" data-cookie-settings>Cookie settings</button></nav>
  ${contact.length ? `<p class="footer-contact">${contact.join(' · ')}</p>` : ''}
  ${biz ? `<p class="footer-biz">${biz}</p>` : ''}
</div>`;
}

function pages(app, { PUBLIC_DIR, getDb }) {
  const tplPath = path.join(PUBLIC_DIR, 'index.html');
  let tpl = null;
  const template = () => (tpl && process.env.NODE_ENV === 'production') ? tpl : (tpl = fs.readFileSync(tplPath, 'utf8'));

  app.get('/sitemap.xml', (req, res) => {
    const db = getDb();
    const products = (db.products || []).filter(p => p.active !== false);
    const cats = [...new Set(products.map(p => p.category).filter(c => CATEGORIES[c]))];
    const urls = [
      ['/', '1.0'], ['/shop', '0.9'], ...cats.map(c => [`/shop?c=${c}`, '0.8']),
      ...products.map(p => [`/product/${p.slug}`, '0.9', [p.cardImage, ...(p.images || [])].filter(x => x && !x.startsWith('/uploads/'))]),
      ['/ritual', '0.7'], ['/about', '0.6'], ['/offers', '0.6'], ['/contact', '0.5'], ['/faq', '0.5'],
      ...STATIC_PAGES.map(s => [`/${s}`, '0.3'])
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(([u, pr, imgs]) => `  <url><loc>${esc(abs(u))}</loc><priority>${pr}</priority>${(imgs || []).map(i => `<image:image><image:loc>${esc(abs(i))}</image:loc></image:image>`).join('')}</url>`).join('\n')}
</urlset>`;
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
  });

  app.get('*', (req, res) => {
    const db = getDb() || {};
    const m = resolve(req.path, req.query || {}, db);
    // titles the SPA uses on client-side navigation (keeps titles unique after JS runs)
    m.titleMap = Object.fromEntries(['/', '/shop', '/about', '/ritual', '/offers', '/contact', '/faq', '/checkout', '/account']
      .map(p => [p, resolve(p, {}, db).title]));
    let html = template()
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(m.description)}">`)
      .replace(/<link rel="icon"[^>]*>/, '')
      .replace('</head>', `  ${headHtml(m)}\n</head>`)
      .replace(/<script src="(\/assets\/js\/(?:three\.min|lucide\.min|store)\.js[^"]*)"><\/script>/g, '<script src="$1" defer></script>')
      .replace(/<main id="app" tabindex="-1"><\/main>/, `<main id="app" tabindex="-1">${bodyHtml(m)}</main>`)
      .replace('</footer>', `${footerExtras()}\n</footer>`);
    res.status(m.status)
      .set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400')
      .type('html').send(html);
  });
}

module.exports = { early, pages, _resolve: resolve };
