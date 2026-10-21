---
name: Aureoné — The Daily Folio
description: A calm, product-led skincare storefront organized around a clear five-step daily ritual.
colors:
  primary: "#211D19"
  accent-gold: "#B99A60"
  gold-deep: "#755D35"
  neutral-bg: "#F8F5EF"
  surface-beige: "#EAE1D4"
  neutral-taupe: "#A99A89"
  secondary-text: "#57524C"
  card: "#FFFFFF"
typography:
  display:
    fontFamily: "Cormorant Garamond, Times New Roman, serif"
    fontSize: "clamp(54px, 6.4vw, 84px)"
    fontWeight: 400
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Montserrat, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Montserrat, Helvetica Neue, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.15em"
rounded:
  sm: "3px"
  md: "4px"
  lg: "16px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.sm}"
    padding: "0 10px 0 24px"
    height: "54px"
  button-primary-hover:
    backgroundColor: "{colors.accent-gold}"
    textColor: "{colors.primary}"
---

## Overview

Aureoné presents a gentle daily skincare ritual as a practical, shoppable sequence. The homepage's Daily Folio pairs one clear shop action with the five real stages—Clear, Refine, Glow, Nourish, Protect—and their matching products. Keep the interface calm and editorial: warm paper-like surfaces, precise product photography, and restrained gold details.

Preserve the existing catalog, product facts, prices, navigation, bag, account, and checkout behavior. Do not introduce new efficacy claims or change product content to support a visual concept.

## Colors

- **Primary:** Soft Black `#211D19` for headings, body emphasis, and primary actions.
- **Accent:** Champagne Gold `#B99A60` for small highlights, fine rules, and interactive emphasis; darker gold `#755D35` is reserved for readable small text and focus indicators.
- **Background:** Warm Ivory `#F8F5EF` is the default page surface.
- **Secondary surface:** Light Beige `#EAE1D4` separates calm editorial regions.
- **Supporting neutrals:** Muted Taupe `#A99A89` is for fine decorative details; secondary text `#57524C` is for small reading copy.
- **Cards:** White `#FFFFFF` is reserved for product and content surfaces.

Use the darker secondary text for small copy; keep gold sparing and avoid using Champagne Gold as small text on Warm Ivory.

## Typography

**Display Font:** Cormorant Garamond (with Times New Roman, serif)  
**Body Font:** Montserrat (with Helvetica Neue, Arial, sans-serif)

The serif display voice is quiet and editorial; the geometric sans-serif keeps product details and controls easy to scan. Both families load from Google Fonts with `display=swap`.

- **Display** (400, `clamp(54px, 6.4vw, 84px)`, 0.96 line-height): homepage hero; mobile size is adjusted at the narrow breakpoint.
- **Headline** (400, fluid 36–60px, near 1.02 line-height): section titles.
- **Title** (500, 18–26px): product and routine names.
- **Body** (400, 14px, 1.6 global line-height): explanatory and product copy.
- **Label** (500, 9–11px, tracked uppercase): navigation, step numbers, and short metadata.

## Layout

The homepage leads with the hero and five-stage Folio, then the five-step image routine, bestsellers, the existing 3D showcase, and the remaining brand, trust, testimonial, and conversion sections. Use a centered, fluid content width with generous section spacing; the hero pairs copy and imagery on wide screens and stacks them on narrow screens.

The routine imagery uses `object-fit: contain` so product packaging remains fully visible. Routine cards reflow from three columns at tablet widths to two columns on mobile. The hero layout stacks below 700px, with a tighter adjustment below 380px. Check the rendered page at 375, 768, 1024, and 1440px.

## Elevation & Depth

Use a hybrid of tonal layering, a fine border, and soft offset shadows. Keep product cards mostly flat at rest; reserve stronger, diffuse depth for the hero image and a subtle lift for hover or focus. Avoid heavy blur and persistent decorative shadows.

## Shapes

The Folio and primary action use crisp 3–4px corners. Broader site surfaces may use the existing 8–24px radius scale; compact chips may be pill-shaped. Prefer fine borders and uncluttered rectangular image frames over nested rounded cards.

## Components

### Primary action

- **Shape:** restrained 3px corner.
- **Primary:** Soft Black surface, Warm Ivory text, 54px minimum height, compact tracked uppercase label.
- **Hover / Focus:** Champagne Gold surface with Soft Black text, a darker-gold visible focus outline, brief lift and a single narrow sheen on the homepage's primary CTA. Respect reduced-motion preferences.
- Keep the “Discover every formula” Folio link visually secondary to “Shop the Ritual.”

### Routine step

- Pair the complete product image with a short step number and stage name.
- Link each step to its matching existing product when available.
- Keep all five stages in the user-confirmed order: Clear, Refine, Glow, Nourish, Protect.

### Product card

- Use a white card with a fine neutral border and contained product photography on a Light Beige surface.
- Keep product name, category, price, and add-to-bag action legible and preserve existing commerce behavior.

### Navigation and forms

- Keep the desktop header quiet and compact; retain the existing mobile navigation and quick actions.
- Inputs use white surfaces, a fine neutral border, and a visible gold-tinted focus treatment.

## Do's and Don'ts

### Do:
- **Do** keep the five-stage sequence and each stage's existing product destination intact.
- **Do** use the five specified brand colors consistently and reserve gold for accents.
- **Do** use complete, uncropped product images in routine and product cards.
- **Do** preserve keyboard focus, reduced-motion behavior, and the existing shopping flows.

### Don't:
- **Don't** add unsupported skincare, clinical, ingredient, review, or customer claims.
- **Don't** promote a secondary text link to the same visual weight as the primary action.
- **Don't** crop product packaging or introduce neon colors, pink/purple gradients, or glass effects as decoration.
