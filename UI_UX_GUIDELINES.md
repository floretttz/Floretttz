# FLORETTTZ UI/UX Guidelines

## Brand foundation

- **Brand Name**: Always spelled **Floretttz** in user-facing sentences and descriptions, and **FLORETTTZ** where uppercase branding or headings are appropriate.
- **Logo Asset**: The official emblem is stored at `public/brand/floretttz-handmade-floral-badge.png` (with legacy fallback alias `public/brand/floretz-handmade-floral-badge.png`). In the header, it is rendered in a circular container with `object-fit: cover` and preserved aspect ratio. The emblem artwork visually renders "FLORETTTZ" (with three Ts) and "HANDMADE GIFTS, BLOOMS & MORE".
- **Palette tokens**:
  - Warm ivory: `#FFF9F4` (background & card contrast)
  - Blush pink: `#F3C7D3` (subtle badges, accents, selection highlight)
  - Dusty rose: `#C97E96` (decorative accents, secondary tags)
  - Muted sage: `#A8B6A0` (category icons, soft background tints)
  - Forest green: `#29483B` (primary brand color, buttons, display headings, focus rings)
  - Warm gold: `#C5A46D` (subtle details, metallic warmth)
  - Dark text: `#302A2C` (high-contrast, readable body copy)
- **Typography**:
  - Display Headings: High-contrast serif (`Georgia, Cambria, "Times New Roman", serif`) for warm, artisanal elegance.
  - Body & UI: Clean, legible system sans-serif (`Arial, Helvetica, sans-serif`) for product titles, prices, forms, tables, and navigation.

## Layout and composition

- Container: Max-width 1200px (`container-page`), centered margin.
- Gutters: 16px on mobile (320–430px), 24px on tablet (768–1024px), 32–40px on desktop (1280–1920px).
- Spacing: 8px grid increments (py-8, py-10, py-14, gap-3, gap-7).
- Radii: 10–14px on product cards, 8px on buttons and form inputs, circular pills for category filters.
- Elevation: Subtle, clean shadows (`shadow-[0_3px_12px_rgb(48_42_44_/_0.04)]`) with slight hover lift (`hover:-translate-y-0.5`).

## Commerce & storefront patterns

- **Product Cards**: Consistent aspect ratios, category eyebrow in forest green, clear product title, formatted INR price (`₹`), variant indicator (e.g. "Two options available"), and an accessible circle view button.
- **Product Visuals**:
  - Uploaded photography: Rendered with smooth cover fitting.
  - Unphotographed items: Rendered with intentional brand pastel tones, decorative arches, sparkles icon, and explicit "Photo pending" badge. Never substituted with misleading stock imagery.
- **Product Details (`/products/[slug]`)**:
  - Prominent price display and variant selection (e.g. Classic vs Premium).
  - Optional customisation note (up to 280 characters) for personalised pieces.
  - Quantity selector (1–20) with large tap targets.
  - Clear WhatsApp inquiry action and "About this piece" description.
- **Cart & WhatsApp Flow (`/cart`)**:
  - Responsive two-column layout on desktop; single-column on mobile.
  - Item listing with quantity decrement/increment/remove controls.
  - Prominent note that server derives final totals and payment is arranged on WhatsApp.
  - Automatic account association for authenticated users.

## WhatsApp community integration

- **Top Announcement Strip (`components/community-banner.tsx`)**: Permanent strip in deep emerald (`#223D32`) at the very top of all pages. Responsive: renders compact `Community: [Group] · [Channel]` on small viewports (<640px) and full labels on desktop.
- **Hero Community Card (`app/page.tsx`)**: Featured prominently above the fold with distinct, high-contrast action buttons:
  - *Join WhatsApp Group*: Connect with fellow enthusiasts and discuss custom requests (`https://chat.whatsapp.com/HQAdFVG6arGFh77oRGZsQk?s=cl&p=a&mlu=4&ilr=4`).
  - *Follow WhatsApp Channel*: Low-noise broadcasts for catalog drops and festive preorders (`https://whatsapp.com/channel/0029Vb9L4MLG3R3Zpsx31l1U`).
- **Floating Community Modal (`components/whatsapp-floating-community.tsx`)**: Unobtrusive floating badge at bottom-right (`bottom-5 right-5`) with emerald gradient. Clicking opens a compact modal with distinct Group and Channel cards. Features `Escape` key support, click-outside dismissal, safe-area inset awareness (`env(safe-area-inset-bottom)`), and zero obstruction of cart checkout buttons.
- **Mobile Menu & Footer**: Direct links in mobile hamburger drawer and permanent site-wide footer.
- **Link Security**: All external community links maintain `target="_blank"` and `rel="noopener noreferrer"`.

## India-only phone formatting & customer entry

- **Fixed Prefix**: User is never asked for a country code. Display a fixed, non-editable `🇮🇳 +91` prefix badge beside the input.
- **Input Restrictions**: Accept exactly 10 digits after removing permitted spaces, hyphens, and separators (`^[6-9]\d{9}$`). Rejects inputs starting with 1–5, double country codes, or text.
- **Helper & Placeholder**:
  - Placeholder: `9876543210`
  - Helper text: `Enter your 10-digit Indian mobile number.`
  - Dynamic status: Displays live progress e.g. `Please enter all 10 digits (X/10 entered).`
- **Customer Entry Flow**: Simple fields (Full Name, Indian Mobile with fixed `+91`, optional Email). No forced password creation, email verification, or phone OTP required for guest checkout.
- **E.164 Normalization**: Automatically normalized to `+919876543210` upon form submission on frontend and backend.

## Responsive design & accessibility standards (11 Viewports)

- **Mandatory Viewports Audited**:
  - Small Mobile: `320px` (iPhone SE/5 legacy), `375px` (iPhone SE 2/3), `390px` (iPhone 12/13/14), `430px` (iPhone 14/15 Pro Max).
  - Tablet: `600px` (Small tablets/foldables), `768px` (iPad Mini/Air portrait), `820px` (iPad Air 5).
  - Desktop & Large Displays: `1024px` (iPad Pro / small laptop), `1280px` (standard desktop), `1440px` (MacBook Pro / QHD), `1920px` (Full HD desktop).
- **Zero Horizontal Overflow**: All pages and containers maintain `overflow-x: hidden` safety and fluid width (`min(1200px, calc(100% - 32px))`) to eliminate viewport clipping.
- **Zero Search Bar Overlap**: Search input and submit button are strictly decoupled geometrically. At small viewports (<640px), search bars expand fluidly to full width with stacked or non-overlapping submit buttons.
- **Touch Target Sizing**: All interactive buttons, steppers, and inputs provide a minimum 44px tap target height (`min-h-[44px]`).
- **Catalogue Admin Touch UX**: Price fields and variant controls include accessible touch `+` and `-` stepper buttons and stacked mobile forms.
- **Accessibility & Focus Rings**:
  - All interactive elements feature a visible `3px solid #29483B` focus outline with `outline-offset: 3px`.
  - Icon buttons include descriptive `aria-label` or `<span className="sr-only">`.
  - Color is never the sole cue for state or validation errors.
  - Full adherence to `prefers-reduced-motion`.

## Prohibited patterns

- No generic AI-landing-page aesthetics (oversized glowing gradient spheres, glassmorphism blur cards, floating random blobs).
- No fabricated customer reviews, fake discount countdowns, or artificial stock counters.
- No misleading stock photos representing handmade inventory.
- No fake payment confirmations or pretend credit card forms.
