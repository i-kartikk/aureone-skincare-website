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
    const mb = $('#mobileBagBadge');
    if (mb) mb.textContent = count;
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
  function collectionCard(p) {
    const cardImg = p.cardImage || p.images[0];
    return `
    <article class="product-card-clean reveal">
      <a href="/product/${esc(p.slug)}" data-link class="pcc-media">
        <img src="${esc(cardImg)}" alt="${esc(p.name)} — ${esc(p.subtitle)}" loading="lazy">
      </a>
      <div class="pcc-body">
        <h3 class="pcc-title"><a href="/product/${esc(p.slug)}" data-link>${esc(p.name)}</a></h3>
        <div class="pcc-sub">${esc(p.subtitle)}</div>
        <a href="/product/${esc(p.slug)}" data-link class="pcc-arrow" aria-label="View ${esc(p.name)}">&rarr;</a>
      </div>
    </article>`;
  }

  function card(p) {
    const low = lowestPrice(p);
    const multi = hasVariants(p);
    const save = p.comparePrice > p.price;
    const totalStock = multi ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
    const cardImg = p.cardImage || p.images[0];
    return `
    <article class="catalog-card reveal">
      <a href="/product/${esc(p.slug)}" data-link class="catalog-media">
        <img src="${esc(cardImg)}" alt="${esc(p.name)} — ${esc(p.subtitle)}" loading="lazy">
      </a>
      <div class="catalog-body">
        <span class="catalog-cat">${esc(p.category)}</span>
        <h3><a href="/product/${esc(p.slug)}" data-link>${esc(p.name)}</a></h3>
        <span class="catalog-sub">${esc(p.subtitle)}</span>
        <div class="catalog-price">${multi ? `<strong>From ${money(low)}</strong>` : `<strong>${money(p.price)}</strong>${save ? `<s>${money(p.comparePrice)}</s>` : ''}`}<span class="size" style="margin-left:auto;font-size:12px;color:var(--muted)">${esc(p.size)}</span></div>
      </div>
      <div style="margin-top:16px"><button class="btn btn-gold btn-sm btn-block" data-add="${p.id}" ${totalStock <= 0 ? 'disabled' : ''}>${totalStock <= 0 ? 'Sold out' : 'Add to bag'}</button></div>
    </article>`;
  }

  const newsletter = () => `
    <section class="section" style="padding-top:0"><div class="wrap">
      <div class="newsletter-clean reveal">
        <div class="eyebrow" style="margin-bottom:8px">✦ Inner Circle ✦</div>
        <h2 class="display">Join the <em class="gold-italic">inner circle</em></h2>
        <p>Be first to receive skincare rituals, exclusive releases and quiet luxuries from the house of AUREONÉ.</p>
        <form class="newsletter-form" data-sub>
          <input class="input" type="email" name="email" placeholder="Your email address" required aria-label="Email">
          <button class="btn btn-gold" type="submit">Join</button>
        </form>
      </div>
    </div></section>`;

  /* ---------- pages ---------- */
  const pages = {
    home() {
      const s = state.settings || {};
      const prods = state.products || [];
      return `
      <!-- SECTION 1: HERO EDITORIAL (Inspired by Blabliblu dw-hero) -->
      <section class="relative w-full overflow-hidden bg-[#F8F5EF] py-12 lg:py-20 border-b border-[#B99A60]/15" id="hero">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <!-- Text Column -->
            <div class="lg:col-span-6 flex flex-col justify-center space-y-5 z-10">
              <div class="flex items-center gap-2">
                <span class="w-6 h-[1px] bg-[#B99A60]"></span>
                <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">The Art of Radiance</span>
              </div>
              <h1 class="font-display-hero text-4xl sm:text-5xl lg:text-[54px] text-[#211D19] tracking-tight font-normal leading-[1.12]">
                Rituals That Illuminate Every Skin — <span class="italic font-light text-[#B99A60]">Rice Veil, Radiance 5, Velvet Barrier</span>
              </h1>
              <p class="font-body-lg text-[16px] sm:text-[18px] text-[#57524C] font-light leading-relaxed">
                Pure Care, Real Results, Radiant You. Crafted at the nexus of clinical precision and botanical potency—formulated with fermented rice extract, barrier ceramides, and stabilized bio-vitamins.
              </p>
              
              <!-- Value Ticker Pills (Blabliblu style) -->
              <div class="flex flex-wrap gap-2 pt-1">
                <span class="inline-flex items-center gap-1.5 bg-[#FFFFFF] border border-[#B99A60]/20 px-3 py-1 rounded-full text-[11px] text-[#211D19] font-medium shadow-sm">
                  <span class="text-[#B99A60]">★</span> 4.9/5 Rating (870+ Verified Reviews)
                </span>
                <span class="inline-flex items-center gap-1.5 bg-[#FFFFFF] border border-[#B99A60]/20 px-3 py-1 rounded-full text-[11px] text-[#211D19] font-medium shadow-sm">
                  <span class="text-[#B99A60]">✓</span> 100% Dermatologically Tested
                </span>
                <span class="inline-flex items-center gap-1.5 bg-[#FFFFFF] border border-[#B99A60]/20 px-3 py-1 rounded-full text-[11px] text-[#211D19] font-medium shadow-sm">
                  <span class="text-[#B99A60]">✦</span> Bio-Fermented Actives
                </span>
              </div>

              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3">
                <a href="#deck" class="bg-[#211D19] text-[#FFFFFF] hover:bg-[#B99A60] px-8 py-4 rounded font-label-button text-[12px] uppercase tracking-wider transition-colors shadow-sm text-center">
                  Shop The Ritual
                </a>
                <a href="#master-suite" class="bg-[#FFFFFF] text-[#211D19] hover:bg-[#F2EFE8] border border-[#B99A60]/30 px-7 py-4 rounded font-label-button text-[12px] uppercase tracking-wider transition-colors shadow-sm text-center">
                  Explore Master Suite
                </a>
              </div>
              <div class="pt-3 flex items-center gap-6 sm:gap-10 text-[#57524C]">
                <div>
                  <p class="font-display-hero text-2xl sm:text-3xl font-semibold text-[#211D19]">94%</p>
                  <p class="font-label-caption text-[11px] uppercase tracking-wider text-[#8C857B]">Clinical Radiance</p>
                </div>
                <div class="w-[1px] h-8 bg-[#B99A60]/25"></div>
                <div>
                  <p class="font-display-hero text-2xl sm:text-3xl font-semibold text-[#211D19]">5-Step</p>
                  <p class="font-label-caption text-[11px] uppercase tracking-wider text-[#8C857B]">Harmonized Suite</p>
                </div>
                <div class="w-[1px] h-8 bg-[#B99A60]/25"></div>
                <div>
                  <p class="font-display-hero text-2xl sm:text-3xl font-semibold text-[#211D19]">100%</p>
                  <p class="font-label-caption text-[11px] uppercase tracking-wider text-[#8C857B]">Derm Evaluated</p>
                </div>
              </div>
            </div>

            <!-- Visual Hero Media -->
            <div class="lg:col-span-6 relative">
              <div class="relative bg-[#FFFFFF] p-3 sm:p-4 rounded-2xl shadow-xl border border-[#B99A60]/20" id="hero3dScene">
                <div class="relative w-full overflow-hidden rounded-xl" id="hero3dCard">
                  <img alt="Aureoné Complete Ritual Suite on Travertine" class="w-full h-auto max-h-[580px] object-cover rounded-xl" src="/assets/img/hero-ritual-bottles.jpg">
                  <div class="hero-3d-sheen" id="hero3dSheen"></div>
                </div>
                <div class="absolute -bottom-4 -left-3 sm:-left-6 flex flex-col bg-[#FFFFFF]/95 backdrop-blur-md p-4 rounded-xl shadow-lg border border-[#B99A60]/25 max-w-[280px] z-20">
                  <div class="flex items-center gap-1.5 text-[#B99A60] mb-1">
                    <span class="material-symbols-outlined text-[18px]">verified</span>
                    <span class="font-label-eyebrow text-[10px] uppercase tracking-widest text-[#211D19] font-semibold">Maison Standard</span>
                  </div>
                  <p class="font-body-sm text-[12px] text-[#57524C] leading-snug">
                    Zero parabens, sulfates, micro-plastics, or synthetic irritants.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 2: WHAT'S IN YOUR DECK (Inspired by Blabliblu dw-deck) -->
      <section class="dw-deck-sec" id="deck">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
          <div class="dw-deck-header">
            <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">The Protocol Sequence</span>
            <h2 class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal tracking-tight mt-1">
              What’s in your deck
            </h2>
            <p class="font-body-md text-[#57524C] mt-2">
              Every stage calibrated to work in biological synergy with your skin barrier. Select a protocol step to explore.
            </p>
          </div>

          <div class="dw-deck-grid">
            <a href="#p-rice-veil" class="dw-deck-card">
              <span class="dw-deck-step">Step 01</span>
              <div class="dw-deck-media">
                <img src="/assets/img/card-rice-veil.jpg" alt="Rice Veil">
              </div>
              <span class="dw-deck-name">Rice Veil</span>
              <span class="dw-deck-sub">Cleanse</span>
            </a>

            <a href="#p-radiance-5" class="dw-deck-card">
              <span class="dw-deck-step">Step 02</span>
              <div class="dw-deck-media">
                <img src="/assets/img/card-radiance-5.jpg" alt="Radiance 5">
              </div>
              <span class="dw-deck-name">Radiance 5</span>
              <span class="dw-deck-sub">Rebalance</span>
            </a>

            <a href="#p-bright-essence" class="dw-deck-card">
              <span class="dw-deck-step">Step 03</span>
              <div class="dw-deck-media">
                <img src="/assets/img/card-bright-essence.jpg" alt="Bright Essence">
              </div>
              <span class="dw-deck-name">Bright Essence</span>
              <span class="dw-deck-sub">Illuminate</span>
            </a>

            <a href="#p-velvet-barrier" class="dw-deck-card">
              <span class="dw-deck-step">Step 04</span>
              <div class="dw-deck-media">
                <img src="/assets/img/card-velvet-barrier.jpg" alt="Velvet Barrier">
              </div>
              <span class="dw-deck-name">Velvet Barrier</span>
              <span class="dw-deck-sub">Fortify</span>
            </a>

            <a href="#p-solar-veil" class="dw-deck-card">
              <span class="dw-deck-step">Step 05</span>
              <div class="dw-deck-media">
                <img src="/assets/img/card-solar-veil.jpg" alt="Solar Veil">
              </div>
              <span class="dw-deck-name">Solar Veil</span>
              <span class="dw-deck-sub">Defend</span>
            </a>

            <a href="#master-duo" class="dw-deck-card">
              <span class="dw-deck-step" style="color:var(--dw-ink)">Curated</span>
              <div class="dw-deck-media">
                <img src="/assets/img/hero-ritual-bottles.jpg" alt="Master Sets">
              </div>
              <span class="dw-deck-name">Master Duos</span>
              <span class="dw-deck-sub">Ceremonies</span>
            </a>
          </div>
        </div>
      </section>

      <!-- SECTION 3: CLINICAL BESTSELLERS GRID (Inspired by Blabliblu dw-pc product cards) -->
      <section class="w-full bg-[#F8F5EF] py-16 lg:py-24" id="bestsellers">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
          <div class="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div class="max-w-xl">
              <div class="flex items-center gap-2 mb-2">
                <span class="w-6 h-[1px] bg-[#B99A60]"></span>
                <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.2em] font-semibold">Clinical Bestsellers</span>
              </div>
              <h2 class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal tracking-tight">
                Sequential Daily Regimen
              </h2>
              <p class="font-body-md text-[#57524C] mt-2 text-[15px]">
                Engineered for seamless bio-absorption from morning clarity to nocturnal cellular rest. Every bottle calibrated to preserve barrier harmony.
              </p>
            </div>
            <div class="mt-4 md:mt-0 flex items-center gap-3">
              <span class="font-label-caption text-[11px] uppercase tracking-wider text-[#8C857B] bg-[#FFFFFF] px-3.5 py-1.5 border border-[#B99A60]/20 rounded-full shadow-sm">Sequence: 01 — 05</span>
            </div>
          </div>

          <!-- The 5 Blabliblu-styled Product Cards Grid -->
          <div class="dw-pc-grid">
            <!-- Step 01: Rice Veil -->
            <article class="dw-pc" id="p-rice-veil">
              <span class="new-budge">BESTSELLER</span>
              <a href="/product/rice-veil" data-link class="dw-pc__img">
                <img src="/assets/img/card-rice-veil.jpg" alt="Rice Veil Gentle Daily Face Wash" loading="lazy">
              </a>
              <div class="dw-pc__info">
                <span class="dw-pc__cat">Step 01 • Cleanse</span>
                <div class="dw-pc__t">
                  <h3><a href="/product/rice-veil" data-link>Rice Veil Face Wash - 100 ML</a></h3>
                  <div class="dw-pc__notes">Fermented Rice | Panthenol | Glycerin</div>
                </div>
                <div class="dw-pc__price">
                  <b>₹649</b>
                  <s>₹799</s>
                  <span class="dw-discount">19% OFF</span>
                </div>
                <div class="dw-pc__chips">
                  <span>pH 5.5 Balanced</span>
                  <span>All Skin Types</span>
                  <span>Zero Tightness</span>
                </div>
              </div>
              <button class="dw-add" data-dw-add="p1" type="button" aria-label="Add Rice Veil to bag">
                <span class="lbl">Add to bag</span>
                <span class="ok" aria-hidden="true">Added ✓</span>
              </button>
            </article>

            <!-- Step 02: Radiance 5 -->
            <article class="dw-pc" id="p-radiance-5">
              <span class="new-budge gold">TOP RATED</span>
              <a href="/product/radiance-5" data-link class="dw-pc__img">
                <img src="/assets/img/card-radiance-5.jpg" alt="Radiance 5 Niacinamide Serum" loading="lazy">
              </a>
              <div class="dw-pc__info">
                <span class="dw-pc__cat">Step 02 • Rebalance</span>
                <div class="dw-pc__t">
                  <h3><a href="/product/radiance-5" data-link>Radiance 5 Serum - 30 ML</a></h3>
                  <div class="dw-pc__notes">Niacinamide 5% | Fermented Rice | Alpha Arbutin</div>
                </div>
                <div class="dw-pc__price">
                  <b>₹849</b>
                  <s>₹1,099</s>
                  <span class="dw-discount">23% OFF</span>
                </div>
                <div class="dw-pc__chips">
                  <span>Pore Refining</span>
                  <span>Tone Corrector</span>
                  <span>Oil Control</span>
                </div>
              </div>
              <button class="dw-add" data-dw-add="p6" type="button" aria-label="Add Radiance 5 to bag">
                <span class="lbl">Add to bag</span>
                <span class="ok" aria-hidden="true">Added ✓</span>
              </button>
            </article>

            <!-- Step 03: Bright Essence -->
            <article class="dw-pc" id="p-bright-essence">
              <span class="new-budge">CLINICAL PICK</span>
              <a href="/product/bright-essence" data-link class="dw-pc__img">
                <img src="/assets/img/card-bright-essence.jpg" alt="Bright Essence Radiance Elixir" loading="lazy">
              </a>
              <div class="dw-pc__info">
                <span class="dw-pc__cat">Step 03 • Illuminate</span>
                <div class="dw-pc__t">
                  <h3><a href="/product/bright-essence" data-link>Bright Essence - 30 ML</a></h3>
                  <div class="dw-pc__notes">Vitamin C (3-O Ethyl) | Ferulic Acid | HA</div>
                </div>
                <div class="dw-pc__price">
                  <b>₹1,099</b>
                  <s>₹1,299</s>
                  <span class="dw-discount">15% OFF</span>
                </div>
                <div class="dw-pc__chips">
                  <span>Photoprotect</span>
                  <span>Antioxidant</span>
                  <span>Instant Glow</span>
                </div>
              </div>
              <button class="dw-add" data-dw-add="p3" type="button" aria-label="Add Bright Essence to bag">
                <span class="lbl">Add to bag</span>
                <span class="ok" aria-hidden="true">Added ✓</span>
              </button>
            </article>

            <!-- Step 04: Velvet Barrier -->
            <article class="dw-pc" id="p-velvet-barrier">
              <span class="new-budge gold">BARRIER REPAIR</span>
              <a href="/product/velvet-barrier" data-link class="dw-pc__img">
                <img src="/assets/img/card-velvet-barrier.jpg" alt="Velvet Barrier Repair Cream" loading="lazy">
              </a>
              <div class="dw-pc__info">
                <span class="dw-pc__cat">Step 04 • Fortify</span>
                <div class="dw-pc__t">
                  <h3><a href="/product/velvet-barrier" data-link>Velvet Barrier Cream - 50 GM</a></h3>
                  <div class="dw-pc__notes">Ceramide NP | Plant Squalane | Hyaluronic Matrix</div>
                </div>
                <div class="dw-pc__price">
                  <b>₹999</b>
                  <s>₹1,199</s>
                  <span class="dw-discount">17% OFF</span>
                </div>
                <div class="dw-pc__chips">
                  <span>Lipid Lock</span>
                  <span>Deep Recovery</span>
                  <span>Velvet Cushion</span>
                </div>
              </div>
              <button class="dw-add" data-dw-add="p4" type="button" aria-label="Add Velvet Barrier to bag">
                <span class="lbl">Add to bag</span>
                <span class="ok" aria-hidden="true">Added ✓</span>
              </button>
            </article>

            <!-- Step 05: Solar Veil -->
            <article class="dw-pc" id="p-solar-veil">
              <span class="new-budge">NEW LAUNCH</span>
              <a href="/product/solar-veil" data-link class="dw-pc__img">
                <img src="/assets/img/card-solar-veil.jpg" alt="Solar Veil Daily Sunscreen SPF 50" loading="lazy">
              </a>
              <div class="dw-pc__info">
                <span class="dw-pc__cat">Step 05 • Defend</span>
                <div class="dw-pc__t">
                  <h3><a href="/product/solar-veil" data-link>Solar Veil SPF 50 - 50 ML</a></h3>
                  <div class="dw-pc__notes">Ceramides | Squalane | Vitamin E | UVA/UVB</div>
                </div>
                <div class="dw-pc__price">
                  <b>₹799</b>
                  <s>₹999</s>
                  <span class="dw-discount">20% OFF</span>
                </div>
                <div class="dw-pc__chips">
                  <span>Zero White Cast</span>
                  <span>Non-Comedogenic</span>
                  <span>Dewy Finish</span>
                </div>
              </div>
              <button class="dw-add" data-dw-add="p5" type="button" aria-label="Add Solar Veil to bag">
                <span class="lbl">Add to bag</span>
                <span class="ok" aria-hidden="true">Added ✓</span>
              </button>
            </article>
          </div>
        </div>
      </section>

      <!-- SECTION 4: 3D INTERACTIVE FLACON & CELLULAR ATELIER SHOWCASE -->
      <section class="w-full bg-[#FAF8F3] py-16 lg:py-24 border-y border-[#B99A60]/20 relative overflow-hidden" id="interactive-3d">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
          <div class="text-center max-w-2xl mx-auto mb-10">
            <div class="inline-flex items-center gap-2 mb-2">
              <span class="w-6 h-[1px] bg-[#B99A60]"></span>
              <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">Diagnostic Atelier & 3D Flacon</span>
              <span class="w-6 h-[1px] bg-[#B99A60]"></span>
            </div>
            <h2 class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal tracking-tight">
              Cellular Architecture in 3D Space
            </h2>
            <p class="font-body-md text-[#57524C] mt-2">
              Inspect the tactile geometry of our gold flacon and cellular orbital suspension. Move your cursor to interact with the light-responsive bottle and active essence.
            </p>
          </div>

          <div class="bg-[#FFFFFF] border border-[#B99A60]/25 rounded-3xl p-6 sm:p-10 shadow-sm relative">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#B99A60]/15">
              <div class="flex items-center gap-3">
                <span class="flex h-3 w-3 relative">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B99A60] opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-[#B99A60]"></span>
                </span>
                <span class="font-label-button text-[12px] uppercase text-[#211D19] tracking-wider font-semibold">
                  Interactive 3D Flacon — Move Cursor to Inspect Cellular Architecture
                </span>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-label-caption text-[11px] text-[#57524C] uppercase tracking-wider bg-[#FAF8F3] px-3.5 py-1.5 rounded-full border border-[#B99A60]/20">
                  Three.js Realtime Renderer • 60 FPS
                </span>
              </div>
            </div>

            <!-- 3D Scene Container -->
            <div class="w-full relative min-h-[480px] h-[480px] flex items-center justify-center my-4 overflow-hidden rounded-2xl bg-[#FAF8F3]/60">
              <div id="threejs-container-ANIMATION_23" class="w-full h-full bg-transparent block relative z-10" style="width:100%;height:100%"></div>
            </div>

            <!-- 3D Metrics Feature Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[#B99A60]/15">
              <div class="bg-[#FAF8F3] p-5 rounded-xl border border-[#B99A60]/15">
                <span class="font-label-caption text-[10px] uppercase tracking-wider text-[#B99A60] font-semibold">Core Essence</span>
                <h4 class="font-display-hero text-[18px] text-[#211D19] mt-1 font-medium">Fermented Rice Elixir</h4>
                <p class="font-body-sm text-[13px] text-[#57524C] mt-1">
                  Bio-fermented amino matrix preserved in UV-shielded amber-champagne flacon.
                </p>
              </div>
              <div class="bg-[#FAF8F3] p-5 rounded-xl border border-[#B99A60]/15">
                <span class="font-label-caption text-[10px] uppercase tracking-wider text-[#B99A60] font-semibold">Barrier Integrity</span>
                <h4 class="font-display-hero text-[18px] text-[#211D19] mt-1 font-medium">Bio-Identical Ceramides</h4>
                <p class="font-body-sm text-[13px] text-[#57524C] mt-1">
                  Strata-compatible lipid layers providing instant transepidermal water containment.
                </p>
              </div>
              <div class="bg-[#FAF8F3] p-5 rounded-xl border border-[#B99A60]/15">
                <span class="font-label-caption text-[10px] uppercase tracking-wider text-[#B99A60] font-semibold">Cellular Tone</span>
                <h4 class="font-display-hero text-[18px] text-[#211D19] mt-1 font-medium">Niacinamide 5% & Vitamin C</h4>
                <p class="font-body-sm text-[13px] text-[#57524C] mt-1">
                  Targeted melanosome transfer interruption and photo-defense illumination.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 5: DEAL OF THE DAY — THE EQUILIBRIUM MASTER DUO -->
      <section class="w-full bg-[#F8F5EF] py-16 lg:py-24" id="master-duo">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
          <div class="text-center max-w-2xl mx-auto mb-16">
            <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">Deal of the Day</span>
            <h2 class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal tracking-tight mt-1">
              Cellular Equilibrium in Two Steps
            </h2>
            <p class="font-body-md text-[#57524C] mt-2">
              When paired together, Radiance 5 and Velvet Barrier form a continuous lipid-water reservoir that visibly transforms texture and luminosity within 14 days.
            </p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <!-- Visual Gallery Pair -->
            <div class="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="bg-[#FFFFFF] p-5 rounded-2xl border border-[#B99A60]/20 shadow-sm flex flex-col justify-between">
                <div class="w-full h-[320px] bg-[#FAF8F3] rounded-xl p-3 flex items-center justify-center overflow-hidden border border-[#B99A60]/10">
                  <img alt="Radiance 5 Niacinamide Serum" class="w-full h-full object-contain" src="/assets/img/card-radiance-5.jpg">
                </div>
                <div class="pt-4 text-center">
                  <p class="font-display-hero text-[18px] text-[#211D19]">Radiance 5</p>
                  <p class="font-label-caption text-[11px] text-[#B99A60] uppercase tracking-wider">Step 02 • Brightening Serum</p>
                  <p class="font-body-sm text-[15px] text-[#211D19] font-medium mt-1">₹849</p>
                </div>
              </div>

              <div class="bg-[#FFFFFF] p-5 rounded-2xl border border-[#B99A60]/20 shadow-sm flex flex-col justify-between">
                <div class="w-full h-[320px] bg-[#FAF8F3] rounded-xl p-3 flex items-center justify-center overflow-hidden border border-[#B99A60]/10">
                  <img alt="Velvet Barrier Repair Cream" class="w-full h-full object-contain" src="/assets/img/card-velvet-barrier.jpg">
                </div>
                <div class="pt-4 text-center">
                  <p class="font-display-hero text-[18px] text-[#211D19]">Velvet Barrier</p>
                  <p class="font-label-caption text-[11px] text-[#B99A60] uppercase tracking-wider">Step 04 • Barrier Repair</p>
                  <p class="font-body-sm text-[15px] text-[#211D19] font-medium mt-1">₹999</p>
                </div>
              </div>
            </div>

            <!-- Clinical Efficacy & Bundle Card -->
            <div class="lg:col-span-6 space-y-6">
              <div class="grid grid-cols-3 gap-3 bg-[#FFFFFF] p-6 rounded-2xl border border-[#B99A60]/20 shadow-sm text-center">
                <div>
                  <div class="font-display-hero text-3xl sm:text-4xl font-normal text-[#B99A60]">94%</div>
                  <p class="font-label-caption text-[11px] uppercase tracking-wider text-[#211D19] font-semibold mt-1">Visible Luminosity</p>
                  <p class="font-body-sm text-[#57524C] text-[12px] mt-0.5">Evens tone in 14 days</p>
                </div>
                <div class="border-x border-[#B99A60]/15 px-2">
                  <div class="font-display-hero text-3xl sm:text-4xl font-normal text-[#B99A60]">98%</div>
                  <p class="font-label-caption text-[11px] uppercase tracking-wider text-[#211D19] font-semibold mt-1">Barrier Strength</p>
                  <p class="font-body-sm text-[#57524C] text-[12px] mt-0.5">Validated TEWL control</p>
                </div>
                <div>
                  <div class="font-display-hero text-3xl sm:text-4xl font-normal text-[#B99A60]">0%</div>
                  <p class="font-label-caption text-[11px] uppercase tracking-wider text-[#211D19] font-semibold mt-1">Pore Congestion</p>
                  <p class="font-body-sm text-[#57524C] text-[12px] mt-0.5">Non-comedogenic lab test</p>
                </div>
              </div>

              <!-- Master Duo Bundle Card -->
              <div class="bg-[#FAF8F3] p-6 rounded-2xl border border-[#B99A60]/25">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-label-eyebrow text-[10px] uppercase text-[#B99A60] tracking-widest font-semibold">Special Harmonized Pairing</span>
                  <span class="font-label-caption text-[11px] text-[#FFFFFF] bg-[#B99A60] px-2.5 py-0.5 rounded font-medium">Save ₹250</span>
                </div>
                <h3 class="font-display-hero text-[22px] text-[#211D19]">The Equilibrium Master Duo</h3>
                <p class="font-body-sm text-[13px] text-[#57524C] mt-1 leading-relaxed">
                  Includes Radiance 5 Niacinamide Serum (30ml) + Velvet Barrier Repair Moisturizer (50ml). The essential morning and evening synergy.
                </p>
                <div class="mt-4 flex items-center justify-between">
                  <div class="flex items-baseline gap-2.5">
                    <span class="font-display-hero text-[24px] text-[#211D19] font-medium">₹1,598</span>
                    <span class="font-body-md text-[15px] text-[#8C857B] line-through">₹1,848</span>
                  </div>
                  <button data-add-bundle="duo" class="bg-[#211D19] text-[#FFFFFF] hover:bg-[#B99A60] px-6 py-3 rounded font-label-button text-[11px] uppercase tracking-wider transition-colors shadow-sm">
                    Acquire Duo
                  </button>
                </div>
              </div>

              <!-- Active Details -->
              <div class="space-y-2.5">
                <div class="bg-[#FFFFFF] p-4 rounded-xl border border-[#B99A60]/20">
                  <div class="flex items-center gap-2 text-[#211D19]">
                    <span class="w-2 h-2 rounded-full bg-[#B99A60]"></span>
                    <span class="font-label-button text-[12px] uppercase font-semibold">Niacinamide 5% & Alpha Arbutin</span>
                  </div>
                  <p class="text-[#57524C] font-body-sm text-[13px] mt-1.5 pl-4 leading-relaxed">
                    Regulates excessive sebum while blocking pigment transfer, fading stubborn post-blemish spots with no stinging.
                  </p>
                </div>
                <div class="bg-[#FFFFFF] p-4 rounded-xl border border-[#B99A60]/20">
                  <div class="flex items-center gap-2 text-[#211D19]">
                    <span class="w-2 h-2 rounded-full bg-[#B99A60]"></span>
                    <span class="font-label-button text-[12px] uppercase font-semibold">Bio-Ceramide NP & Plant Squalane</span>
                  </div>
                  <p class="text-[#57524C] font-body-sm text-[13px] mt-1.5 pl-4 leading-relaxed">
                    Lipid complex structurally identical to the natural stratum corneum, locking deep hydration with a featherweight velvet finish.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 6: THE COMPLETE 5-STEP RADIANCE SUITE (MASTER SET) -->
      <section class="w-full bg-[#FAF8F3] py-16 lg:py-24 border-t border-[#B99A60]/20" id="master-suite">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
          <div class="bg-[#FFFFFF] rounded-3xl border border-[#B99A60]/25 shadow-sm p-6 sm:p-12">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <!-- Bundle Image Showcase -->
              <div class="lg:col-span-7">
                <div class="relative rounded-2xl overflow-hidden bg-[#FAF8F3] border border-[#B99A60]/15 p-4 sm:p-6 flex items-center justify-center">
                  <img alt="Aureoné Complete 5-Step Radiant Collection Set" class="w-full h-auto max-h-[500px] object-contain rounded-xl" src="/assets/img/range-wide.jpg">
                  <div class="absolute top-4 left-4 bg-[#211D19] text-[#FFFFFF] px-3.5 py-1.5 rounded font-label-eyebrow text-[10px] uppercase tracking-widest">
                    The Master Set • Complete Ritual
                  </div>
                  <div class="absolute bottom-4 right-4 bg-[#B99A60] text-[#FFFFFF] px-3.5 py-1.5 rounded font-label-button text-[11px] uppercase tracking-wider font-semibold">
                    Save ₹800 (18% Off)
                  </div>
                </div>
              </div>

              <!-- Bundle Purchase Card -->
              <div class="lg:col-span-5 flex flex-col justify-center space-y-5">
                <div>
                  <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">Maison Privilège</span>
                  <h2 class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal tracking-tight mt-1 leading-tight">
                    The Complete 5-Step Radiance Suite
                  </h2>
                  <div class="flex items-center gap-2 mt-2.5">
                    <div class="flex items-center text-[#B99A60]">
                      <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
                      <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
                      <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
                      <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
                      <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
                    </div>
                    <span class="font-label-caption text-[11px] text-[#57524C] font-semibold">4.98 / 5 (870+ Verified Reviews)</span>
                  </div>
                </div>
                <p class="font-body-md text-[15px] text-[#57524C] leading-relaxed">
                  The complete, harmonized protocol designed to cleanse, illuminate, nourish, repair, and shield your skin with zero ingredient clashes.
                </p>

                <!-- Inclusions Checklist -->
                <div class="space-y-2 py-2 border-y border-[#B99A60]/15">
                  <div class="flex items-center gap-2.5 text-[#211D19]">
                    <span class="material-symbols-outlined text-[#B99A60] text-[18px]">check_circle</span>
                    <span class="font-body-sm text-[13px] font-medium">01. Rice Veil Daily Gentle Wash (100ml)</span>
                  </div>
                  <div class="flex items-center gap-2.5 text-[#211D19]">
                    <span class="material-symbols-outlined text-[#B99A60] text-[18px]">check_circle</span>
                    <span class="font-body-sm text-[13px] font-medium">02. Radiance 5 Niacinamide Serum (30ml)</span>
                  </div>
                  <div class="flex items-center gap-2.5 text-[#211D19]">
                    <span class="material-symbols-outlined text-[#B99A60] text-[18px]">check_circle</span>
                    <span class="font-body-sm text-[13px] font-medium">03. Bright Essence Radiance Elixir (30ml)</span>
                  </div>
                  <div class="flex items-center gap-2.5 text-[#211D19]">
                    <span class="material-symbols-outlined text-[#B99A60] text-[18px]">check_circle</span>
                    <span class="font-body-sm text-[13px] font-medium">04. Velvet Barrier Repair Moisturizer (50ml)</span>
                  </div>
                  <div class="flex items-center gap-2.5 text-[#211D19]">
                    <span class="material-symbols-outlined text-[#B99A60] text-[18px]">check_circle</span>
                    <span class="font-body-sm text-[13px] font-medium">05. Solar Veil Daily Sunscreen SPF 50 (50ml)</span>
                  </div>
                  <div class="flex items-center gap-2.5 text-[#B99A60] pt-1 font-medium">
                    <span class="material-symbols-outlined text-[18px]">card_giftcard</span>
                    <span class="font-body-sm text-[13px]">Complimentary Gold Spatula & Organic Linen Travel Pouch</span>
                  </div>
                </div>

                <!-- Price & CTA in INR -->
                <div class="pt-2">
                  <div class="flex items-baseline gap-3 mb-4">
                    <span class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal">₹3,595</span>
                    <span class="font-display-hero text-2xl text-[#8C857B] line-through">₹4,395</span>
                    <span class="font-label-caption text-[11px] text-[#B99A60] uppercase font-semibold">Free Express Courier India</span>
                  </div>
                  <div class="flex flex-col sm:flex-row gap-3">
                    <button data-add-bundle="suite" class="flex-1 bg-[#211D19] text-[#FFFFFF] hover:bg-[#B99A60] px-8 py-4 rounded font-label-button text-[12px] uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm">
                      <span class="material-symbols-outlined text-[18px]">lock</span>
                      <span>Acquire Complete Suite</span>
                    </button>
                  </div>
                  <p class="font-label-caption text-[11px] text-[#57524C] text-center mt-3">
                    30-Day Sensorial Assurance • Complimentary exchanges across India
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 7: EDITORIAL BRAND STORY & PHILOSOPHY -->
      <section class="w-full bg-[#F8F5EF] py-16 lg:py-24">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <!-- Philosophy Manifesto -->
            <div class="lg:col-span-6 space-y-6">
              <div class="flex items-center gap-3">
                <span class="w-8 h-[1px] bg-[#B99A60]"></span>
                <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">Our Philosophy</span>
              </div>
              <h2 class="font-display-hero text-3xl sm:text-4xl lg:text-5xl text-[#211D19] font-normal leading-tight tracking-tight">
                Inspired by Nature.<br/>
                <span class="italic font-light text-[#B99A60]">Backed by Clinical Science.</span>
              </h2>
              <div class="bg-[#FFFFFF] p-6 rounded-2xl border border-[#B99A60]/20 shadow-sm">
                <p class="font-display-hero italic text-[19px] text-[#211D19] leading-relaxed">
                  “Skincare crafted to honor your skin’s innate architecture—never forcing it, but awakening its inherent cellular radiance.”
                </p>
                <div class="flex items-center gap-3 mt-4 pt-3 border-t border-[#B99A60]/15">
                  <span class="font-label-button text-[11px] text-[#B99A60] uppercase tracking-wider font-semibold">Maison Aureoné Laboratories</span>
                  <span class="text-[#8C857B]">•</span>
                  <span class="font-label-caption text-[11px] text-[#57524C]">Paris • Mumbai</span>
                </div>
              </div>
              <p class="font-body-md text-[15px] text-[#57524C] leading-relaxed">
                Founded on the belief that everyday care should be both clinical and ceremonial. Sourcing slow-harvested botanicals subjected to peer-reviewed dermatological evaluations to ensure uncompromising performance.
              </p>

              <!-- Brand Badges -->
              <div class="grid grid-cols-2 gap-4 pt-2">
                <div class="bg-[#FFFFFF] p-4 rounded-xl border border-[#B99A60]/20 flex items-start gap-3">
                  <span class="material-symbols-outlined text-[#B99A60] text-[22px] mt-0.5">eco</span>
                  <div>
                    <h4 class="font-label-button text-[11px] uppercase text-[#211D19] font-semibold">Paraben & Sulfate Free</h4>
                    <p class="font-body-sm text-[12px] text-[#57524C] mt-0.5">Zero micro-fillers or endocrine disruptors.</p>
                  </div>
                </div>
                <div class="bg-[#FFFFFF] p-4 rounded-xl border border-[#B99A60]/20 flex items-start gap-3">
                  <span class="material-symbols-outlined text-[#B99A60] text-[22px] mt-0.5">cruelty_free</span>
                  <div>
                    <h4 class="font-label-button text-[11px] uppercase text-[#211D19] font-semibold">Leaping Bunny Certified</h4>
                    <p class="font-body-sm text-[12px] text-[#57524C] mt-0.5">100% cruelty-free, ethical botanical harvests.</p>
                  </div>
                </div>
                <div class="bg-[#FFFFFF] p-4 rounded-xl border border-[#B99A60]/20 flex items-start gap-3">
                  <span class="material-symbols-outlined text-[#B99A60] text-[22px] mt-0.5">biotech</span>
                  <div>
                    <h4 class="font-label-button text-[11px] uppercase text-[#211D19] font-semibold">Biomimetic Actives</h4>
                    <p class="font-body-sm text-[12px] text-[#57524C] mt-0.5">Bio-identical ceramides and stabilized vitamins.</p>
                  </div>
                </div>
                <div class="bg-[#FFFFFF] p-4 rounded-xl border border-[#B99A60]/20 flex items-start gap-3">
                  <span class="material-symbols-outlined text-[#B99A60] text-[22px] mt-0.5">recycling</span>
                  <div>
                    <h4 class="font-label-button text-[11px] uppercase text-[#211D19] font-semibold">Sustainable Glass Flacons</h4>
                    <p class="font-body-sm text-[12px] text-[#57524C] mt-0.5">Infinitely recyclable and UV-shielded vessels.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Atmospheric Uncropped Photography Grid -->
            <div class="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div class="space-y-5">
                <div class="bg-[#FFFFFF] p-3 rounded-2xl border border-[#B99A60]/20 shadow-sm overflow-hidden">
                  <img alt="Aureoné Brand Monogram" class="w-full h-64 object-contain rounded-xl bg-[#FAF8F3] p-2" src="/assets/img/monogram.png">
                </div>
                <div class="bg-[#FFFFFF] p-3 rounded-2xl border border-[#B99A60]/20 shadow-sm overflow-hidden">
                  <img alt="Velvet Barrier Cream container" class="w-full h-52 object-contain rounded-xl bg-[#FAF8F3] p-2" src="/assets/img/card-velvet-barrier.jpg">
                </div>
              </div>
              <div class="space-y-5 sm:pt-8">
                <div class="bg-[#FFFFFF] p-3 rounded-2xl border border-[#B99A60]/20 shadow-sm overflow-hidden">
                  <img alt="Radiance Skin Philosophy" class="w-full h-64 object-cover rounded-xl bg-[#FAF8F3]" src="/assets/img/philosophy-portrait.jpg">
                </div>
                <div class="bg-[#FFFFFF] p-6 rounded-2xl border border-[#B99A60]/25 shadow-sm text-center">
                  <span class="font-label-eyebrow text-[10px] uppercase tracking-widest text-[#B99A60] font-semibold">Diagnostic Atelier</span>
                  <p class="font-display-hero text-[19px] text-[#211D19] mt-1 font-medium">Bespoke Skin Profiling</p>
                  <p class="font-body-sm text-[13px] text-[#57524C] mt-1">2-minute personalized formula match</p>
                  <a href="/ritual" data-link class="mt-4 block w-full bg-[#FAF8F3] hover:bg-[#211D19] hover:text-[#FFFFFF] text-[#211D19] border border-[#B99A60]/25 px-4 py-2.5 rounded font-label-button text-[11px] uppercase tracking-wider transition-colors">
                    Start Skin Diagnostic
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 8: VOICES OF RADIANCE (Blabliblu dw-tc Testimonials) -->
      <section class="w-full bg-[#FAF8F3] py-16 lg:py-20 border-t border-[#B99A60]/20" id="reviews">
        <div class="max-w-7xl mx-auto px-6 lg:px-12 text-center">
          <div class="inline-flex items-center gap-2 mb-3">
            <span class="w-8 h-[1px] bg-[#B99A60]"></span>
            <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">Voices of Radiance</span>
            <span class="w-8 h-[1px] bg-[#B99A60]"></span>
          </div>
          <h2 class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal tracking-tight">Verified Ritual Experiences</h2>
          <p class="font-body-md text-[#57524C] mt-2 max-w-xl mx-auto">
            Honest feedback from individuals who made Aureoné their daily ceremonial anchor.
          </p>

          <div class="dw-testi-grid mt-12 text-left">
            <figure class="dw-tc">
              <div>
                <div class="dw-tc__stars">
                  <svg width="96" height="18" viewBox="0 0 108 18" fill="currentColor">
                    <g fill="#B99A60">
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(22.4 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(44.8 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(67.2 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(89.6 0)"/>
                    </g>
                  </svg>
                </div>
                <blockquote class="dw-tc__q">
                  “Radiance 5 smoothed persistent post-blemish pigmentation around my cheekbones within 3 weeks. It absorbs like morning dew with zero stickiness.”
                </blockquote>
              </div>
              <figcaption>
                <div>
                  <p class="dw-tc__who">Ananya R.</p>
                  <p class="dw-tc__what">Verified Collector • Mumbai</p>
                </div>
                <span class="dw-tc__prod">Radiance 5</span>
              </figcaption>
            </figure>

            <figure class="dw-tc">
              <div>
                <div class="dw-tc__stars">
                  <svg width="96" height="18" viewBox="0 0 108 18" fill="currentColor">
                    <g fill="#B99A60">
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(22.4 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(44.8 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(67.2 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(89.6 0)"/>
                    </g>
                  </svg>
                </div>
                <blockquote class="dw-tc__q">
                  “Velvet Barrier saved my compromised skin barrier during dry winter travel. Cushiony, rich yet perfectly breathable underneath daily makeup.”
                </blockquote>
              </div>
              <figcaption>
                <div>
                  <p class="dw-tc__who">Priya K.</p>
                  <p class="dw-tc__what">Verified Collector • New Delhi</p>
                </div>
                <span class="dw-tc__prod">Velvet Barrier</span>
              </figcaption>
            </figure>

            <figure class="dw-tc">
              <div>
                <div class="dw-tc__stars">
                  <svg width="96" height="18" viewBox="0 0 108 18" fill="currentColor">
                    <g fill="#B99A60">
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(22.4 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(44.8 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(67.2 0)"/>
                      <path d="M8.76 0L6.7 6.3H0l5.41 3.9-2.07 6.3 5.42-3.9 5.41 3.9-2.07-6.3 5.42-3.9h-6.69z" transform="translate(89.6 0)"/>
                    </g>
                  </svg>
                </div>
                <blockquote class="dw-tc__q">
                  “Solar Veil has absolute zero white cast on warm Indian skin tones. Melts like an exquisite serum while offering true SPF 50 PA++++ protection.”
                </blockquote>
              </div>
              <figcaption>
                <div>
                  <p class="dw-tc__who">Devika M.</p>
                  <p class="dw-tc__what">Verified Collector • Bengaluru</p>
                </div>
                <span class="dw-tc__prod">Solar Veil</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <!-- SECTION 9: ACCORDION FAQS (Blabliblu dw-faq style) -->
      <section class="dw-faq-sec" id="faqs">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
          <div class="dw-faq-wrap">
            <div class="dw-faq-header">
              <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">Concierge & Answers</span>
              <h2 class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal tracking-tight mt-1">
                Frequently Asked Questions
              </h2>
              <p class="font-body-md text-[#57524C] mt-2">
                Everything you need to know about our formulations, clinical layering, and orders.
              </p>
            </div>

            <div class="dw-acc-list">
              <div class="dw-acc open">
                <button type="button" class="dw-acc__q" aria-expanded="true">
                  <span>How should I layer the 5-step Aureoné ritual?</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="dw-acc__a">
                  <p>
                    Follow the bio-absorption order: begin with <strong>Step 01 Rice Veil</strong> to cleanse. In the morning, follow with <strong>Step 03 Bright Essence (Vitamin C)</strong>, moisturize with <strong>Step 04 Velvet Barrier</strong>, and shield with <strong>Step 05 Solar Veil SPF 50</strong>. In the evening, cleanse with Rice Veil, treat with <strong>Step 02 Radiance 5 (Niacinamide)</strong>, and seal overnight recovery with Velvet Barrier.
                  </p>
                </div>
              </div>

              <div class="dw-acc">
                <button type="button" class="dw-acc__q" aria-expanded="false">
                  <span>Are Aureoné products suitable for sensitive or acne-prone skin?</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="dw-acc__a">
                  <p>
                    Yes, absolutely. All our formulations are 100% non-comedogenic, fragrance-neutral, and formulated without sulfates, parabens, drying alcohols, or synthetic colorants. Radiance 5 contains 5% Niacinamide with soothing rice extract and panthenol specifically calibrated not to trigger purging or irritation.
                  </p>
                </div>
              </div>

              <div class="dw-acc">
                <button type="button" class="dw-acc__q" aria-expanded="false">
                  <span>When can I expect to see visible results?</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="dw-acc__a">
                  <p>
                    Skin hydration and barrier comfort are noticeable immediately after the first application. Clinical tone evening, reduced redness, and pore refinement typically become visibly distinct within 14 to 21 days of continuous morning and evening ritual use.
                  </p>
                </div>
              </div>

              <div class="dw-acc">
                <button type="button" class="dw-acc__q" aria-expanded="false">
                  <span>What makes bio-fermented rice extract so effective?</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="dw-acc__a">
                  <p>
                    Bio-fermentation breaks down complex amino acids and antioxidants into low-molecular-weight peptides that penetrate the cellular stratum corneum effortlessly, stimulating collagen synthesis and barrier moisture retention without heavy film formers.
                  </p>
                </div>
              </div>

              <div class="dw-acc">
                <button type="button" class="dw-acc__q" aria-expanded="false">
                  <span>What are your delivery timelines and is COD available?</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="dw-acc__a">
                  <p>
                    Orders are processed within 24 hours from our atelier. Express delivery across metro cities in India takes 2–3 business days, and 3–5 days for other regions. Cash on Delivery (COD) as well as all major UPI, Cards, and Net Banking options are fully supported at checkout.
                  </p>
                </div>
              </div>

              <div class="dw-acc">
                <button type="button" class="dw-acc__q" aria-expanded="false">
                  <span>Are Aureoné products 100% cruelty-free?</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="dw-acc__a">
                  <p>
                    Yes. We never test on animals at any stage of product development, and we adhere to rigorous ethical sourcing standards. All our packaging is crafted from recyclable glass flacons and FSC-certified paperboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION 10: THE PRIVATE GAZETTE / VIP NEWSLETTER -->
      <section class="w-full bg-[#FAF8F3] py-14 border-t border-[#B99A60]/20">
        <div class="max-w-4xl mx-auto px-6 text-center">
          <span class="font-label-eyebrow text-[11px] uppercase text-[#B99A60] tracking-[0.25em] font-semibold">The Private Gazette</span>
          <h2 class="font-display-hero text-3xl sm:text-4xl text-[#211D19] font-normal tracking-tight mt-1">Receive Private Allocations</h2>
          <p class="font-body-md text-[15px] text-[#57524C] mt-2 max-w-xl mx-auto">
            Unlock 10% privilege on your first ritual allocation, plus invitations to botanical harvests and seasonal releases.
          </p>
          <form class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mt-6" data-sub>
            <input class="flex-1 bg-[#FFFFFF] border border-[#B99A60]/30 px-5 py-3.5 rounded text-[#211D19] font-body-sm text-[14px] placeholder:text-[#8C857B] focus:outline-none focus:ring-1 focus:ring-[#B99A60]" name="email" placeholder="Enter your email address" type="email" required>
            <button class="bg-[#211D19] text-[#FFFFFF] hover:bg-[#B99A60] px-8 py-3.5 rounded font-label-button text-[12px] uppercase tracking-wider transition-colors shrink-0 shadow-sm" type="submit">
              Subscribe
            </button>
          </form>
          <p class="font-label-caption text-[11px] text-[#8C857B] mt-3">Strict confidentiality. Unsubscribe at any time.</p>
        </div>
      </section>`;
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
      <section class="wrap" style="padding-bottom:40px;padding-top:20px">
        <div class="catalog-grid" id="shopGrid"></div>
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
        <div class="split-media glass reveal"><img src="/assets/img/model-female-ritual.jpg" alt="Woman performing her AUREONÉ morning ritual" loading="lazy"></div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap split" style="direction:rtl">
        <div class="reveal" style="direction:ltr">
          <div class="eyebrow">For him</div>
          <h2 class="display">Skincare without <em class="gold-text">compromise</em></h2>
          <p>The AUREONÉ ritual isn't gendered — it's universal. Clean actives that work with every skin type, every lifestyle. Effective, no-fuss, and designed for those who value their skin.</p>
          <a href="/shop" data-link class="btn btn-gold" style="margin-top:14px">Shop the collection</a>
        </div>
        <div class="split-media glass reveal" style="direction:ltr"><img src="/assets/img/model-male-ritual.jpg" alt="Man performing his AUREONÉ evening ritual" loading="lazy"></div>
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
        <div class="split-media glass reveal"><img src="/assets/img/model-female.jpg" alt="Woman with radiant skin using AUREONÉ" loading="lazy"></div>
        <div class="reveal">
          <div class="eyebrow">The house of AUREONÉ</div>
          <h2 class="display">${esc(s.aboutTitle)}</h2>
          <p>${esc(s.aboutText)}</p>
          <p class="script" style="font-size:26px;margin:14px 0 0">One ritual at a time</p>
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
          <h2 class="display" style="font-size:clamp(20px, 2.4vw, 28px);font-style:italic;line-height:1.45;max-width:780px;margin:0 auto">“AUREONÉ creates thoughtfully formulated modern skincare where effective actives meet considered daily care — helping you build healthier, more radiant-looking skin, one ritual at a time.”</h2>
        </div>
      </div></section>
      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="banner reveal" style="min-height:360px">
          <img src="/assets/img/models-lifestyle.jpg" alt="Couple enjoying the AUREONÉ skincare ritual" loading="lazy">
          <div class="banner-card glass glass-strong">
            <div class="eyebrow">For him · For her · For radiance</div>
            <h3 class="display">The ritual begins here.</h3>
            <p>Designed for every skin — discover the essentials of the AUREONÉ ritual.</p>
            <a href="/shop" data-link class="btn btn-gold">Shop now</a>
          </div>
        </div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap split">
        <div class="split-media glass reveal"><img src="/assets/img/model-male.jpg" alt="Man with clear, healthy skin using AUREONÉ" loading="lazy"></div>
        <div class="reveal">
          <div class="eyebrow">His story</div>
          <h2 class="display">Skincare for <em class="gold-text">everyone</em></h2>
          <p>At AUREONÉ, we believe radiant, healthy skin has no gender. Our formulations work beautifully across all skin types — because great skincare should be universal.</p>
          <p class="script" style="font-size:26px;margin:14px 0 0">Radiance for all</p>
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
      ['Protect', 'Shield your glow from UVA and UVB with weightless SPF 50 PA++++.'],
      ['Glow', 'Complete your ritual with consistent care for a healthy, radiant-looking complexion.']
    ];
    return `<div class="ritual">${steps.map(([cat, text], i) => {
      const p = find(cat);
      return `<div class="step reveal"><div class="num">0${i + 1}</div><h3>${cat}</h3><p>${text}</p>${p ? `<a href="/product/${esc(p.slug)}" data-link>${esc(p.name)} →</a>` : '<span class="step-meta">Consistent Care</span>'}</div>`;
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
    const draw = () => {
      let list = [...state.products];
      list.sort((a, b) => (b.featured - a.featured));
      $('#shopGrid').innerHTML = list.length ? list.map(card).join('') : '<div class="empty">No products in the collection yet.</div>';
      observeReveal();
    };
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

  /* ---------- hero 3d animation ---------- */
  function initHero3d() {
    const scene = $('#hero3dScene');
    const card = $('#hero3dCard');
    const sheen = $('#hero3dSheen');
    if (!scene || !card) return;

    let rect = null;
    let leaveTimer = null;

    const onEnter = () => {
      clearTimeout(leaveTimer);
      rect = scene.getBoundingClientRect();
      card.classList.add('is-interacting');
      card.style.transition = 'transform 0.12s ease-out';
      if (sheen) sheen.style.opacity = '1';
    };

    const onMove = e => {
      if (!rect) rect = scene.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const px = (mouseX / rect.width) - 0.5;
      const py = (mouseY / rect.height) - 0.5;

      const rotateY = px * 24;
      const rotateX = -py * 18;

      card.style.transform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.025, 1.025, 1.025)`;

      if (sheen) {
        const sx = ((px + 0.5) * 100).toFixed(1);
        const sy = ((py + 0.5) * 100).toFixed(1);
        sheen.style.background = `radial-gradient(circle at ${sx}% ${sy}%, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 65%)`;
      }
    };

    const onLeave = () => {
      card.style.transition = 'transform 0.75s var(--ease)';
      card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      if (sheen) sheen.style.opacity = '0';
      leaveTimer = setTimeout(() => {
        card.style.transition = '';
        card.classList.remove('is-interacting');
      }, 750);
      rect = null;
    };

    scene.addEventListener('mouseenter', onEnter);
    scene.addEventListener('mousemove', onMove);
    scene.addEventListener('mouseleave', onLeave);

    scene.addEventListener('touchmove', e => {
      if (e.touches && e.touches[0]) {
        onEnter();
        onMove(e.touches[0]);
      }
    }, { passive: true });
    scene.addEventListener('touchend', onLeave);
  }

  /* ---------- three.js stitch scene ---------- */
  let threeJsAnimId = null;
  function initThreeJsScene() {
    if (threeJsAnimId) {
      cancelAnimationFrame(threeJsAnimId);
      threeJsAnimId = null;
    }
    const container = document.getElementById('threejs-container-ANIMATION_23') || document.getElementById('threejs-container');
    if (!container || typeof THREE === 'undefined') return;

    container.innerHTML = '';
    const width = container.clientWidth || container.offsetWidth || 800;
    const height = container.clientHeight || container.offsetHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }
    container.appendChild(renderer.domElement);

    // Lighting setup - Soft champagne studio glow
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.8);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xfff1d6, 2.8);
    mainKeyLight.position.set(5, 8, 6);
    scene.add(mainKeyLight);

    const rimGoldLight = new THREE.DirectionalLight(0xd4af37, 2.2);
    rimGoldLight.position.set(-6, -4, -4);
    scene.add(rimGoldLight);

    const warmPoint = new THREE.PointLight(0xe8c872, 3, 20);
    warmPoint.position.set(0, 0, 3);
    scene.add(warmPoint);

    // Master Group
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // Materials
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8a265,
      metalness: 0.85,
      roughness: 0.22,
      wireframe: false
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfdfaf5,
      metalness: 0.05,
      roughness: 0.1,
      transmission: 0.85,
      thickness: 1.2,
      transparent: true,
      opacity: 0.88,
      ior: 1.48
    });

    const innerCoreMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfb76c,
      emissive: 0x7c5e20,
      emissiveIntensity: 0.4,
      metalness: 0.9,
      roughness: 0.15
    });

    // Central Radiance Glass Flacon / Vial Form
    const bottleGeo = new THREE.CylinderGeometry(0.75, 0.82, 2.6, 36);
    const bottleMesh = new THREE.Mesh(bottleGeo, glassMaterial);
    masterGroup.add(bottleMesh);

    // Inner Luminous Core (Serum Essence)
    const coreGeo = new THREE.CylinderGeometry(0.48, 0.52, 2.0, 32);
    const coreMesh = new THREE.Mesh(coreGeo, innerCoreMaterial);
    bottleMesh.add(coreMesh);

    // Gold Dropper Collar & Cap
    const capBaseGeo = new THREE.CylinderGeometry(0.76, 0.76, 0.45, 32);
    const capBaseMesh = new THREE.Mesh(capBaseGeo, goldMaterial);
    capBaseMesh.position.y = 1.5;
    bottleMesh.add(capBaseMesh);

    const dropperTopGeo = new THREE.SphereGeometry(0.38, 24, 24);
    dropperTopGeo.scale(1, 1.4, 1);
    const dropperTopMesh = new THREE.Mesh(dropperTopGeo, new THREE.MeshStandardMaterial({
      color: 0xfcfaf7,
      roughness: 0.35,
      metalness: 0.1
    }));
    dropperTopMesh.position.y = 1.95;
    bottleMesh.add(dropperTopMesh);

    // Luxury Orbital Rings (Cellular Harmony)
    const ringGeo1 = new THREE.TorusGeometry(1.95, 0.035, 16, 100);
    const ringMesh1 = new THREE.Mesh(ringGeo1, goldMaterial);
    ringMesh1.rotation.x = Math.PI / 3;
    ringMesh1.rotation.y = Math.PI / 6;
    masterGroup.add(ringMesh1);

    const ringGeo2 = new THREE.TorusGeometry(2.35, 0.025, 16, 100);
    const ringMesh2 = new THREE.Mesh(ringGeo2, goldMaterial);
    ringMesh2.rotation.x = -Math.PI / 4;
    ringMesh2.rotation.y = Math.PI / 4;
    masterGroup.add(ringMesh2);

    // Floating Cellular / Golden Micro-Spheres
    const particleCount = 42;
    const particleGroup = new THREE.Group();
    masterGroup.add(particleGroup);

    const sphereGeo = new THREE.SphereGeometry(0.065, 16, 16);
    const particleData = [];

    for (let i = 0; i < particleCount; i++) {
      const pMesh = new THREE.Mesh(sphereGeo, i % 2 === 0 ? goldMaterial : glassMaterial);
      const radius = 1.3 + Math.random() * 1.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      pMesh.position.x = radius * Math.sin(phi) * Math.cos(theta);
      pMesh.position.y = (radius * Math.sin(phi) * Math.sin(theta)) * 0.9;
      pMesh.position.z = radius * Math.cos(phi);

      const scale = 0.4 + Math.random() * 0.85;
      pMesh.scale.set(scale, scale, scale);

      particleGroup.add(pMesh);
      particleData.push({
        mesh: pMesh,
        speed: 0.004 + Math.random() * 0.008,
        axisY: Math.random() * 0.005,
        baseY: pMesh.position.y,
        offset: Math.random() * Math.PI * 2
      });
    }

    // Mouse Interaction
    let targetRotX = 0;
    let targetRotY = 0;

    const onMouseMove = e => {
      if (!container.isConnected) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const mouseX = (x / (rect.width || 1)) * 2 - 1;
      const mouseY = -(y / (rect.height || 1)) * 2 + 1;
      targetRotY = mouseX * 0.45;
      targetRotX = -mouseY * 0.35;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Resize handler
    const onResize = () => {
      if (!container.isConnected) return;
      const w = container.clientWidth || container.offsetWidth || 800;
      const h = container.clientHeight || container.offsetHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize, { passive: true });

    // Animation Loop
    const clock = new THREE.Clock();

    function animate() {
      if (!container.isConnected) {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
        return;
      }
      threeJsAnimId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth subtle floating & easing toward mouse
      masterGroup.rotation.y += (targetRotY - masterGroup.rotation.y) * 0.05 + 0.004;
      masterGroup.rotation.x += (targetRotX - masterGroup.rotation.x) * 0.05;
      masterGroup.position.y = Math.sin(elapsed * 1.2) * 0.12;

      // Orbit rings counter rotations
      ringMesh1.rotation.z += 0.006;
      ringMesh2.rotation.z -= 0.005;
      ringMesh1.rotation.y = Math.PI / 6 + Math.sin(elapsed * 0.8) * 0.15;

      // Floating golden particles
      particleGroup.rotation.y += 0.003;
      particleData.forEach(p => {
        p.mesh.position.y = p.baseY + Math.sin(elapsed * 2 + p.offset) * 0.08;
      });

      renderer.render(scene, camera);
    }
    animate();
  }

  function mountHome() {
    initHero3d();
    initThreeJsScene();
  }

  /* ---------- router ---------- */
  const routes = [
    [/^\/$/, () => pages.home(), mountHome],
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
    document.title = 'AUREONÉ — The Art of Radiance';
    let html = notFound(), mount = null;
    for (const [re, view, m] of routes) {
      const match = path.match(re);
      if (match) { html = view(match); mount = m; break; }
    }
    app.innerHTML = `<div class="page-enter">${html}</div>`;
    mount?.();
    $$('.nav-links a, .mobile-nav a').forEach(a => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === '/' ? path === '/' : path.startsWith(href));
    });
    $('#mobileNav')?.classList.remove('open');
    observeReveal();
  }

  function navigate(url) {
    history.pushState(null, '', url);
    openDrawer(false);
    openSearch(false);
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

  /* ---------- search modal ---------- */
  const searchOverlay = $('#searchOverlay');
  const searchInput = $('#searchInput');
  const searchResultsList = $('#searchResultsList');
  function openSearch(open = true) {
    if (!searchOverlay) return;
    searchOverlay.classList.toggle('open', open);
    searchOverlay.setAttribute('aria-hidden', !open);
    if (open) {
      searchInput?.focus();
      renderSearch(searchInput?.value || '');
    }
  }
  function renderSearch(q = '') {
    if (!searchResultsList) return;
    const term = q.toLowerCase().trim();
    if (!term) { searchResultsList.innerHTML = ''; return; }
    const matches = state.products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.subtitle.toLowerCase().includes(term) ||
      (p.ingredients && p.ingredients.some(i => i.name.toLowerCase().includes(term)))
    );
    if (!matches.length) {
      searchResultsList.innerHTML = `<p class="muted small" style="text-align:center;padding:16px 0;">No matching formulas found.</p>`;
      return;
    }
    searchResultsList.innerHTML = matches.map(p => `
      <a href="/product/${esc(p.slug)}" data-link class="search-result-item" onclick="document.getElementById('searchOverlay')?.classList.remove('open')">
        <img src="${esc(p.cardImage || p.images[0])}" alt="${esc(p.name)}">
        <div>
          <b style="font-family:var(--serif);font-size:17px;color:var(--ink)">${esc(p.name)}</b>
          <div class="muted small">${esc(p.subtitle)}</div>
          <strong style="color:var(--gold);font-size:13.5px">${money(p.price)}</strong>
        </div>
      </a>
    `).join('');
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-link]');
    if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && link.origin === location.origin) {
      e.preventDefault();
      return navigate(link.pathname + link.search);
    }
    const dwAdd = e.target.closest('.dw-add, [data-dw-add]');
    if (dwAdd) {
      e.preventDefault();
      const pid = dwAdd.dataset.dwAdd || dwAdd.dataset.add;
      addToBag(pid);
      dwAdd.classList.add('is-done');
      setTimeout(() => dwAdd.classList.remove('is-done'), 1800);
      return openDrawer();
    }
    const accBtn = e.target.closest('.dw-acc__q');
    if (accBtn) {
      e.preventDefault();
      const acc = accBtn.closest('.dw-acc');
      const isCurrentlyOpen = acc.classList.contains('open');
      acc.closest('.dw-acc-list')?.querySelectorAll('.dw-acc').forEach(a => {
        a.classList.remove('open');
        a.querySelector('.dw-acc__q')?.setAttribute('aria-expanded', 'false');
      });
      if (!isCurrentlyOpen) {
        acc.classList.add('open');
        accBtn.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) { e.preventDefault(); addToBag(add.dataset.add); return openDrawer(); }
    const bundle = e.target.closest('[data-add-bundle]');
    if (bundle) {
      e.preventDefault();
      const bType = bundle.dataset.addBundle;
      if (bType === 'duo') {
        addToBag('p6', 1, '30 ml');
        addToBag('p4', 1, '50 ml');
        toast('Equilibrium Duo added to bag ✦');
      } else if (bType === 'suite') {
        ['p1', 'p6', 'p3', 'p4', 'p5'].forEach(id => addToBag(id, 1));
        toast('Complete 5-Step Ritual Suite added to bag ✦');
      }
      return openDrawer();
    }
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
  $('#searchBtn')?.addEventListener('click', () => openSearch(true));
  $('#searchClose')?.addEventListener('click', () => openSearch(false));
  searchOverlay?.addEventListener('click', e => { if (e.target === searchOverlay) openSearch(false); });
  searchInput?.addEventListener('input', e => renderSearch(e.target.value));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { openDrawer(false); openSearch(false); $('.lightbox')?.remove(); } });
  $('#menuToggle')?.addEventListener('click', () => $('#mobileNav')?.classList.toggle('open'));
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
    if ($('#brandTagline')) $('#brandTagline').textContent = s.tagline;
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
