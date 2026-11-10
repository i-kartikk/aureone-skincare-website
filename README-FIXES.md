# AUREONÉ — SEO, speed, legal & accessibility fix kit

Tested against the live site (aureone-skincare-website.vercel.app) and the GitHub repo on 10 Nov 2026.

## Status

Committed to the `seo-fixes` branch by Claude and merged after testing the Vercel preview. `server.js` and `store.js` are already patched.

## Your next steps

1. Fill in `site.config.js`: legal name, address, real phone and email, grievance officer, author bio. Blank values are hidden, never shown as placeholders.
2. In Vercel → Settings → Environment Variables add `SITE_URL` = your final domain once you have one (e.g. `https://aureone.in`), then redeploy.
3. Convert images to WebP (needs Node on your computer):
   ```bash
   git pull
   npm install -D sharp
   node scripts/optimize-images.mjs   # creates .webp next to every JPG/PNG; the server serves them automatically
   git add public/assets/img && git commit -m "Add WebP images" && git push
   ```

## What changed

| Problem found | Fix |
|---|---|
| `/robots.txt` and `/sitemap.xml` returned the homepage | Real robots.txt; sitemap with every product, category and policy page (+ image entries) |
| Every unknown URL returned 200 (soft 404) | Real 404 status + branded 404 page |
| Same title on every page; app overwrote it | Unique title + meta description per page, server and client side |
| No canonical, Open Graph, structured data | Canonical, OG/Twitter, JSON-LD: Organization, WebSite, Product (price, stock, return policy), BreadcrumbList, FAQPage |
| No H1 or text in the HTML Google first sees | Server-rendered H1, intro, breadcrumbs and product links on every page |
| Orphan products / demo pages | Every product linked from home, shop, category and sibling pages; `/demo-ritual`, `/index.html`, `/skin-care-home-copy.html` 301 → `/`; 3D iframe file noindexed |
| Checkout/account indexable | `noindex` on checkout, account, order, admin, API |
| Render-blocking 1.3 MB of JS | three.js, lucide and store.js deferred |
| `max-age=0` on all assets | Assets cached for a day + background revalidation |
| 11 MB JPG/PNG | WebP twins served automatically to supporting browsers |
| Layout shift | Image aspect-ratio reserved |
| No legal pages | Privacy, Terms, Cookie, Refund & Returns, Shipping pages + FAQ, linked from every footer |
| No consent / data notice | Cookie notice (necessary-only by default), "Cookie settings" footer link, privacy notice under every form |
| Gold text and buttons failed WCAG contrast | Fixed; re-scanned live — every text element passes AA |
| Phone not clickable, placeholder contact details | `tel:`/`mailto:` links from config; placeholders removed from footer |
| Toasts not announced | `role="status"` + `aria-live` |
| No SVG favicon | `favicon.svg` added (monogram PNG kept as Apple touch icon) |

Already fine before: mobile menu, success/error messages on forms, form labels, copyright year, no desktop horizontal scroll.

## Things only you can do

- **Change the phone number in Admin → Settings.** `+91 98765 43210` is a placeholder and it's live. Also fix the Instagram/Facebook URLs (they point to the bare sites) and the email.
- **Re-upload Lumière C's image.** Its file was stored on Vercel's temporary disk and is gone (404). For future uploads use Vercel Blob or put images in `public/assets/img`. Admin product edits saved to disk on Vercel can vanish the same way — check `VERCEL_POSTGRES.md` is actually in use.
- **Reviews.** The three 5-star reviews are seeded, and the admin panel can post reviews under any name. Show only reviews from real customers, or remove them. Don't add star ratings to structured data until reviews come from verified orders.
- **Claims.** "SPF 50 PA++++" needs a test report you can produce on request. "The ritual behind healthy skin" is fine; avoid words like heal, cure, treat acne, or "clinically proven" without studies.
- **Images.** Confirm you own or licensed every photo and mockup.
- **Copy.** Rewrite product and About text in your own voice with specifics only you know (sourcing, who formulated it, how it's made). That's what "remove AI content" means in practice — Google cares whether content is useful and original, not how it was drafted.
- **Author bio.** Fill `author` in `site.config.js` with a real person and real credentials.
- **Legal review.** These pages are a sound starting template, not legal advice. India's DPDP Rules' core notice and consent duties apply from 13 May 2027; get a lawyer to review before then.
- **Tailwind CDN.** The homepage still loads Tailwind's in-browser compiler, which Tailwind says not to use in production. Next step for speed: compile it with the Tailwind CLI into a static CSS file.

## Google Search Console (you need to be signed in, so this one is yours)

1. Go to search.google.com/search-console → Add property → **Domain** (or URL prefix with your Vercel URL).
2. Verify with the DNS TXT record (Domain) or the HTML tag method.
3. Sitemaps → enter `sitemap.xml` → Submit.
4. URL Inspection → paste your homepage → **Request indexing**. Repeat for each product page.
5. Check Pages → "Why pages aren't indexed" after 3–7 days.

## About "#1 by Friday" and the Forbes backlink

Nobody can guarantee rankings or a date, and paid or arranged links from big publishers break Google's spam policies. Realistic path: indexing within days of submitting, ranking first for your brand name within weeks, then earning links by getting real coverage — send samples to Indian beauty writers and bloggers, list on Nykaa/Amazon with a link back, and get a Google Business Profile if you have an address.
