/* AUREONÉ storefront — tiny client-side router over the JSON API */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');

  const state = { settings: null, products: [], reviews: [], offers: [], bag: loadBag(), coupon: null };

  const icon = {
    drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M12 7c.7 2.7 2.3 4.3 5 5-2.7.7-4.3 2.3-5 5-.7-2.7-2.3-4.3-5-5 2.7-.7 4.3-2.3 5-5Z"/>',
    waves: '<path d="M4 9c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 4-1.5M4 13c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 4-1.5M4 17c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 4-1.5"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19 13 11"/>',
    rabbit: '<path d="M9 21c-2 0-4-1.5-4-4.5S8 11 11 11h2c3 0 6 2 6 5.5S17 21 15 21"/><path d="M10 11 8 3.5c-.3-1 1-1.5 1.6-.5L12 8M14 11l1-7.5c.1-1 1.5-1 1.6 0L16.5 9"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    flask: '<path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4A1.5 1.5 0 0 0 19 19l-5-10V3"/><path d="M7.5 15h9"/>',
    lotus: '<path d="M12 19c-4 0-8-2-9-6 3-.5 6 .5 9 3 3-2.5 6-3.5 9-3-1 4-5 6-9 6Z"/><path d="M12 16c-2-2.5-2.5-6 0-10 2.5 4 2 7.5 0 10Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    tag: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
  };
  const svg = (name, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" ${extra}>${icon[name] || ''}</svg>`;
  const ring = name => `<span class="ring">${svg(name)}</span>`;

  const money = n => `${state.settings?.currency || '₹'}${Number(n || 0).toLocaleString('en-IN')}`;

  /* ---------- API ---------- */
  async function api(url, opts = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  /* ---------- toast ---------- */
  function toast(msg, err = false) {
    const t = document.createElement('div');
    t.className = `toast glass glass-strong${err ? ' err' : ''}`;
    t.innerHTML = `<span class="dot"></span><span>${esc(msg)}</span>`;
    $('#toasts').append(t);
    setTimeout(() => { t.style.transition = 'opacity .5s'; t.style.opacity = 0; setTimeout(() => t.remove(), 500); }, 3200);
  }

  /* ---------- variant helpers ---------- */
  function getVariant(p, size) {
    if (size && Array.isArray(p.variants) && p.variants.length) {
      return p.variants.find(v => v.size === size) || p.variants[p.variants.length - 1];
    }
    return null;
  }
  function defaultSize(p) {
    return (Array.isArray(p.variants) && p.variants.length) ? p.variants[p.variants.length - 1].size : p.size;
  }
  function priceFor(p, size) {
    const v = getVariant(p, size);
    return v ? v.price : p.price;
  }
  function comparePriceFor(p, size) {
    const v = getVariant(p, size);
    return v ? v.comparePrice : p.comparePrice;
  }
  function stockFor(p, size) {
    const v = getVariant(p, size);
    return v ? v.stock : p.stock;
  }
  function lowestPrice(p) {
    if (!Array.isArray(p.variants) || !p.variants.length) return p.price;
    return Math.min(...p.variants.map(v => v.price));
  }
  function hasVariants(p) {
    return Array.isArray(p.variants) && p.variants.length > 1;
  }

  /* ---------- bag ---------- */
  function loadBag() { try { return JSON.parse(localStorage.getItem('aureone_bag')) || []; } catch { return []; } }
  function saveBag() { try { localStorage.setItem('aureone_bag', JSON.stringify(state.bag)); } catch { } renderBag(); }
  const bagItems = () => state.bag.map(i => ({ ...i, p: state.products.find(p => p.id === i.id) })).filter(i => i.p);
  const bagSubtotal = () => bagItems().reduce((s, i) => s + priceFor(i.p, i.size) * i.qty, 0);
  const shippingFor = sub => (sub === 0 || sub >= state.settings.freeShippingThreshold) ? 0 : Number(state.settings.shippingFee) || 0;

  function addToBag(id, qty = 1, size = null) {
    const p = state.products.find(p => p.id === id);
    if (!p) return;
    const sz = size || defaultSize(p);
    const st = stockFor(p, sz);
    const line = state.bag.find(i => i.id === id && i.size === sz);
    const have = line ? line.qty : 0;
    if (have + qty > st) return toast(st ? `Only ${st} available` : 'Currently out of stock', true);
    line ? (line.qty += qty) : state.bag.push({ id, qty, size: sz });
    saveBag();
    const c = $('#bagCount'); c.classList.add('bump'); setTimeout(() => c.classList.remove('bump'), 350);
    toast(`${p.name} (${sz}) added to your bag`);
  }
  function setQty(id, size, qty) {
    const p = state.products.find(p => p.id === id);
    const st = p ? stockFor(p, size) : 999;
    if (p && qty > st) return toast(`Only ${st} available`, true);
    state.bag = qty <= 0 ? state.bag.filter(i => !(i.id === id && i.size === size)) : state.bag.map(i => (i.id === id && i.size === size) ? { ...i, qty } : i);
    saveBag();
  }

  function renderBag() {
    const items = bagItems();
    const count = items.reduce((s, i) => s + i.qty, 0);
    $('#bagCount').textContent = count;
    $('#bagCount').dataset.n = count;
    if (!state.settings) return;
    const sub = bagSubtotal();
    const th = state.settings.freeShippingThreshold;
    $('#shipMeter').innerHTML = items.length ? `
      ${sub >= th ? 'You have unlocked <b>complimentary shipping</b>.' : `Add <b>${money(th - sub)}</b> more for complimentary shipping.`}
      <div class="bar"><i style="width:${Math.min(100, sub / th * 100)}%"></i></div>` : '';
    $('#drawerItems').innerHTML = items.length ? items.map(({ p, qty, size }) => {
      const price = priceFor(p, size);
      return `
      <div class="drawer-item">
        <a href="/product/${esc(p.slug)}" data-link><img src="${esc(p.images[0])}" alt="${esc(p.name)}"></a>
        <div>
          <b>${esc(p.name)}</b>
          <div class="muted small">${esc(p.subtitle)} · ${esc(size || p.size)}</div>
          <div class="row">
            <div class="qty"><button data-dec="${p.id}" data-sz="${esc(size)}" aria-label="Decrease">−</button><span>${qty}</span><button data-inc="${p.id}" data-sz="${esc(size)}" aria-label="Increase">+</button></div>
            <strong class="serif" style="font-size:20px;font-weight:500">${money(price * qty)}</strong>
          </div>
          <button class="link-btn" data-rm="${p.id}" data-sz="${esc(size)}" style="margin-top:8px">Remove</button>
        </div>
      </div>`;
    }).join('') : `
      <div class="drawer-empty"><img src="${esc(state.settings.logo)}" alt=""><p class="serif" style="font-size:24px;color:var(--ink)">Your bag is empty</p><p>Begin your ritual with a cleanse.</p>
      <a href="/shop" data-link class="btn btn-ghost btn-sm" style="margin-top:10px">Explore the collection</a></div>`;
    const ship = shippingFor(sub);
    $('#drawerFoot').innerHTML = items.length ? `
      <div class="totals"><div><span>Subtotal</span><span>${money(sub)}</span></div><div><span>Shipping</span><span>${ship ? money(ship) : 'Complimentary'}</span></div>
      <div class="grand"><span>Total</span><span>${money(sub + ship)}</span></div></div>
      <a href="/checkout" data-link class="btn btn-gold btn-block">Checkout</a>` : '';
  }

  function openDrawer(on = true) {
    $('#drawer').classList.toggle('on', on);
    $('#scrim').classList.toggle('on', on);
    $('#drawer').setAttribute('aria-hidden', !on);
  }

  /* ---------- shared fragments ---------- */
  function card(p) {
    const low = lowestPrice(p);
    const multi = hasVariants(p);
    const save = p.comparePrice > p.price;
    const totalStock = multi ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
    return `
    <article class="card glass reveal">
      <a href="/product/${esc(p.slug)}" data-link class="card-media">
        ${totalStock <= 0 ? '<span class="card-tag glass">Sold out</span>' : p.featured ? '<span class="card-tag glass">Bestseller</span>' : ''}
        <img src="${esc(p.images[0])}" alt="${esc(p.name)} — ${esc(p.subtitle)}" loading="lazy">
        ${p.images[1] ? `<img class="alt" src="${esc(p.images[1])}" alt="" loading="lazy">` : ''}
      </a>
      <div class="card-quick"><button class="btn btn-glass btn-sm btn-block" data-add="${p.id}" ${totalStock <= 0 ? 'disabled' : ''}>${totalStock <= 0 ? 'Sold out' : 'Add to bag'}</button></div>
      <a href="/product/${esc(p.slug)}" data-link class="card-body">
        <span class="cat">${esc(p.category)}</span>
        <h3>${esc(p.name)}</h3>
        <span class="sub">${esc(p.subtitle)}</span>
        <div class="price">${multi ? `<strong>From ${money(low)}</strong>` : `<strong>${money(p.price)}</strong>${save ? `<s>${money(p.comparePrice)}</s>` : ''}`}<span class="size">${esc(p.size)}</span></div>
      </a>
    </article>`;
  }

  const newsletter = () => `
    <section class="section" style="padding-top:0"><div class="wrap">
      <div class="newsletter glass reveal">
        <div class="ornament">✦</div>
        <h2 class="display">Join the <em class="gold-text">inner circle</em></h2>
        <p>Be first to know about new rituals, limited editions and quiet luxuries from the house of AUREONÉ.</p>
        <form class="sub-form glass glass-strong" data-sub>
          <input class="input" type="email" name="email" placeholder="Your email address" required aria-label="Email">
          <button class="btn btn-gold" type="submit">Subscribe</button>
        </form>
      </div>
    </div></section>`;

  /* ---------- pages ---------- */
  const pages = {
    home() {
      const s = state.settings;
      const featured = state.products.filter(p => p.featured).slice(0, 8);
      const list = featured.length ? featured : state.products.slice(0, 8);
      const title = esc(s.heroTitle).replace(/(healthy skin\.?)$/i, '<em class="gold-text">$1</em>');
      return `
      <section class="hero"><div class="wrap hero-grid">
        <div class="reveal">
          <div class="eyebrow">${esc(s.heroEyebrow)}</div>
          <h1 class="display">${title}</h1>
          <p class="hero-sub">${esc(s.heroSubtitle)}</p>
          <div class="hero-cta">
            <a href="/shop" data-link class="btn btn-gold">Shop the collection</a>
            <a href="/ritual" data-link class="btn btn-glass">Discover the ritual</a>
          </div>
          <div class="hero-stats">
            <div><strong>${state.products.length}</strong><span>Signature formulas</span></div>
            <div><strong>0%</strong><span>Parabens · Sulphates</span></div>
            <div><strong>100%</strong><span>Cruelty free</span></div>
          </div>
        </div>
        <div class="hero-visual reveal">
          <div class="hero-frame glass"><img src="${esc(s.heroImage)}" alt="The AUREONÉ collection"></div>
          <div class="chip chip-1 glass glass-strong">${ring('drop')}<div><b>Niacinamide 5%</b><small>Radiance 5</small></div></div>
          <div class="chip chip-2 glass glass-strong">${ring('sun')}<div><b>SPF 50 PA++++</b><small>Solar Veil</small></div></div>
        </div>
      </div></section>

      <div class="marquee" aria-hidden="true"><div class="marquee-track">${
        Array(2).fill(['Cleanse', 'Brighten', 'Repair', 'Protect', 'Radiate', 'Pure care', 'Real results', 'The Ritual'].map(w => `<span>${w}</span>`).join('')).join('')
      }</div></div>

      ${state.offers.length ? offersStrip() : ''}

      <section class="section"><div class="wrap">
        <div class="section-head reveal">
          <div class="eyebrow">The collection</div>
          <h2 class="display">Formulas for a <em class="gold-text">luminous</em> everyday</h2>
          <p>Clean formulations. Visible results. Made with care for a brighter tomorrow.</p>
        </div>
        <div class="grid">${list.map(card).join('')}</div>
        <div style="text-align:center;margin-top:46px" class="reveal"><a href="/shop" data-link class="btn btn-ghost">View all products</a></div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head reveal">
          <div class="eyebrow">The ritual</div>
          <h2 class="display">Four steps to radiance</h2>
          <p>A considered routine, morning and evening — each step designed to work beautifully with the next.</p>
        </div>
        ${ritualSteps()}
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap split">
        <div class="reveal">
          <div class="eyebrow">Our philosophy</div>
          <h2 class="display">${esc(s.aboutTitle)}</h2>
          <p>${esc(s.aboutText)}</p>
          <div class="pillars">
            <div class="pillar glass">${ring('flask')}Purposeful formulations</div>
            <div class="pillar glass">${ring('shield')}Skin health first</div>
            <div class="pillar glass">${ring('sparkle')}Effective actives</div>
            <div class="pillar glass">${ring('heart')}Luxury, simplified</div>
          </div>
          <a href="/about" data-link class="btn btn-gold">Our story</a>
        </div>
        <div class="split-media glass reveal"><img src="${esc(s.aboutImage)}" alt="AUREONÉ skincare ritual" loading="lazy"></div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head reveal">
          <div class="eyebrow">Key ingredients</div>
          <h2 class="display">Nature, refined by science</h2>
        </div>
        <div class="ingredients">
          ${[
            ['Niacinamide', 'Controls excess oil, evens skin tone and supports the barrier.', '#eef0ee'],
            ['Rice Extract', 'A time-honoured ritual for nourishment and natural radiance.', '#f6ecd6'],
            ['Vitamin C', 'Brightens, boosts radiance and defends against stressors.', '#f3cf8f'],
            ['Ceramides', 'Restore and strengthen the skin barrier for lasting comfort.', '#efe2c6']
          ].map(([n, d, c]) => `<div class="ing glass reveal"><div class="orb" style="--c:${c}"></div><h4>${n}</h4><p>${d}</p></div>`).join('')}
        </div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="banner reveal">
          <img src="/assets/img/range-wide.jpg" alt="The full AUREONÉ range" loading="lazy">
          <div class="banner-card glass glass-strong">
            <div class="eyebrow">The complete ritual</div>
            <h3 class="display">Radiant skin. Brighter tomorrows.</h3>
            <p>Five essentials, one luminous routine — from a gentle rice cleanse to daily SPF 50 protection.</p>
            <a href="/shop" data-link class="btn btn-gold">Shop the ritual</a>
          </div>
        </div>
      </div></section>

      ${state.reviews.length ? `<section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head reveal"><div class="eyebrow">Kind words</div><h2 class="display">Loved for the glow</h2></div>
        <div class="quotes">${state.reviews.slice(0, 3).map(r => `
          <figure class="quote glass reveal" style="margin:0">
            <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <blockquote>“${esc(r.text)}”</blockquote>
            <cite>${esc(r.name)}${r.product ? `<span>${esc(r.product)}</span>` : ''}</cite>
          </figure>`).join('')}</div>
      </div></section>` : ''}

      ${newsletter()}`;
    },

    shop() {
      const params = new URLSearchParams(location.search);
      const cats = ['All', ...new Set(state.products.map(p => p.category))];
      const active = params.get('c') || 'All';
      return `
      <section class="page-hero"><div class="wrap reveal">
        <div class="eyebrow">Shop</div>
        <h1 class="display">The <em class="gold-text">Collection</em></h1>
        <p>Every formula is clean, conscious and effective — luxury for every day.</p>
      </div></section>
      ${state.offers.length ? offersStrip() : ''}
      <section class="wrap" style="padding-bottom:40px">
        <div class="toolbar glass">
          <div class="filters">${cats.map(c => `<button class="filter${c === active ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          <select class="select" id="sort" aria-label="Sort products">
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        <div class="grid" id="shopGrid"></div>
      </section>
      ${newsletter()}`;
    },

    product(slug) {
      const p = state.products.find(p => p.slug === slug);
      if (!p) return notFound();
      const multi = hasVariants(p);
      const sz = defaultSize(p);
      const price = priceFor(p, sz);
      const compare = comparePriceFor(p, sz);
      const stock = stockFor(p, sz);
      const related = state.products.filter(x => x.id !== p.id && (x.category === p.category)).concat(state.products.filter(x => x.id !== p.id && x.category !== p.category)).slice(0, 4);
      document.title = `${p.name} — ${p.subtitle} | AUREONÉ`;
      return `
      <section class="wrap pd">
        <div class="gallery reveal">
          <div class="thumbs">${p.images.map((src, i) => `<button class="${i ? '' : 'on'}" data-thumb="${esc(src)}" aria-label="View image ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>
          <div class="main-img glass"><img id="mainImg" src="${esc(p.images[0])}" alt="${esc(p.name)}"></div>
        </div>
        <div class="pd-info glass reveal">
          <div class="crumbs"><a href="/" data-link>Home</a> / <a href="/shop?c=${encodeURIComponent(p.category)}" data-link>${esc(p.category)}</a> / ${esc(p.name)}</div>
          <div class="eyebrow">${esc(p.category)}</div>
          <h1 class="display">${esc(p.name)}</h1>
          <div class="sub">${esc(p.subtitle)}</div>
          ${p.tagline ? `<div class="tagline">${esc(p.tagline)}</div>` : ''}
          ${multi ? `<div class="size-picker" id="sizePicker">${p.variants.map(v => `<button class="size-opt${v.size === sz ? ' on' : ''}" data-size="${esc(v.size)}">${esc(v.size)}</button>`).join('')}</div>` : ''}
          <div class="price" id="pdPrice"><strong>${money(price)}</strong>${compare > price ? `<s>${money(compare)}</s>` : ''}<span class="size">${esc(sz)}</span></div>
          <p class="desc">${esc(p.description)}</p>
          ${p.benefits?.length ? `<div class="benefits">${p.benefits.map(b => `<span>${esc(b)}</span>`).join('')}</div>` : ''}
          <div class="buy">
            <div class="qty"><button data-pq="-1" aria-label="Decrease">−</button><span id="pdQty">1</span><button data-pq="1" aria-label="Increase">+</button></div>
            <button class="btn btn-gold" id="addBtn" data-add-pd="${p.id}" ${stock <= 0 ? 'disabled' : ''}>${stock <= 0 ? 'Sold out' : `Add to bag · ${money(price)}`}</button>
          </div>
          <div class="stock-note ${stock > 0 && stock <= 10 ? 'low' : ''}" id="stockNote">${stock <= 0 ? 'Currently out of stock.' : stock <= 10 ? `Only ${stock} left — order soon.` : 'In stock · Ships within 24–48 hours'}</div>
          <div class="tabs">
            <div class="tab-btns">
              <button class="on" data-tab="details">Details</button>
              <button data-tab="ingredients">Key ingredients</button>
              <button data-tab="use">How to use</button>
            </div>
            <div class="tab-panel" data-panel="details"><p style="margin:0">${esc(p.description)}</p>${p.skinTypes ? `<p><b>Suitable for:</b> ${esc(p.skinTypes)}</p>` : ''}<p style="margin-bottom:0"><b>Available sizes:</b> ${esc(multi ? p.variants.map(v => v.size).join(', ') : p.size)}</p></div>
            <div class="tab-panel" data-panel="ingredients" hidden><div class="ing-list">${(p.ingredients || []).map(i => `<div><span><b>${esc(i.name)}</b>${esc(i.note)}</span></div>`).join('') || '<p>Full ingredient list available on pack.</p>'}</div></div>
            <div class="tab-panel" data-panel="use" hidden><p style="margin:0">${esc(p.howToUse)}</p><p style="margin-bottom:0" class="muted small">For external use only. Patch test before first use.</p></div>
          </div>
          <div class="assure">
            <div>${ring('leaf')}Paraben free</div>
            <div>${ring('flask')}Sulphate free</div>
            <div>${ring('rabbit')}Cruelty free</div>
            <div>${ring('heart')}Made in India</div>
          </div>
        </div>
      </section>
      ${related.length ? `<section class="section" style="padding-top:40px"><div class="wrap">
        <div class="section-head reveal"><div class="eyebrow">Complete the ritual</div><h2 class="display">Pairs beautifully with</h2></div>
        <div class="grid">${related.map(card).join('')}</div>
      </div></section>` : ''}`;
    },

    ritual() {
      return `
      <section class="page-hero"><div class="wrap reveal">
        <div class="eyebrow">The ritual</div>
        <h1 class="display">Morning light. <em class="gold-text">Evening calm.</em></h1>
        <p>A simple, considered routine that cleanses, treats, restores and protects — so your skin feels like you, only brighter.</p>
      </div></section>
      <section class="wrap" style="padding-bottom:60px">${ritualSteps()}</section>
      <section class="section" style="padding-top:20px"><div class="wrap split">
        <div class="reveal">
          <div class="eyebrow">AM</div>
          <h2 class="display">The morning ritual</h2>
          <p>Cleanse with <b>Rice Veil</b>, brighten with <b>Lumière C</b> for antioxidant protection, lock in comfort with <b>Velvet Barrier</b>, and finish with <b>Solar Veil SPF 50</b> — every single day.</p>
          <div class="eyebrow" style="margin-top:34px">PM</div>
          <h2 class="display">The evening ritual</h2>
          <p>Cleanse away the day with <b>Rice Veil</b>, rebalance with <b>Radiance 5</b> niacinamide serum, and restore overnight with <b>Velvet Barrier</b>.</p>
          <a href="/shop" data-link class="btn btn-gold" style="margin-top:14px">Build your ritual</a>
        </div>
        <div class="split-media glass reveal"><img src="/assets/img/range-tall-1.jpg" alt="AUREONÉ ritual products" loading="lazy"></div>
      </div></section>
      ${newsletter()}`;
    },

    about() {
      const s = state.settings;
      return `
      <section class="page-hero"><div class="wrap reveal">
        <div class="eyebrow">Our story</div>
        <h1 class="display">The <em class="gold-text">Ritual</em> of Skin Health</h1>
        <p>We don’t formulate for a moment of glow. We formulate for the ritual behind healthy skin.</p>
      </div></section>
      <section class="section" style="padding-top:20px"><div class="wrap split">
        <div class="split-media glass reveal"><img src="${esc(s.aboutImage)}" alt="AUREONÉ collection" loading="lazy"></div>
        <div class="reveal">
          <div class="eyebrow">The house of AUREONÉ</div>
          <h2 class="display">${esc(s.aboutTitle)}</h2>
          <p>${esc(s.aboutText)}</p>
          <p class="script" style="font-size:38px;margin:18px 0 0">One ritual at a time</p>
        </div>
      </div></section>
      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head reveal"><div class="eyebrow">The four pillars</div><h2 class="display">What we stand for</h2></div>
        <div class="values four-pillars">
          <div class="value glass reveal">${ring('flask')}<h3>Purposeful Formulations</h3><p>Every ingredient has a role — no unnecessary ingredient overload just to make the INCI list look impressive.</p></div>
          <div class="value glass reveal">${ring('shield')}<h3>Skin Health First</h3><p>We don’t chase temporary “glass skin.” Our philosophy is consistent care, barrier support, hydration and long-term skin health.</p></div>
          <div class="value glass reveal">${ring('sparkle')}<h3>Effective Actives</h3><p>Recognizable actives such as Niacinamide, Vitamin C, Hyaluronic Acid, Panthenol, Ceramides and Allantoin — paired with supporting ingredients designed around each product’s purpose.</p></div>
          <div class="value glass reveal">${ring('heart')}<h3>Luxury, Simplified</h3><p>Premium experience, sophisticated packaging and textures — but a straightforward routine that people can actually follow.</p></div>
        </div>
      </div></section>
      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head reveal">
          <div class="eyebrow">The one-line pitch</div>
          <h2 class="display" style="font-size:clamp(26px, 3.4vw, 42px);font-style:italic;line-height:1.25">“AUREONÉ creates thoughtfully formulated modern skincare where effective actives meet the ritual of skin health — helping you build healthier, more radiant skin, one ritual at a time.”</h2>
        </div>
      </div></section>
      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="banner reveal" style="min-height:520px">
          <img src="/assets/img/range-square-1.jpg" alt="" loading="lazy">
          <div class="banner-card glass glass-strong">
            <div class="eyebrow">Purposeful · Effective · Ritualistic</div>
            <h3 class="display">The ritual begins here.</h3>
            <p>Discover the essentials of the AUREONÉ ritual.</p>
            <a href="/shop" data-link class="btn btn-gold">Shop now</a>
          </div>
        </div>
      </div></section>`;
    },

    offers() {
      const list = state.offers;
      return `
      <section class="page-hero"><div class="wrap reveal">
        <div class="eyebrow">Offers</div>
        <h1 class="display">Special <em class="gold-text">Offers</em></h1>
        <p>Apply these coupon codes at checkout to save on your ritual.</p>
      </div></section>
      <section class="wrap" style="padding-bottom:60px">
        ${list.length ? `<div class="offers-grid">
          ${list.map(o => `<div class="offer-card glass reveal">
            <div class="offer-badge">${o.type === 'percent' ? `${o.value}% OFF` : `${money(o.value)} OFF`}</div>
            <div class="offer-code">${esc(o.code)}</div>
            <p class="offer-desc">${esc(o.description)}</p>
            <div class="offer-meta">
              ${o.minOrder ? `<span>Min order: ${money(o.minOrder)}</span>` : ''}
              ${o.maxDiscount && o.type === 'percent' ? `<span>Max discount: ${money(o.maxDiscount)}</span>` : ''}
              ${o.validUntil ? `<span>Valid until: ${new Date(o.validUntil + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}
            </div>
            <button class="btn btn-glass btn-sm" data-copy="${esc(o.code)}">Copy code</button>
          </div>`).join('')}
        </div>` : '<div class="success glass"><h2 class="display">No active offers right now</h2><p class="muted">Stay tuned — new offers are on the way.</p><a href="/shop" data-link class="btn btn-gold" style="margin-top:18px">Shop the collection</a></div>'}
      </section>
      ${newsletter()}`;
    },

    contact() {
      const s = state.settings;
      return `
      <section class="page-hero"><div class="wrap reveal">
        <div class="eyebrow">Contact</div>
        <h1 class="display">We’d love to <em class="gold-text">hear from you</em></h1>
        <p>Questions about your ritual, an order or a collaboration — our team replies within one business day.</p>
      </div></section>
      <section class="wrap contact-grid" style="padding-bottom:60px">
        <div class="contact-card glass reveal">
          <div class="eyebrow">Get in touch</div>
          <h2 class="display">The AUREONÉ concierge</h2>
          <div class="contact-line">${ring('mail')}<div><small>Email</small><a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a></div></div>
          <div class="contact-line">${ring('phone')}<div><small>Phone</small><a href="tel:${esc(s.contactPhone.replace(/\s/g, ''))}">${esc(s.contactPhone)}</a></div></div>
          <div class="contact-line" style="border:none">${ring('pin')}<div><small>Studio</small>${esc(s.address)}</div></div>
        </div>
        <form class="contact-card glass reveal" id="contactForm">
          <div class="form-grid">
            <label class="field"><span>Name</span><input class="input" name="name" required></label>
            <label class="field"><span>Email</span><input class="input" type="email" name="email" required></label>
            <label class="field full"><span>Subject</span><input class="input" name="subject"></label>
            <label class="field full"><span>Message</span><textarea class="textarea" name="message" required></textarea></label>
            <div class="full"><button class="btn btn-gold" type="submit">Send message</button></div>
          </div>
        </form>
      </section>`;
    },

    checkout() {
      const items = bagItems();
      if (!items.length) return `
        <div class="success glass"><img src="${esc(state.settings.logo)}" alt=""><h1 class="display">Your bag is empty</h1>
        <p class="muted">Add a little radiance before checking out.</p><a href="/shop" data-link class="btn btn-gold" style="margin-top:16px">Shop the collection</a></div>`;
      const sub = bagSubtotal(), ship = shippingFor(sub);
      return `
      <section class="page-hero" style="padding-bottom:30px"><div class="wrap reveal">
        <div class="eyebrow">Checkout</div>
        <h1 class="display">Almost <em class="gold-text">radiant</em></h1>
      </div></section>
      <section class="wrap checkout">
        <form class="co-card glass" id="checkoutForm">
          <div class="eyebrow">Delivery</div>
          <h2 class="display">Where shall we send it?</h2>
          <div class="form-grid">
            <label class="field full"><span>Full name</span><input class="input" name="name" autocomplete="name" required></label>
            <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" required></label>
            <label class="field"><span>Phone</span><input class="input" type="tel" name="phone" autocomplete="tel" required></label>
            <label class="field full"><span>Address</span><textarea class="textarea" name="address" autocomplete="street-address" style="min-height:90px" required></textarea></label>
            <label class="field"><span>City</span><input class="input" name="city" autocomplete="address-level2" required></label>
            <label class="field"><span>State</span><input class="input" name="state" autocomplete="address-level1"></label>
            <label class="field"><span>PIN code</span><input class="input" name="pincode" inputmode="numeric" autocomplete="postal-code" required></label>
            <label class="field full"><span>Order note (optional)</span><input class="input" name="note"></label>
          </div>
          <div class="label" style="margin-top:26px">Coupon code</div>
          <div class="coupon-row" id="couponRow">
            <input class="input" type="text" id="couponInput" placeholder="Enter coupon code" style="text-transform:uppercase">
            <button type="button" class="btn btn-glass btn-sm" id="applyBtn">Apply</button>
          </div>
          <div class="coupon-msg" id="couponMsg"></div>
          <div class="label" style="margin-top:26px">Payment</div>
          <div class="pay-opt"><span class="dot"></span><div><b>Cash on Delivery</b><div class="muted small">Pay when your ritual arrives.</div></div></div>
          <button class="btn btn-gold btn-block" type="submit" id="placeBtn" style="margin-top:26px">Place order · ${money(sub + ship)}</button>
        </form>
        <aside class="co-card glass summary">
          <div class="eyebrow">Summary</div>
          <h2 class="display" style="font-size:28px;margin-bottom:10px">Your ritual</h2>
          ${items.map(({ p, qty, size }) => { const price = priceFor(p, size); return `<div class="line-item"><img src="${esc(p.images[0])}" alt=""><div><b>${esc(p.name)}</b><small>${esc(size || p.size)} · Qty ${qty}</small></div><span>${money(price * qty)}</span></div>`; }).join('')}
          <div class="totals" id="coTotals">
            <div><span>Subtotal</span><span>${money(sub)}</span></div>
            <div id="coDiscount" style="display:none"><span>Discount</span><span id="coDiscountAmt"></span></div>
            <div><span>Shipping</span><span>${ship ? money(ship) : 'Complimentary'}</span></div>
            <div class="grand"><span>Total</span><span id="coTotal">${money(sub + ship)}</span></div>
          </div>
          ${state.offers.length ? `<div class="co-offers">
            <div class="eyebrow" style="margin-bottom:10px">Available offers</div>
            ${state.offers.slice(0, 3).map(o => `<div class="co-offer"><span class="co-offer-code" data-paste="${esc(o.code)}">${esc(o.code)}</span><span>${esc(o.description)}</span></div>`).join('')}
          </div>` : ''}
        </aside>
      </section>`;
    },

    order(number) {
      return `
      <div class="wrap"><div class="success glass reveal">
        <img src="${esc(state.settings.logo)}" alt="">
        <div class="eyebrow">Thank you</div>
        <h1 class="display">Your ritual is on its way</h1>
        <p>Order <b>${esc(number)}</b> has been placed. We’ll be in touch shortly to confirm delivery.</p>
        <p class="script" style="font-size:40px;margin:14px 0">One Ritual at a Time</p>
        <a href="/shop" data-link class="btn btn-gold">Continue shopping</a>
      </div></div>`;
    }
  };

  function ritualSteps() {
    const find = cat => state.products.find(p => p.category === cat && p.featured) || state.products.find(p => p.category === cat);
    const steps = [
      ['Cleanse', 'Lift away the day with a gentle, rice-powered cleanse that respects your barrier.'],
      ['Treat', 'Target tone, texture and radiance with concentrated niacinamide or vitamin C.'],
      ['Moisturize', 'Restore and seal in hydration with ceramides and squalane.'],
      ['Protect', 'Shield your glow from UVA and UVB with weightless SPF 50 PA++++.']
    ];
    return `<div class="ritual">${steps.map(([cat, text], i) => {
      const p = find(cat);
      return `<div class="step glass reveal"><div class="num">0${i + 1}</div><h3>${cat}</h3><p>${text}</p>${p ? `<a href="/product/${esc(p.slug)}" data-link>${esc(p.name)} →</a>` : ''}</div>`;
    }).join('')}</div>`;
  }

  function offersStrip() {
    return `<section class="offers-strip"><div class="wrap">
      <div class="offers-scroll">${state.offers.map(o => `
        <div class="offer-chip glass glass-strong">
          <span class="offer-chip-val">${o.type === 'percent' ? `${o.value}%` : money(o.value)} OFF</span>
          <span>Use <b>${esc(o.code)}</b>${o.minOrder ? ` on ₹${o.minOrder}+` : ''}</span>
        </div>`).join('')}
        <a href="/offers" data-link class="offer-chip glass glass-strong" style="color:var(--gold-deep)">View all offers →</a>
      </div>
    </div></section>`;
  }

  const notFound = () => `<div class="wrap"><div class="success glass"><div class="eyebrow">404</div><h1 class="display">This page has drifted away</h1><a href="/" data-link class="btn btn-gold" style="margin-top:16px">Return home</a></div></div>`;

  /* ---------- page behaviours ---------- */
  function mountShop() {
    const params = new URLSearchParams(location.search);
    let cat = params.get('c') || 'All';
    const sortSel = $('#sort');
    const draw = () => {
      let list = state.products.filter(p => cat === 'All' || p.category === cat);
      const by = sortSel.value;
      if (by === 'low') list.sort((a, b) => lowestPrice(a) - lowestPrice(b));
      if (by === 'high') list.sort((a, b) => lowestPrice(b) - lowestPrice(a));
      if (by === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
      if (by === 'featured') list.sort((a, b) => (b.featured - a.featured));
      $('#shopGrid').innerHTML = list.length ? list.map(card).join('') : '<div class="empty">No products in this category yet.</div>';
      observeReveal();
    };
    $$('.filter').forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.cat;
      $$('.filter').forEach(x => x.classList.toggle('on', x === b));
      history.replaceState(null, '', cat === 'All' ? '/shop' : `/shop?c=${encodeURIComponent(cat)}`);
      draw();
    }));
    sortSel.addEventListener('change', draw);
    draw();
  }

  function mountProduct() {
    const slug = location.pathname.split('/product/')[1]?.replace(/\/$/, '');
    const p = state.products.find(p => p.slug === decodeURIComponent(slug));
    if (!p) return;
    let selectedSize = defaultSize(p);
    let qty = 1;
    const main = $('#mainImg');
    $$('[data-thumb]').forEach(b => b.addEventListener('click', () => {
      $$('[data-thumb]').forEach(x => x.classList.toggle('on', x === b));
      main.style.opacity = 0;
      setTimeout(() => { main.src = b.dataset.thumb; main.style.opacity = 1; }, 180);
    }));
    main?.addEventListener('click', () => {
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = `<img src="${esc(main.src)}" alt="">`;
      lb.addEventListener('click', () => lb.remove());
      document.body.append(lb);
    });
    $$('[data-pq]').forEach(b => b.addEventListener('click', () => {
      qty = Math.max(1, Math.min(20, qty + Number(b.dataset.pq)));
      $('#pdQty').textContent = qty;
      updateAddBtn();
    }));

    function updateAddBtn() {
      const price = priceFor(p, selectedSize);
      const stock = stockFor(p, selectedSize);
      const compare = comparePriceFor(p, selectedSize);
      const btn = $('#addBtn');
      btn.disabled = stock <= 0;
      btn.textContent = stock <= 0 ? 'Sold out' : `Add to bag · ${money(price * qty)}`;
      $('#pdPrice').innerHTML = `<strong>${money(price)}</strong>${compare > price ? `<s>${money(compare)}</s>` : ''}<span class="size">${esc(selectedSize)}</span>`;
      const note = $('#stockNote');
      note.className = `stock-note${stock > 0 && stock <= 10 ? ' low' : ''}`;
      note.textContent = stock <= 0 ? 'Currently out of stock.' : stock <= 10 ? `Only ${stock} left — order soon.` : 'In stock · Ships within 24–48 hours';
    }

    $$('[data-size]').forEach(b => b.addEventListener('click', () => {
      selectedSize = b.dataset.size;
      $$('[data-size]').forEach(x => x.classList.toggle('on', x === b));
      qty = 1;
      $('#pdQty').textContent = 1;
      updateAddBtn();
    }));

    $('#addBtn')?.addEventListener('click', () => { addToBag(p.id, qty, selectedSize); openDrawer(); });
    $$('[data-tab]').forEach(b => b.addEventListener('click', () => {
      $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      $$('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
    }));
  }

  function mountContact() {
    $('#contactForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget, btn = $('button[type=submit]', f);
      btn.disabled = true;
      try {
        await api('/api/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(f))) });
        f.reset();
        toast('Thank you — we’ll be in touch soon.');
      } catch (err) { toast(err.message, true); }
      btn.disabled = false;
    });
  }

  function mountOffers() {
    $$('[data-copy]').forEach(b => b.addEventListener('click', () => {
      navigator.clipboard.writeText(b.dataset.copy).then(() => toast(`Copied ${b.dataset.copy}`)).catch(() => toast(b.dataset.copy));
    }));
  }

  function mountCheckout() {
    const f = $('#checkoutForm');
    if (!f) return;
    let discount = 0;
    let couponCode = '';

    function updateTotals() {
      const sub = bagSubtotal();
      const effectiveSub = Math.max(0, sub - discount);
      const ship = effectiveSub <= 0 || sub >= state.settings.freeShippingThreshold ? 0 : Number(state.settings.shippingFee) || 0;
      const total = effectiveSub + ship;
      const discEl = $('#coDiscount');
      if (discount > 0) {
        discEl.style.display = '';
        $('#coDiscountAmt').textContent = `-${money(discount)}`;
      } else {
        discEl.style.display = 'none';
      }
      $('#coTotal').textContent = money(total);
      $('#placeBtn').textContent = `Place order · ${money(total)}`;
    }

    // Click to paste coupon from offers
    $$('[data-paste]').forEach(el => el.addEventListener('click', () => {
      $('#couponInput').value = el.dataset.paste;
    }));

    $('#applyBtn').addEventListener('click', async () => {
      const code = $('#couponInput').value.trim();
      const msg = $('#couponMsg');
      if (!code) { msg.innerHTML = ''; discount = 0; couponCode = ''; updateTotals(); return; }
      try {
        const res = await api('/api/coupons/apply', { method: 'POST', body: JSON.stringify({ code, subtotal: bagSubtotal() }) });
        discount = res.discount;
        couponCode = res.code;
        msg.innerHTML = `<span class="coupon-ok">✓ ${esc(res.code)} applied — you save ${money(res.discount)}</span>`;
        toast(`Coupon applied! You save ${money(res.discount)}`);
        updateTotals();
      } catch (err) {
        discount = 0; couponCode = '';
        msg.innerHTML = `<span class="coupon-err">${esc(err.message)}</span>`;
        updateTotals();
      }
    });

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#placeBtn');
      btn.disabled = true;
      const data = Object.fromEntries(new FormData(f));
      const { note, ...customer } = data;
      try {
        const res = await api('/api/orders', { method: 'POST', body: JSON.stringify({ customer, note, coupon: couponCode, items: state.bag }) });
        state.bag = []; saveBag();
        state.coupon = null;
        state.products = await api('/api/products');
        navigate(`/order/${res.number}`);
      } catch (err) { toast(err.message, true); btn.disabled = false; }
    });
  }

  /* ---------- router ---------- */
  const routes = [
    [/^\/$/, () => pages.home()],
    [/^\/shop\/?$/, () => pages.shop(), mountShop],
    [/^\/product\/([^/]+)\/?$/, m => pages.product(decodeURIComponent(m[1])), mountProduct],
    [/^\/ritual\/?$/, () => pages.ritual()],
    [/^\/about\/?$/, () => pages.about()],
    [/^\/offers\/?$/, () => pages.offers(), mountOffers],
    [/^\/contact\/?$/, () => pages.contact(), mountContact],
    [/^\/checkout\/?$/, () => pages.checkout(), mountCheckout],
    [/^\/order\/([^/]+)\/?$/, m => pages.order(decodeURIComponent(m[1]))]
  ];

  function render() {
    const path = location.pathname;
    document.title = 'AUREONÉ — The Ritual of Skin Health';
    let html = notFound(), mount = null;
    for (const [re, view, m] of routes) {
      const match = path.match(re);
      if (match) { html = view(match); mount = m; break; }
    }
    app.innerHTML = `<div class="page-enter">${html}</div>`;
    mount?.();
    $$('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === '/' ? path === '/' : path.startsWith(href));
    });
    $('#navLinks').classList.remove('open');
    observeReveal();
  }

  function navigate(url) {
    history.pushState(null, '', url);
    openDrawer(false);
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  let io;
  function observeReveal() {
    io ||= new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal:not(.in)').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-link]');
    if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && link.origin === location.origin) {
      e.preventDefault();
      return navigate(link.pathname + link.search);
    }
    const add = e.target.closest('[data-add]');
    if (add) { e.preventDefault(); addToBag(add.dataset.add); return openDrawer(); }
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), rm = e.target.closest('[data-rm]');
    if (inc) { const l = state.bag.find(i => i.id === inc.dataset.inc && i.size === inc.dataset.sz); if (l) setQty(l.id, l.size, l.qty + 1); }
    if (dec) { const l = state.bag.find(i => i.id === dec.dataset.dec && i.size === dec.dataset.sz); if (l) setQty(l.id, l.size, l.qty - 1); }
    if (rm) setQty(rm.dataset.rm, rm.dataset.sz, 0);
    if ((inc || dec || rm) && location.pathname === '/checkout') render();
  });

  document.addEventListener('submit', async e => {
    const f = e.target;
    if (!f.matches('[data-sub], #footSub')) return;
    e.preventDefault();
    try {
      await api('/api/subscribe', { method: 'POST', body: JSON.stringify({ email: f.email.value }) });
      f.reset();
      toast('Welcome to the inner circle ✦');
    } catch (err) { toast(err.message, true); }
  });

  window.addEventListener('popstate', render);
  $('#bagBtn').addEventListener('click', () => openDrawer(true));
  $('#drawerClose').addEventListener('click', () => openDrawer(false));
  $('#scrim').addEventListener('click', () => openDrawer(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { openDrawer(false); $('.lightbox')?.remove(); } });
  $('#menuToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
  window.addEventListener('scroll', () => $('#header').classList.toggle('scrolled', scrollY > 20), { passive: true });
  $('#year').textContent = new Date().getFullYear();

  /* ---------- boot ---------- */
  (async () => {
    app.innerHTML = '<div class="loader"><img src="/assets/img/monogram.png" alt="Loading"></div>';
    try {
      [state.settings, state.products, state.reviews, state.offers] = await Promise.all([
        api('/api/settings'), api('/api/products'), api('/api/reviews'), api('/api/offers')
      ]);
    } catch {
      app.innerHTML = '<div class="wrap"><div class="success glass"><h1 class="display">We’ll be right back</h1><p class="muted">The boutique could not be reached. Please refresh in a moment.</p></div></div>';
      return;
    }
    const s = state.settings;
    $('#announce').textContent = s.announcement || '';
    $('#brandWord').textContent = s.brandName;
    $('#brandLogo').src = s.logo;
    $$('.footer-mark').forEach(i => (i.src = s.logo));
    $('#footTagline').textContent = s.tagline;
    $('#footContact').innerHTML = `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a><span>${esc(s.contactPhone)}</span><span>${esc(s.address)}</span>`;
    // drop bag lines for products that no longer exist
    state.bag = state.bag.filter(i => state.products.some(p => p.id === i.id));
    renderBag();
    render();
  })();
})();
