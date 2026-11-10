/**
 * AUREONÉ — single source of truth for business + SEO details.
 * Every legal page, footer, JSON-LD block and meta tag reads from here.
 *
 * ⚠️  FILL IN every value marked REQUIRED before going live.
 *     Empty values are simply hidden on the site (never shown as placeholder text),
 *     and `npm start` prints a warning listing anything still missing.
 */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://aureone-skincare-website.vercel.app', // REQUIRED: your final domain, no trailing slash
  brandName: 'AUREONÉ',
  tagline: 'The Art of Radiance',
  defaultDescription:
    'AUREONÉ skincare made in India: a gentle cleanser, niacinamide and vitamin C serums, a barrier moisturiser and SPF. Shop the five-step ritual.',
  defaultOgImage: '/assets/img/hero-ritual-bottles.jpg',
  locale: 'en_IN',
  currency: 'INR',

  // ---- Legal entity (Consumer Protection (E-Commerce) Rules, 2020 require these to be displayed) ----
  legalName: '',          // REQUIRED e.g. "Aureone Beauty Private Limited"
  gstin: '',              // REQUIRED if GST-registered
  cin: '',                // if a company
  registeredAddress: '',  // REQUIRED full postal address
  city: 'Mumbai',
  region: 'Maharashtra',
  postalCode: '',
  country: 'IN',

  // ---- Contact (replace the placeholder phone that is live today: +91 98765 43210) ----
  email: '',              // REQUIRED, a mailbox you actually own
  phone: '',              // REQUIRED, real number in +91XXXXXXXXXX form
  whatsapp: '',
  supportHours: 'Mon–Sat, 10:00–18:00 IST',

  // ---- Grievance officer (E-Commerce Rules 2020 + DPDP Act 2023) ----
  grievanceOfficer: { name: '', designation: 'Grievance Officer', email: '', phone: '' }, // REQUIRED

  // ---- Socials: leave '' to hide. Today they point at instagram.com/ and facebook.com/ root pages ----
  instagram: '',
  facebook: '',

  // ---- Author / founder bio (E-E-A-T). Only real people, real credentials. ----
  author: {
    name: '',             // REQUIRED for the author box to show
    role: '',             // e.g. "Founder & formulator"
    bio: '',              // 2–3 factual sentences in your own words
    credentials: '',      // e.g. "M.Pharm (Cosmetic Science)" — only if true
    image: '',            // a photo you own, e.g. /assets/img/founder.webp
    sameAs: []            // LinkedIn etc.
  },

  // ---- Policy terms (edit to match how you actually operate) ----
  policy: {
    effectiveDate: '10 November 2026',
    returnWindowDays: 7,
    refundProcessingDays: 7,
    dispatchDays: '1–2 business days',
    deliveryDays: '3–7 business days',
    // Shipping fee + free-shipping threshold are read live from Admin → Settings.
    paymentMethods: 'Cash on Delivery', // update when you add online payments (and name the gateway)
    hostingPartners: 'Vercel (hosting) and Neon (database)'
  }
};
