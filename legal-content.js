/**
 * Legal pages + FAQ, rendered on the server (fully crawlable, no JS needed).
 * Content is a sound starting template for a small Indian D2C skincare brand.
 * It is NOT legal advice — have a lawyer review it before launch.
 */
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = v => v !== undefined && v !== null && String(v).trim() !== '';

function contactBlock(cfg) {
  const rows = [];
  if (has(cfg.legalName)) rows.push(`<strong>${esc(cfg.legalName)}</strong>`);
  if (has(cfg.registeredAddress)) rows.push(esc(cfg.registeredAddress));
  if (has(cfg.email)) rows.push(`Email: <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>`);
  if (has(cfg.phone)) rows.push(`Phone: <a href="tel:${esc(cfg.phone.replace(/[^\d+]/g, ''))}">${esc(cfg.phone)}</a>`);
  if (has(cfg.gstin)) rows.push(`GSTIN: ${esc(cfg.gstin)}`);
  return rows.length ? `<p>${rows.join('<br>')}</p>` : '';
}

function grievanceBlock(cfg) {
  const g = cfg.grievanceOfficer || {};
  if (!has(g.name)) return '';
  return `<h2 id="grievance">Grievance officer</h2>
<p>${esc(g.name)}, ${esc(g.designation || 'Grievance Officer')}<br>
${has(g.email) ? `Email: <a href="mailto:${esc(g.email)}">${esc(g.email)}</a><br>` : ''}
${has(g.phone) ? `Phone: <a href="tel:${esc(g.phone.replace(/[^\d+]/g, ''))}">${esc(g.phone)}</a><br>` : ''}
We acknowledge complaints within 48 hours and aim to resolve them within one month of receipt.</p>`;
}

const pages = {
  'privacy-policy': (cfg, settings) => ({
    title: 'Privacy Policy',
    description: `How ${cfg.brandName} collects, uses and protects your personal data, and how to exercise your rights.`,
    body: `
<p>Effective ${esc(cfg.policy.effectiveDate)}. This policy explains what personal data ${esc(cfg.legalName || cfg.brandName)} (“we”) collects through this website, why, and the choices you have. We process personal data in line with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.</p>

<h2 id="what-we-collect">What data we collect</h2>
<table class="legal-table"><thead><tr><th>When</th><th>Data</th><th>Why</th></tr></thead><tbody>
<tr><td>You place an order</td><td>Name, phone, email, delivery address, order contents, optional order note</td><td>To deliver your order, collect Cash on Delivery payment, send order updates and meet tax/accounting duties</td></tr>
<tr><td>You create an account</td><td>Name, email, password (stored only as a salted hash)</td><td>To let you sign in and see your order history</td></tr>
<tr><td>You use the contact form</td><td>Name, email, subject, message</td><td>To reply to you</td></tr>
<tr><td>You join the newsletter</td><td>Email address</td><td>To send product news and offers — only with your consent, and you can unsubscribe any time</td></tr>
<tr><td>You browse the site</td><td>Bag contents (stored in your own browser), a sign-in cookie if you log in, and standard server logs (IP address, browser, pages requested)</td><td>To keep the site working and secure</td></tr>
</tbody></table>
<p>We do not currently use advertising or analytics trackers. We never sell your personal data.</p>

<h2 id="who-we-share-with">Who we share it with</h2>
<p>Only service providers who help us run the shop, under contract and only for that purpose: ${esc(cfg.policy.hostingPartners)}, our courier partners (name, phone and address for delivery), and our email provider. Fonts are loaded from Google Fonts, which means your browser sends your IP address to Google when the page loads. We disclose data to authorities only where Indian law requires it.</p>

<h2 id="retention">How long we keep it</h2>
<p>Order and invoice records: as long as tax law requires (generally 8 years). Account data: until you delete your account. Contact messages: up to 2 years. Newsletter email: until you unsubscribe.</p>

<h2 id="your-rights">Your rights</h2>
<p>You can ask us to access, correct, update or erase your personal data, withdraw consent you have given (for example to the newsletter), and nominate another person to exercise your rights. Write to ${has(cfg.email) ? `<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>` : 'us using the contact page'}. If you are not satisfied with our response, you may complain to the Data Protection Board of India.</p>

<h2 id="security">Security</h2>
<p>Data is transmitted over HTTPS, passwords are hashed, and admin access is restricted. No system is perfectly secure; if a breach affects you we will tell you without delay.</p>

<h2 id="children">Children</h2>
<p>This shop is meant for adults. We do not knowingly collect data from anyone under 18.</p>

${grievanceBlock(cfg)}
<h2 id="contact">Contact</h2>
${contactBlock(cfg)}
<p>See also our <a href="/cookie-policy">Cookie Policy</a>.</p>`
  }),

  'cookie-policy': (cfg) => ({
    title: 'Cookie Policy',
    description: `The cookies and browser storage ${cfg.brandName} uses, and how to control them.`,
    body: `
<p>Effective ${esc(cfg.policy.effectiveDate)}.</p>
<h2 id="what-we-use">What we use</h2>
<table class="legal-table"><thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Duration</th></tr></thead><tbody>
<tr><td>Sign-in session</td><td>Cookie (HttpOnly), strictly necessary</td><td>Keeps you signed in to your account or the admin panel</td><td>Up to 7 days</td></tr>
<tr><td><code>aureone_bag</code></td><td>Browser local storage, strictly necessary</td><td>Remembers the items in your bag</td><td>Until you clear it</td></tr>
<tr><td><code>aureone_consent</code></td><td>Browser local storage, strictly necessary</td><td>Remembers your cookie choice</td><td>12 months</td></tr>
</tbody></table>
<p>We do not use analytics or advertising cookies today. If we add them, they will stay off until you opt in through the cookie banner.</p>
<h2 id="third-parties">Third-party content</h2>
<p>Fonts are served by Google Fonts. Google may receive your IP address and browser details when fonts load. See Google's privacy policy for details.</p>
<h2 id="control">How to control cookies</h2>
<p>You can change your choice any time with the “Cookie settings” link in the footer, or delete cookies and site data in your browser settings. Blocking strictly necessary storage will stop sign-in and the bag from working.</p>`
  }),

  'terms-and-conditions': (cfg, settings) => ({
    title: 'Terms & Conditions',
    description: `Terms for buying from ${cfg.brandName}: orders, pricing, payment, delivery, returns, product use and liability.`,
    body: `
<p>Effective ${esc(cfg.policy.effectiveDate)}. By using this website or placing an order you agree to these terms. The seller is ${esc(cfg.legalName || cfg.brandName)}${has(cfg.registeredAddress) ? `, ${esc(cfg.registeredAddress)}` : ''}.</p>
<h2 id="orders">Orders</h2>
<p>An order is an offer to buy. It is accepted when we dispatch it. We may cancel an order (with a full refund of anything paid) if an item is out of stock, a price was shown in error, or we suspect fraud.</p>
<h2 id="prices">Prices and payment</h2>
<p>Prices are in Indian Rupees and include GST. Shipping charges, if any, are shown before you confirm. We currently accept ${esc(cfg.policy.paymentMethods)}.</p>
<h2 id="delivery">Delivery</h2>
<p>See our <a href="/shipping-policy">Shipping Policy</a>.</p>
<h2 id="returns">Returns and refunds</h2>
<p>See our <a href="/refund-policy">Refund &amp; Returns Policy</a>.</p>
<h2 id="product-use">Using our products</h2>
<p>Our products are cosmetics, not medicines. They are not intended to diagnose, treat or cure any condition. Patch-test before first use, read the full ingredient list on the pack, and stop use if irritation occurs. Product images are for illustration; the pack you receive may vary slightly.</p>
<h2 id="reviews">Reviews</h2>
<p>Reviews must be honest and about your own experience. We do not pay for reviews or edit their meaning, and we may remove reviews that are abusive, unlawful or unrelated to the product.</p>
<h2 id="ip">Intellectual property</h2>
<p>All content on this site belongs to us or our licensors. You may not copy it for commercial use without written permission.</p>
<h2 id="liability">Liability</h2>
<p>Nothing in these terms limits your rights under the Consumer Protection Act, 2019. Otherwise, our liability for any order is limited to the amount you paid for it.</p>
<h2 id="law">Governing law</h2>
<p>These terms are governed by the laws of India. Courts at ${esc(cfg.city || 'our registered office')} have jurisdiction, without affecting your right to approach a consumer commission.</p>
${grievanceBlock(cfg)}
<h2 id="contact">Contact</h2>
${contactBlock(cfg)}`
  }),

  'refund-policy': (cfg) => ({
    title: 'Refund & Returns Policy',
    description: `How returns, replacements and refunds work at ${cfg.brandName}.`,
    body: `
<p>Effective ${esc(cfg.policy.effectiveDate)}.</p>
<h2 id="eligible">What can be returned</h2>
<p>For hygiene reasons we accept returns of <strong>unopened, sealed</strong> products within ${cfg.policy.returnWindowDays} days of delivery. We replace or refund items that arrive <strong>damaged, leaking, expired or incorrect</strong> — tell us within ${cfg.policy.returnWindowDays} days with a photo of the product and outer box.</p>
<h2 id="not-eligible">What cannot be returned</h2>
<p>Opened or used products (unless faulty), items bought on final sale where this was clearly stated before purchase, and free gifts.</p>
<h2 id="how">How to start a return</h2>
<p>Email ${has(cfg.email) ? `<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>` : 'us via the contact page'} with your order number. We will arrange a pickup where available or share the return address.</p>
<h2 id="refunds">Refunds</h2>
<p>Once the return is received and checked, we refund within ${cfg.policy.refundProcessingDays} business days. Cash on Delivery orders are refunded by bank transfer or UPI to an account you nominate. Original shipping charges are refunded only if the item was faulty or incorrect.</p>
<h2 id="cancellations">Cancellations</h2>
<p>You can cancel free of charge any time before the order is dispatched.</p>
${grievanceBlock(cfg)}`
  }),

  'shipping-policy': (cfg, settings) => {
    const cur = (settings && settings.currency) || '₹';
    const free = settings && Number(settings.freeShippingThreshold);
    const fee = settings && Number(settings.shippingFee);
    return {
      title: 'Shipping Policy',
      description: `Delivery times, charges and tracking for ${cfg.brandName} orders across India.`,
      body: `
<p>Effective ${esc(cfg.policy.effectiveDate)}.</p>
<h2 id="where">Where we ship</h2><p>Across India, to all serviceable PIN codes.</p>
<h2 id="when">When it arrives</h2><p>Orders are dispatched within ${esc(cfg.policy.dispatchDays)} and usually delivered within ${esc(cfg.policy.deliveryDays)} after dispatch. Remote areas can take longer.</p>
<h2 id="cost">What it costs</h2>
<p>${free ? `Shipping is free on orders above ${cur}${free}. ` : ''}${fee ? `Below that, a flat fee of ${cur}${fee} applies. ` : ''}The exact charge is always shown before you confirm your order.</p>
<h2 id="tracking">Tracking</h2><p>We send tracking details by email or SMS once your order ships.</p>
<h2 id="issues">Problems with delivery</h2><p>If your parcel is late, damaged or missing, contact us within ${cfg.policy.returnWindowDays} days of the expected delivery date. See the <a href="/refund-policy">Refund &amp; Returns Policy</a>.</p>`
    };
  }
};

/* ---------- FAQ (shown on /faq and emitted as FAQPage schema) ---------- */
function faqItems(cfg, settings) {
  const cur = (settings && settings.currency) || '₹';
  const free = settings && Number(settings.freeShippingThreshold);
  return [
    { q: 'Are AUREONÉ products suitable for sensitive skin?', a: 'Each product page lists the skin types it is formulated for and its full ingredient list. If your skin is sensitive, patch-test on the inner arm for 24 hours before first use, and speak to a dermatologist if you have a skin condition.' },
    { q: 'In what order should I use the products?', a: 'Cleanse, then apply serum, moisturise, and finish with sunscreen in the morning. At night, skip the sunscreen.' },
    { q: 'How long does delivery take?', a: `Orders are dispatched within ${cfg.policy.dispatchDays} and usually arrive within ${cfg.policy.deliveryDays} after dispatch.${free ? ` Shipping is free above ${cur}${free}.` : ''}` },
    { q: 'Which payment methods do you accept?', a: `We currently accept ${cfg.policy.paymentMethods}.` },
    { q: 'Can I return a product?', a: `Unopened products can be returned within ${cfg.policy.returnWindowDays} days of delivery. Damaged, leaking or incorrect items are replaced or refunded. See the Refund & Returns Policy for details.` },
    { q: 'Are your products tested on animals?', a: 'Answer this only with what you can document (e.g. supplier declarations). Remove this question until you can.', draft: true },
  ].filter(i => !i.draft);
}

function faqPage(cfg, settings) {
  const items = faqItems(cfg, settings);
  return {
    title: 'Frequently Asked Questions',
    description: `Answers on routines, skin types, delivery, payment and returns at ${cfg.brandName}.`,
    items,
    body: items.map(i => `<h2>${esc(i.q)}</h2><p>${esc(i.a)}</p>`).join('\n') +
      `<p>Still have a question? <a href="/contact">Contact us</a>.</p>`
  };
}

module.exports = { pages, faqItems, faqPage, esc, has };
