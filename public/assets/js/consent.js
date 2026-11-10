/* AUREONÉ — cookie notice, consent store, form privacy notices, a11y helpers.
   window.aureoneConsent.has('analytics') → false until the visitor opts in.
   Load any future analytics/ads ONLY inside aureoneConsent.onChange(c => c.analytics && ...). */
/* Save server-rendered legal/FAQ content before the shop app replaces #app with its loader */
(function () {
  var el = document.querySelector('#app [data-ssr-static]');
  if (el) window.__AUREONE_STATIC__ = { path: location.pathname.replace(/\/$/, ''), html: el.outerHTML };
})();

(function () {
  var KEY = 'aureone_consent', listeners = [];
  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && Date.now() - v.t < 365 * 864e5) return v; } catch (e) {} return null; }
  function save(analytics) {
    var v = { necessary: true, analytics: !!analytics, t: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
    listeners.forEach(function (fn) { fn(v); });
    close();
  }
  window.aureoneConsent = {
    has: function (k) { var v = read(); return !!(v && v[k]); },
    onChange: function (fn) { listeners.push(fn); var v = read(); if (v) fn(v); },
    open: open
  };

  var el;
  function open() {
    if (el) return;
    el = document.createElement('section');
    el.className = 'consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'consent-title');
    el.innerHTML =
      '<h2 id="consent-title">Cookies on this site</h2>' +
      '<p>We only use what the shop needs to work: your bag and, if you sign in, a session cookie. Fonts load from Google. ' +
      'We don’t use analytics or ads. <a href="/cookie-policy">Cookie policy</a></p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="consent-btn" data-c="reject">Necessary only</button>' +
      '<button type="button" class="consent-btn consent-btn--primary" data-c="accept">Accept all</button></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]'); if (!b) return;
      save(b.getAttribute('data-c') === 'accept');
    });
  }
  function close() { if (el) { el.remove(); el = null; } }

  var PHONE = /(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;
  function enhance() {
    /* Privacy notice placed BELOW each form that collects personal data (never inside its flex row) */
    document.querySelectorAll('form').forEach(function (f) {
      var next = f.nextElementSibling;
      if (next && next.classList.contains('form-privacy')) return;
      if (!f.querySelector('input[type=email], input[name=email], input[name=phone], input[type=tel]')) return;
      var fields = Array.prototype.filter.call(f.querySelectorAll('input, textarea, select'), function (i) {
        return ['hidden', 'submit', 'button', 'checkbox', 'radio'].indexOf(i.type) === -1;
      });
      var isNews = fields.length === 1;
      var isOrder = !!f.querySelector('[name*=address], [name*=pin], [name*=city]');
      var p = document.createElement('p');
      p.className = 'form-privacy';
      p.innerHTML = isNews
        ? 'By subscribing you agree to receive emails from AUREONÉ. Unsubscribe anytime. <a href="/privacy-policy">Privacy Policy</a>'
        : isOrder
          ? 'We use these details only to deliver your order. <a href="/privacy-policy">Privacy Policy</a>'
          : 'We use these details only to reply to you. <a href="/privacy-policy">Privacy Policy</a>';
      var par = f.parentElement, pr = par.getBoundingClientRect(), fr = f.getBoundingClientRect();
      var centered = getComputedStyle(par).textAlign === 'center' ||
        (Math.abs((fr.left - pr.left) - (pr.right - fr.right)) < 6 && fr.width < pr.width - 20);
      if (centered) p.classList.add('is-center');
      f.insertAdjacentElement('afterend', p);
    });
    /* Make phone numbers in text clickable */
    document.querySelectorAll('#app p, #app span, #app li, footer p, footer span').forEach(function (n) {
      if (n.dataset.telDone || n.closest('a') || n.children.length) return;
      PHONE.lastIndex = 0;
      if (!PHONE.test(n.textContent)) return;
      n.dataset.telDone = '1';
      var safe = n.textContent.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
      n.innerHTML = safe.replace(PHONE, function (m) { return '<a href="tel:' + m.replace(/[^\d+]/g, '') + '">' + m + '</a>'; });
    });
    /* Toasts announced to screen readers */
    document.querySelectorAll('.toast, #toast').forEach(function (t) { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); });
  }

  function init() {
    if (!read()) open();
    document.addEventListener('click', function (e) { if (e.target.closest('[data-cookie-settings]')) { e.preventDefault(); close(); open(); } });
    enhance();
    var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(enhance, 50); })
      .observe(document.body, { childList: true, subtree: true });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
