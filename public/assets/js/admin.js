/* AUREONÉ Atelier — admin panel */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');
  let settings = { currency: '₹' };
  const money = n => `${settings.currency || '₹'}${Number(n || 0).toLocaleString('en-IN')}`;
  const date = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

  const ico = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    products: '<path d="M9 3h6v3l2 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9l2-3V3Z"/><path d="M7 13h10"/>',
    orders: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    offers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    messages: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    subscribers: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 3 3 6"/>',
    reviews: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>'
  };
  const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ico[n]}</svg>`;
  const NAV = [['dashboard', 'Dashboard'], ['products', 'Products'], ['orders', 'Orders'], ['offers', 'Offers'], ['messages', 'Messages'], ['subscribers', 'Subscribers'], ['reviews', 'Reviews'], ['settings', 'Settings']];

  /* ---------- api ---------- */
  async function api(url, opts = {}) {
    const isForm = opts.body instanceof FormData;
    const res = await fetch(url, { ...opts, headers: isForm ? {} : { 'Content-Type': 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Please sign in again.'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }
  const send = (url, method, body) => api(url, { method, body: JSON.stringify(body) });
  async function uploadFiles(files) {
    const fd = new FormData();
    [...files].forEach(f => fd.append('files', f));
    const { urls } = await api('/api/admin/upload', { method: 'POST', body: fd });
    return urls;
  }

  function toast(msg, err = false) {
    const t = document.createElement('div');
    t.className = `toast glass glass-strong${err ? ' err' : ''}`;
    t.innerHTML = `<span class="dot"></span><span>${esc(msg)}</span>`;
    $('#toasts').append(t);
    setTimeout(() => { t.style.transition = 'opacity .5s'; t.style.opacity = 0; setTimeout(() => t.remove(), 500); }, 3000);
  }
  const confirmBox = msg => window.confirm(msg);

  /* ---------- auth ---------- */
  function showLogin() { $('#shell').hidden = true; $('#login').hidden = false; $('#modal').hidden = true; }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    try {
      await send('/api/admin/login', 'POST', Object.fromEntries(new FormData(e.currentTarget)));
      e.currentTarget.reset();
      boot();
    } catch (err) { $('#loginErr').textContent = err.message; }
  });
  $('#logout').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }).catch(() => { }); showLogin(); });
  $('#sideToggle').addEventListener('click', () => $('#side').classList.toggle('open'));

  /* ---------- router ---------- */
  let badges = {};
  function renderNav(active) {
    $('#sideNav').innerHTML = NAV.map(([k, label]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}">${svg(k)}${label}${badges[k] ? `<span class="badge">${badges[k]}</span>` : ''}</a>`).join('');
  }
  async function refreshBadges() {
    try {
      const s = await api('/api/admin/stats');
      badges = { orders: s.pendingOrders, messages: s.unreadMessages };
      renderNav(current());
    } catch { }
  }
  const current = () => (location.hash.replace('#/', '') || 'dashboard').split('?')[0];

  async function route() {
    const page = current();
    const label = (NAV.find(n => n[0] === page) || NAV[0])[1];
    $('#pageTitle').textContent = label;
    $('#crumb').textContent = `Atelier · ${label}`;
    $('#topActions').innerHTML = '';
    $('#side').classList.remove('open');
    renderNav(page);
    view.innerHTML = '<div class="panel glass empty">Loading…</div>';
    view.style.animation = 'none'; view.offsetHeight; view.style.animation = '';
    try { await (pages[page] || pages.dashboard)(); } catch (err) { view.innerHTML = `<div class="panel glass empty">${esc(err.message)}</div>`; }
  }
  window.addEventListener('hashchange', route);

  /* ---------- pages ---------- */
  const pages = {
    async dashboard() {
      const s = await api('/api/admin/stats');
      badges = { orders: s.pendingOrders, messages: s.unreadMessages };
      renderNav('dashboard');
      $('#topActions').innerHTML = `<a href="#/products?new" class="btn btn-gold btn-sm">+ New product</a>`;
      const last14 = s.days.reduce((a, d) => a + d.revenue, 0);
      view.innerHTML = `
        <div class="stats">
          <div class="stat glass"><div class="label">Total revenue</div><strong>${money(s.revenue)}</strong><small>${money(last14)} in the last 14 days</small></div>
          <div class="stat glass"><div class="label">Orders</div><strong>${s.orders}</strong><small>${s.pendingOrders} awaiting confirmation</small></div>
          <div class="stat glass"><div class="label">Products</div><strong>${s.products}</strong><small>${s.lowStock.length} low on stock</small></div>
          <div class="stat glass"><div class="label">Inbox</div><strong>${s.unreadMessages}</strong><small>unread messages</small></div>
          <div class="stat glass"><div class="label">Subscribers</div><strong>${s.subscribers}</strong><small>inner circle members</small></div>
          <div class="stat glass"><div class="label">Active coupons</div><strong>${s.activeCoupons || 0}</strong><small><a href="#/offers" style="color:var(--gold)">manage offers</a></small></div>
        </div>
        <div class="dash-grid">
          <div class="panel glass">
            <div class="panel-head"><h2>Revenue · last 14 days</h2></div>
            <div class="chart" id="chart"></div>
          </div>
          <div class="panel glass">
            <div class="panel-head"><h2>Best sellers</h2></div>
            <div class="mini-list">${s.topProducts.length ? s.topProducts.map(p => `<div><span>${esc(p.name)}</span><b>${p.qty} sold</b></div>`).join('') : '<p class="muted">No sales yet — they will appear here.</p>'}</div>
            <div class="panel-head" style="margin-top:22px"><h2>Low stock</h2></div>
            <div class="mini-list">${s.lowStock.length ? s.lowStock.map(p => `<div><span>${esc(p.name)}</span><span class="pill low">${p.stock} left</span></div>`).join('') : '<p class="muted">All products are well stocked.</p>'}</div>
          </div>
        </div>
        <div class="panel glass">
          <div class="panel-head"><h2>Recent orders</h2><a href="#/orders" class="mini-btn" style="display:inline-grid;place-items:center">View all</a></div>
          ${s.recentOrders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>
          ${s.recentOrders.map(o => `<tr><td><b>${esc(o.number)}</b></td><td>${esc(o.customer.name)}</td><td>${date(o.createdAt)}</td><td>${money(o.total)}</td><td><span class="pill ${o.status}">${o.status}</span></td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty">No orders yet. Once customers check out, orders appear here.</div>'}
        </div>`;
      drawChart($('#chart'), s.days);
    },

    async products() {
      const list = await api('/api/admin/products');
      $('#topActions').innerHTML = `<input class="input search" id="q" placeholder="Search products…"><button class="btn btn-gold btn-sm" id="newP">+ New product</button>`;
      const draw = () => {
        const q = ($('#q').value || '').toLowerCase();
        const rows = list.filter(p => !q || `${p.name} ${p.subtitle} ${p.category}`.toLowerCase().includes(q));
        view.innerHTML = `<div class="panel glass">${rows.length ? `<div class="table-wrap"><table>
          <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Sizes</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows.map(p => {
            const variants = Array.isArray(p.variants) && p.variants.length ? p.variants : [];
            const sizeStr = variants.length ? variants.map(v => v.size).join(', ') : p.size;
            const totalStock = variants.length ? variants.reduce((s, v) => s + v.stock, 0) : p.stock;
            return `<tr>
            <td><img class="thumb" src="${esc(p.images[0] || '/assets/img/monogram.png')}" alt=""></td>
            <td class="pname"><b>${esc(p.name)}</b><small>${esc(p.subtitle)}</small></td>
            <td>${esc(p.category)}</td>
            <td>${variants.length ? `From ${money(Math.min(...variants.map(v => v.price)))}` : money(p.price)}${p.comparePrice > p.price && !variants.length ? `<br><s class="muted" style="font-size:12px">${money(p.comparePrice)}</s>` : ''}</td>
            <td style="font-size:12px">${esc(sizeStr)}</td>
            <td>${totalStock <= 10 ? `<span class="pill low">${totalStock}</span>` : totalStock}</td>
            <td><span class="pill ${p.active ? 'live' : 'hidden'}">${p.active ? 'Live' : 'Hidden'}</span>${p.featured ? ' <span class="pill" style="--c:var(--gold)">Featured</span>' : ''}</td>
            <td><div class="row-actions">
              <a class="mini-btn" style="display:inline-grid;place-items:center" href="/product/${esc(p.slug)}" target="_blank">View</a>
              <button class="mini-btn" data-edit="${p.id}">Edit</button>
              <button class="mini-btn danger" data-del="${p.id}">Delete</button>
            </div></td></tr>`;
          }).join('')}</tbody></table></div>` : '<div class="empty">No products found.</div>'}</div>`;
        $$('[data-edit]').forEach(b => b.onclick = () => productForm(list.find(p => p.id === b.dataset.edit)));
        $$('[data-del]').forEach(b => b.onclick = async () => {
          const p = list.find(p => p.id === b.dataset.del);
          if (!confirmBox(`Delete "${p.name}"? This cannot be undone.`)) return;
          try { await api(`/api/admin/products/${p.id}`, { method: 'DELETE' }); toast('Product deleted'); route(); } catch (e) { toast(e.message, true); }
        });
      };
      $('#q').addEventListener('input', draw);
      $('#newP').onclick = () => productForm();
      draw();
      if (location.hash.includes('?new')) { history.replaceState(null, '', '#/products'); productForm(); }
    },

    async orders() {
      const list = await api('/api/admin/orders');
      $('#topActions').innerHTML = `<select class="select select-sm" id="statusF"><option value="">All statuses</option>${STATUSES.map(s => `<option value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select>
        <button class="btn btn-glass btn-sm" id="csv">Export CSV</button>`;
      const open = new Set();
      const draw = () => {
        const f = $('#statusF').value;
        const rows = list.filter(o => !f || o.status === f);
        view.innerHTML = `<div class="panel glass">${rows.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows.map(o => `<tr>
            <td><b>${esc(o.number)}</b>${o.coupon ? `<br><small class="muted">🎟 ${esc(o.coupon)}</small>` : ''}</td>
            <td>${esc(o.customer.name)}<br><small class="muted">${esc(o.customer.phone)}</small></td>
            <td>${o.items.reduce((s, i) => s + i.qty, 0)}</td>
            <td>${money(o.total)}${o.discount ? `<br><small style="color:var(--ok)">-${money(o.discount)} off</small>` : ''}</td>
            <td>${date(o.createdAt)}</td>
            <td><select class="select select-sm" data-status="${o.id}">${STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></td>
            <td><div class="row-actions"><button class="mini-btn" data-toggle="${o.id}">${open.has(o.id) ? 'Hide' : 'Details'}</button><button class="mini-btn danger" data-del="${o.id}">Delete</button></div></td>
          </tr>${open.has(o.id) ? `<tr><td colspan="7"><div class="order-detail">
            <div><h4>Deliver to</h4>${esc(o.customer.name)}<br>${esc(o.customer.address)}<br>${esc(o.customer.city)}${o.customer.state ? `, ${esc(o.customer.state)}` : ''} — ${esc(o.customer.pincode)}<br>
              <a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a> · <a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a>
              ${o.note ? `<h4 style="margin-top:14px">Note</h4>${esc(o.note)}` : ''}
              ${o.coupon ? `<h4 style="margin-top:14px">Coupon</h4>${esc(o.coupon)} (-${money(o.discount || 0)})` : ''}
              <h4 style="margin-top:14px">Payment</h4>${esc(o.payment)}</div>
            <div class="order-items"><h4>Items</h4>${o.items.map(i => `<div><span>${esc(i.name)}${i.size ? ` (${esc(i.size)})` : ''} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
              ${o.discount ? `<div style="color:var(--ok)"><span>Coupon discount</span><span>-${money(o.discount)}</span></div>` : ''}
              <div class="muted"><span>Shipping</span><span>${o.shipping ? money(o.shipping) : 'Free'}</span></div>
              <div><b>Total</b><b>${money(o.total)}</b></div></div>
          </div></td></tr>` : ''}`).join('')}</tbody></table></div>` : '<div class="empty">No orders here yet.</div>'}</div>`;
        $$('[data-toggle]').forEach(b => b.onclick = () => { open.has(b.dataset.toggle) ? open.delete(b.dataset.toggle) : open.add(b.dataset.toggle); draw(); });
        $$('[data-status]').forEach(sel => sel.onchange = async () => {
          try {
            const o = await send(`/api/admin/orders/${sel.dataset.status}`, 'PATCH', { status: sel.value });
            Object.assign(list.find(x => x.id === o.id), o);
            toast(`Order ${o.number} marked ${o.status}`);
            refreshBadges();
          } catch (e) { toast(e.message, true); }
        });
        $$('[data-del]').forEach(b => b.onclick = async () => {
          if (!confirmBox('Delete this order permanently?')) return;
          await api(`/api/admin/orders/${b.dataset.del}`, { method: 'DELETE' });
          list.splice(list.findIndex(o => o.id === b.dataset.del), 1);
          toast('Order deleted'); draw(); refreshBadges();
        });
      };
      $('#statusF').onchange = draw;
      $('#csv').onclick = () => downloadCSV('aureone-orders.csv', [['Order', 'Date', 'Status', 'Name', 'Email', 'Phone', 'Address', 'City', 'State', 'PIN', 'Items', 'Subtotal', 'Discount', 'Coupon', 'Shipping', 'Total'],
        ...list.map(o => [o.number, o.createdAt, o.status, o.customer.name, o.customer.email, o.customer.phone, o.customer.address, o.customer.city, o.customer.state, o.customer.pincode, o.items.map(i => `${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty}`).join('; '), o.subtotal, o.discount || 0, o.coupon || '', o.shipping, o.total])]);
      draw();
    },

    async offers() {
      const list = await api('/api/admin/coupons');
      $('#topActions').innerHTML = `<button class="btn btn-gold btn-sm" id="newC">+ New coupon</button>`;
      const draw = () => {
        const today = new Date().toISOString().slice(0, 10);
        view.innerHTML = `<div class="panel glass">${list.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min order</th><th>Usage</th><th>Valid</th><th>Status</th><th></th></tr></thead>
          <tbody>${list.map(c => {
            const expired = c.validUntil && today > c.validUntil;
            const exhausted = c.usageLimit > 0 && c.usageCount >= c.usageLimit;
            const statusClass = !c.active ? 'hidden' : (expired || exhausted) ? 'low' : 'live';
            const statusText = !c.active ? 'Inactive' : expired ? 'Expired' : exhausted ? 'Exhausted' : 'Active';
            return `<tr>
              <td><b style="font-family:var(--sans);letter-spacing:.08em">${esc(c.code)}</b></td>
              <td>${c.type === 'percent' ? 'Percent' : 'Flat'}</td>
              <td>${c.type === 'percent' ? `${c.value}%${c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ''}` : money(c.value)}</td>
              <td>${c.minOrder ? money(c.minOrder) : '—'}</td>
              <td>${c.usageCount || 0}${c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
              <td style="font-size:12px">${c.validFrom || '…'} → ${c.validUntil || '…'}</td>
              <td><span class="pill ${statusClass}">${statusText}</span></td>
              <td><div class="row-actions">
                <button class="mini-btn" data-edit="${c.id}">Edit</button>
                <button class="mini-btn danger" data-del="${c.id}">Delete</button>
              </div></td>
            </tr>`;
          }).join('')}</tbody></table></div>` : '<div class="empty">No coupons yet. Create one to start offering discounts.</div>'}</div>
          <div class="panel glass" style="margin-top:18px">
            <div class="panel-head"><h2>How coupons work</h2></div>
            <p class="muted" style="margin:0;font-size:14px">Active coupons appear on the storefront’s <b>Offers</b> page and on the checkout page. Customers enter the code at checkout to apply the discount. Usage counts are tracked automatically.</p>
          </div>`;
        $$('[data-edit]').forEach(b => b.onclick = () => couponForm(list.find(c => c.id === b.dataset.edit)));
        $$('[data-del]').forEach(b => b.onclick = async () => {
          if (!confirmBox('Delete this coupon?')) return;
          await api(`/api/admin/coupons/${b.dataset.del}`, { method: 'DELETE' });
          list.splice(list.findIndex(c => c.id === b.dataset.del), 1);
          toast('Coupon deleted'); draw();
        });
      };
      $('#newC').onclick = () => couponForm(null, list);
      draw();
    },

    async messages() {
      const list = await api('/api/admin/messages');
      const draw = () => {
        view.innerHTML = `<div class="panel glass">${list.length ? `<div class="table-wrap"><table>
          <thead><tr><th>From</th><th>Message</th><th>Received</th><th></th></tr></thead>
          <tbody>${list.map(m => `<tr class="${m.read ? '' : 'unread'}">
            <td style="min-width:180px"><b>${esc(m.name)}</b><br><a class="muted" href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
            <td style="min-width:300px">${m.subject ? `<b>${esc(m.subject)}</b><br>` : ''}${esc(m.message)}</td>
            <td style="white-space:nowrap">${date(m.createdAt)}</td>
            <td><div class="row-actions">
              <a class="mini-btn" style="display:inline-grid;place-items:center" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message to AUREONÉ'))}">Reply</a>
              <button class="mini-btn" data-read="${m.id}">${m.read ? 'Mark unread' : 'Mark read'}</button>
              <button class="mini-btn danger" data-del="${m.id}">Delete</button>
            </div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Your inbox is empty. Messages from the contact page land here.</div>'}</div>`;
        $$('[data-read]').forEach(b => b.onclick = async () => {
          const m = list.find(x => x.id === b.dataset.read);
          Object.assign(m, await send(`/api/admin/messages/${m.id}`, 'PATCH', { read: !m.read }));
          draw(); refreshBadges();
        });
        $$('[data-del]').forEach(b => b.onclick = async () => {
          if (!confirmBox('Delete this message?')) return;
          await api(`/api/admin/messages/${b.dataset.del}`, { method: 'DELETE' });
          list.splice(list.findIndex(x => x.id === b.dataset.del), 1);
          draw(); refreshBadges();
        });
      };
      draw();
    },

    async subscribers() {
      const list = await api('/api/admin/subscribers');
      $('#topActions').innerHTML = `<button class="btn btn-glass btn-sm" id="csv">Export CSV</button>`;
      $('#csv').onclick = () => downloadCSV('aureone-subscribers.csv', [['Email', 'Joined'], ...list.map(s => [s.email, s.createdAt])]);
      const draw = () => {
        view.innerHTML = `<div class="panel glass">${list.length ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Joined</th><th></th></tr></thead>
          <tbody>${list.map(s => `<tr><td>${esc(s.email)}</td><td>${date(s.createdAt)}</td><td><div class="row-actions"><button class="mini-btn danger" data-del="${s.id}">Remove</button></div></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">No subscribers yet.</div>'}</div>`;
        $$('[data-del]').forEach(b => b.onclick = async () => {
          await api(`/api/admin/subscribers/${b.dataset.del}`, { method: 'DELETE' });
          list.splice(list.findIndex(x => x.id === b.dataset.del), 1); draw();
        });
      };
      draw();
    },

    async reviews() {
      const [list, products] = await Promise.all([api('/api/admin/reviews'), api('/api/admin/products')]);
      const draw = () => {
        view.innerHTML = `
        <form class="panel glass" id="revForm" style="margin-bottom:18px">
          <div class="panel-head"><h2>Add a testimonial</h2><span class="hint">The first three appear on the homepage.</span></div>
          <div class="form-grid three">
            <label class="field"><span>Customer name</span><input class="input" name="name" required></label>
            <label class="field"><span>Product</span><select class="select" name="product"><option value="">—</option>${products.map(p => `<option>${esc(p.name)}</option>`).join('')}</select></label>
            <label class="field"><span>Rating</span><select class="select" name="rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${'★'.repeat(n)}</option>`).join('')}</select></label>
            <label class="field full"><span>Review</span><textarea class="textarea" name="text" required style="min-height:80px"></textarea></label>
          </div>
          <button class="btn btn-gold btn-sm" style="margin-top:16px">Add review</button>
        </form>
        <div class="panel glass">${list.length ? `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Review</th><th>Rating</th><th></th></tr></thead>
          <tbody>${list.map(r => `<tr><td><b>${esc(r.name)}</b><br><small class="muted">${esc(r.product)}</small></td><td>${esc(r.text)}</td><td style="color:var(--gold);white-space:nowrap">${'★'.repeat(r.rating)}</td>
          <td><div class="row-actions"><button class="mini-btn danger" data-del="${r.id}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No reviews yet.</div>'}</div>`;
        $('#revForm').onsubmit = async e => {
          e.preventDefault();
          try { list.unshift(await send('/api/admin/reviews', 'POST', Object.fromEntries(new FormData(e.currentTarget)))); toast('Review added'); draw(); } catch (err) { toast(err.message, true); }
        };
        $$('[data-del]').forEach(b => b.onclick = async () => {
          await api(`/api/admin/reviews/${b.dataset.del}`, { method: 'DELETE' });
          list.splice(list.findIndex(x => x.id === b.dataset.del), 1); draw();
        });
      };
      draw();
    },

    async settings() {
      const s = await api('/api/admin/settings');
      const text = (k, label, full) => `<label class="field${full ? ' full' : ''}"><span>${label}</span><input class="input" name="${k}" value="${esc(s[k])}"></label>`;
      const area = (k, label) => `<label class="field full"><span>${label}</span><textarea class="textarea" name="${k}">${esc(s[k])}</textarea></label>`;
      const num = (k, label) => `<label class="field"><span>${label}</span><input class="input" type="number" min="0" name="${k}" value="${esc(s[k])}"></label>`;
      const imgField = (k, label, contain) => `<div class="field"><span>${label}</span><div class="single-img"><img src="${esc(s[k])}" class="${contain ? 'contain' : ''}" data-preview="${k}" alt="">
        <div style="display:grid;gap:6px"><input type="hidden" name="${k}" value="${esc(s[k])}"><label class="mini-btn" style="display:inline-grid;place-items:center;cursor:pointer">Upload<input type="file" accept="image/*" data-upload="${k}" hidden></label><span class="hint">JPG, PNG or WebP · max 8 MB</span></div></div></div>`;
      $('#topActions').innerHTML = `<button class="btn btn-gold btn-sm" id="saveS">Save changes</button>`;
      view.innerHTML = `
      <form class="panel glass" id="settingsForm">
        <div class="form-grid">
          <div class="section-title">Brand</div>
          ${text('brandName', 'Brand name')}${text('tagline', 'Tagline')}
          ${imgField('logo', 'Logo / monogram', true)}
          ${text('announcement', 'Announcement bar (leave blank to hide)', true)}
          <div class="section-title">Homepage hero</div>
          ${text('heroEyebrow', 'Eyebrow')}${text('heroTitle', 'Headline')}
          ${area('heroSubtitle', 'Sub-headline')}
          ${imgField('heroImage', 'Hero image')}
          <div class="section-title">Our story</div>
          ${text('aboutTitle', 'Heading', true)}${area('aboutText', 'Story')}
          ${imgField('aboutImage', 'Story image')}
          <div class="section-title">Commerce</div>
          ${text('currency', 'Currency symbol')}${num('shippingFee', 'Shipping fee')}
          ${num('freeShippingThreshold', 'Free shipping above')}
          <div class="section-title">Contact</div>
          ${text('contactEmail', 'Email')}${text('contactPhone', 'Phone')}
          ${text('address', 'Address', true)}
          ${text('instagram', 'Instagram URL')}${text('facebook', 'Facebook URL')}
        </div>
      </form>
      <form class="panel glass" id="pwForm" style="margin-top:18px">
        <div class="panel-head"><h2>Admin account</h2><span class="hint">Use at least 8 characters.</span></div>
        <div class="form-grid three">
          <label class="field"><span>Username</span><input class="input" name="username" autocomplete="username" placeholder="Leave blank to keep"></label>
          <label class="field"><span>Current password</span><input class="input" type="password" name="current" autocomplete="current-password" required></label>
          <label class="field"><span>New password</span><input class="input" type="password" name="next" autocomplete="new-password" minlength="8" required></label>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:16px">Update credentials</button>
      </form>`;
      $$('[data-upload]').forEach(inp => inp.onchange = async () => {
        if (!inp.files.length) return;
        try {
          const [url] = await uploadFiles(inp.files);
          $(`[name="${inp.dataset.upload}"]`).value = url;
          $(`[data-preview="${inp.dataset.upload}"]`).src = url;
          toast('Image uploaded — remember to save');
        } catch (e) { toast(e.message, true); }
      });
      $('#saveS').onclick = async () => {
        try {
          settings = await send('/api/admin/settings', 'PUT', Object.fromEntries(new FormData($('#settingsForm'))));
          toast('Settings saved');
        } catch (e) { toast(e.message, true); }
      };
      $('#pwForm').onsubmit = async e => {
        e.preventDefault();
        try { await send('/api/admin/password', 'POST', Object.fromEntries(new FormData(e.currentTarget))); e.currentTarget.reset(); toast('Credentials updated'); } catch (err) { toast(err.message, true); }
      };
    }
  };

  /* ---------- coupon editor ---------- */
  function couponForm(c, parentList) {
    const isNew = !c;
    c = c ? structuredClone(c) : { code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, validFrom: '', validUntil: '', active: true, description: '' };
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = `
      <form class="modal glass glass-strong" id="cForm" style="max-width:640px">
        <div class="modal-head"><h2>${isNew ? 'New coupon' : `Edit · ${esc(c.code)}`}</h2><button type="button" class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
        <div class="modal-body">
          <div class="form-grid">
            <label class="field"><span>Coupon code</span><input class="input" name="code" value="${esc(c.code)}" placeholder="e.g. WELCOME10" required style="text-transform:uppercase"></label>
            <label class="field"><span>Discount type</span><select class="select" name="type"><option value="percent" ${c.type === 'percent' ? 'selected' : ''}>Percentage (%)</option><option value="flat" ${c.type === 'flat' ? 'selected' : ''}>Flat amount (₹)</option></select></label>
            <label class="field"><span>Discount value</span><input class="input" type="number" min="0" name="value" value="${esc(c.value)}" required></label>
            <label class="field"><span>Max discount (₹, for % type, 0 = no cap)</span><input class="input" type="number" min="0" name="maxDiscount" value="${esc(c.maxDiscount)}"></label>
            <label class="field"><span>Minimum order value</span><input class="input" type="number" min="0" name="minOrder" value="${esc(c.minOrder)}"></label>
            <label class="field"><span>Usage limit (0 = unlimited)</span><input class="input" type="number" min="0" name="usageLimit" value="${esc(c.usageLimit)}"></label>
            <label class="field"><span>Valid from</span><input class="input" type="date" name="validFrom" value="${esc(c.validFrom)}"></label>
            <label class="field"><span>Valid until</span><input class="input" type="date" name="validUntil" value="${esc(c.validUntil)}"></label>
            <label class="field full"><span>Description (shown to customers)</span><input class="input" name="description" value="${esc(c.description)}" placeholder="e.g. 10% off on your first order"></label>
            <div class="full"><label class="check"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}> Active</label></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn btn-ghost btn-sm" data-close>Cancel</button><button class="btn btn-gold btn-sm" type="submit">${isNew ? 'Create coupon' : 'Save changes'}</button></div>
      </form>`;
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    $$('[data-close]', m).forEach(b => b.onclick = close);
    m.onclick = e => { if (e.target === m) close(); };
    $('#cForm').onsubmit = async e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      fd.active = !!fd.active;
      try {
        await send(isNew ? '/api/admin/coupons' : `/api/admin/coupons/${c.id}`, isNew ? 'POST' : 'PUT', fd);
        toast(isNew ? 'Coupon created' : 'Coupon saved');
        close();
        route();
      } catch (err) { toast(err.message, true); }
    };
  }

  /* ---------- product editor ---------- */
  function productForm(p) {
    const isNew = !p;
    p = p ? structuredClone(p) : { name: '', subtitle: '', category: 'Treat', price: '', comparePrice: '', size: '30 ml', stock: 0, variants: [], tagline: '', description: '', benefits: [], ingredients: [], howToUse: '', skinTypes: 'All skin types', images: [], featured: false, active: true };
    if (!Array.isArray(p.variants)) p.variants = [];
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = `
      <form class="modal glass glass-strong" id="pForm">
        <div class="modal-head"><h2>${isNew ? 'New product' : `Edit · ${esc(p.name)}`}</h2><button type="button" class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="section-title">Images</div>
            <div class="full"><div class="images" id="imgs"></div><p class="hint" style="margin:8px 0 0">The first image is the cover. Drag files onto the tile or click to upload.</p></div>
            <div class="section-title">Essentials</div>
            <label class="field"><span>Name</span><input class="input" name="name" value="${esc(p.name)}" required></label>
            <label class="field"><span>Subtitle</span><input class="input" name="subtitle" value="${esc(p.subtitle)}" placeholder="e.g. Niacinamide Serum"></label>
            <label class="field"><span>Category</span><input class="input" name="category" value="${esc(p.category)}" list="cats"></label>
            <datalist id="cats"><option>Cleanse</option><option>Treat</option><option>Moisturize</option><option>Protect</option></datalist>
            <label class="field"><span>URL slug</span><input class="input" name="slug" value="${esc(p.slug || '')}" placeholder="auto from name"></label>
            <div class="full form-grid three" style="gap:16px">
              <label class="field"><span>Default price</span><input class="input" type="number" min="0" name="price" value="${esc(p.price)}" required></label>
              <label class="field"><span>Compare-at price</span><input class="input" type="number" min="0" name="comparePrice" value="${esc(p.comparePrice)}"></label>
              <label class="field"><span>Default stock</span><input class="input" type="number" min="0" name="stock" value="${esc(p.stock)}"></label>
            </div>
            <label class="field"><span>Default size</span><input class="input" name="size" value="${esc(p.size)}"></label>
            <label class="field"><span>Skin types</span><input class="input" name="skinTypes" value="${esc(p.skinTypes)}"></label>
            <div class="full" style="display:flex;gap:26px;flex-wrap:wrap">
              <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Live on store</label>
              <label class="check"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> Featured on homepage</label>
            </div>
            <div class="section-title">Size variants</div>
            <div class="full"><div id="vars"></div><button type="button" class="mini-btn" id="addVar">+ Add size variant</button><p class="hint" style="margin:8px 0 0">Each variant has its own size, price and stock. If no variants are added, the default size/price/stock above are used.</p></div>
            <div class="section-title">Story</div>
            <label class="field full"><span>Tagline</span><input class="input" name="tagline" value="${esc(p.tagline)}"></label>
            <label class="field full"><span>Description</span><textarea class="textarea" name="description">${esc(p.description)}</textarea></label>
            <label class="field"><span>Benefits (one per line)</span><textarea class="textarea" name="benefits">${esc((p.benefits || []).join('\n'))}</textarea></label>
            <label class="field"><span>How to use</span><textarea class="textarea" name="howToUse">${esc(p.howToUse)}</textarea></label>
            <div class="section-title">Key ingredients</div>
            <div class="full"><div id="ings"></div><button type="button" class="mini-btn" id="addIng">+ Add ingredient</button></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn btn-ghost btn-sm" data-close>Cancel</button><button class="btn btn-gold btn-sm" type="submit">${isNew ? 'Create product' : 'Save changes'}</button></div>
      </form>`;

    const drawImgs = () => {
      $('#imgs').innerHTML = p.images.map((src, i) => `
        <div class="img-tile">${i === 0 ? '<span class="cover">Cover</span>' : ''}<img src="${esc(src)}" alt="">
          <div class="tools">
            ${i > 0 ? `<button type="button" data-mv="${i}" data-d="-1" title="Move left">‹</button>` : ''}
            ${i > 0 ? `<button type="button" data-cover="${i}" title="Make cover">★</button>` : ''}
            ${i < p.images.length - 1 ? `<button type="button" data-mv="${i}" data-d="1" title="Move right">›</button>` : ''}
            <button type="button" data-rmimg="${i}" title="Remove">✕</button>
          </div></div>`).join('') + `<label class="drop" id="drop">+ Add images<input type="file" accept="image/*" multiple id="fileIn"></label>`;
      $$('[data-mv]').forEach(b => b.onclick = () => { const i = +b.dataset.mv, j = i + +b.dataset.d; [p.images[i], p.images[j]] = [p.images[j], p.images[i]]; drawImgs(); });
      $$('[data-cover]').forEach(b => b.onclick = () => { const [x] = p.images.splice(+b.dataset.cover, 1); p.images.unshift(x); drawImgs(); });
      $$('[data-rmimg]').forEach(b => b.onclick = () => { p.images.splice(+b.dataset.rmimg, 1); drawImgs(); });
      const drop = $('#drop');
      const add = async files => {
        if (!files.length) return;
        drop.textContent = 'Uploading…';
        try { p.images.push(...await uploadFiles(files)); } catch (e) { toast(e.message, true); }
        drawImgs();
      };
      $('#fileIn').onchange = e => add(e.target.files);
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => { e.preventDefault(); add(e.dataTransfer.files); };
    };
    const drawIngs = () => {
      $('#ings').innerHTML = p.ingredients.map((g, i) => `<div class="ing-row">
        <input class="input" placeholder="Ingredient" value="${esc(g.name)}" data-ing="${i}" data-k="name">
        <input class="input" placeholder="What it does" value="${esc(g.note)}" data-ing="${i}" data-k="note">
        <button type="button" class="mini-btn danger" data-rming="${i}" aria-label="Remove">✕</button></div>`).join('');
      $$('[data-ing]').forEach(inp => inp.oninput = () => { p.ingredients[inp.dataset.ing][inp.dataset.k] = inp.value; });
      $$('[data-rming]').forEach(b => b.onclick = () => { p.ingredients.splice(+b.dataset.rming, 1); drawIngs(); });
    };
    const drawVars = () => {
      $('#vars').innerHTML = p.variants.map((v, i) => `<div class="var-row">
        <input class="input" placeholder="Size (e.g. 15 ml)" value="${esc(v.size)}" data-var="${i}" data-k="size">
        <input class="input" type="number" min="0" placeholder="Price" value="${esc(v.price)}" data-var="${i}" data-k="price">
        <input class="input" type="number" min="0" placeholder="Compare" value="${esc(v.comparePrice)}" data-var="${i}" data-k="comparePrice">
        <input class="input" type="number" min="0" placeholder="Stock" value="${esc(v.stock)}" data-var="${i}" data-k="stock">
        <button type="button" class="mini-btn danger" data-rmvar="${i}" aria-label="Remove">✕</button></div>`).join('');
      $$('[data-var]').forEach(inp => inp.oninput = () => { const k = inp.dataset.k, val = inp.value; p.variants[inp.dataset.var][k] = ['price', 'comparePrice', 'stock'].includes(k) ? Number(val) || 0 : val; });
      $$('[data-rmvar]').forEach(b => b.onclick = () => { p.variants.splice(+b.dataset.rmvar, 1); drawVars(); });
    };
    $('#addIng').onclick = () => { p.ingredients.push({ name: '', note: '' }); drawIngs(); };
    $('#addVar').onclick = () => { p.variants.push({ size: '', price: 0, comparePrice: 0, stock: 0 }); drawVars(); };
    drawImgs(); drawIngs(); drawVars();

    const close = () => { m.hidden = true; m.innerHTML = ''; };
    $$('[data-close]', m).forEach(b => b.onclick = close);
    m.onclick = e => { if (e.target === m) close(); };

    $('#pForm').onsubmit = async e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      const body = { ...fd, active: !!fd.active, featured: !!fd.featured, images: p.images, ingredients: p.ingredients, benefits: fd.benefits, variants: p.variants };
      try {
        await send(isNew ? '/api/admin/products' : `/api/admin/products/${p.id}`, isNew ? 'POST' : 'PUT', body);
        toast(isNew ? 'Product created' : 'Product saved');
        close();
        route();
      } catch (err) { toast(err.message, true); }
    };
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) { $('#modal').hidden = true; $('#modal').innerHTML = ''; } });

  /* ---------- chart: single series, gold bars, hover tooltip ---------- */
  function drawChart(el, days) {
    const W = 640, H = 240, pad = { l: 56, r: 8, t: 12, b: 28 };
    const max = Math.max(...days.map(d => d.revenue), 1);
    const nice = (() => { const p = 10 ** Math.floor(Math.log10(max)); return Math.ceil(max / p) * p; })();
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const slot = iw / days.length, bw = Math.min(26, slot - 6);
    const y = v => pad.t + ih - (v / nice) * ih;
    const ticks = [0, .5, 1].map(f => nice * f);
    const fmtDay = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const bar = (x, top, w, h, r) => h <= 0 ? '' : `M${x},${top + h}V${top + Math.min(r, h)}Q${x},${top} ${x + Math.min(r, h)},${top}H${x + w - Math.min(r, h)}Q${x + w},${top} ${x + w},${top + Math.min(r, h)}V${top + h}Z`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily revenue for the last 14 days">
      ${ticks.map(t => `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-label" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${money(t)}</text>`).join('')}
      ${days.map((d, i) => {
        const x = pad.l + i * slot + (slot - bw) / 2, top = y(d.revenue), h = pad.t + ih - top;
        return `<g data-i="${i}"><rect class="hit" x="${pad.l + i * slot}" y="${pad.t}" width="${slot}" height="${ih}"/><path class="bar" d="${bar(x, top, bw, h, 4)}"/>
          ${i % 2 === 1 || days.length < 8 ? `<text class="axis-label" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${fmtDay(d.date)}</text>` : ''}</g>`;
      }).join('')}
    </svg><div class="chart-tip glass glass-strong" id="tip"></div>`;
    const tip = $('#tip', el);
    $$('g[data-i]', el).forEach(g => {
      g.addEventListener('mouseenter', () => {
        const d = days[g.dataset.i];
        tip.innerHTML = `${fmtDay(d.date)}<b>${money(d.revenue)}</b>${d.orders} order${d.orders === 1 ? '' : 's'}`;
        const r = g.querySelector('.hit').getBoundingClientRect(), box = el.getBoundingClientRect();
        tip.style.left = `${r.left - box.left + r.width / 2}px`;
        tip.style.top = `${Math.max(40, $('.bar', g).getBoundingClientRect().top - box.top || ih)}px`;
        tip.style.opacity = 1;
      });
      g.addEventListener('mouseleave', () => tip.style.opacity = 0);
    });
  }

  function downloadCSV(name, rows) {
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      await api('/api/admin/me');
    } catch { return showLogin(); }
    settings = await api('/api/admin/settings').catch(() => settings);
    $('#login').hidden = true;
    $('#shell').hidden = false;
    route();
    refreshBadges();
  }
  boot();
})();
