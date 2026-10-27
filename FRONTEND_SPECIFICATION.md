# FLORETTTZ Frontend Specification

## Non-negotiable visual rule

**FLORETTTZ must look like a genuine, professionally designed e-commerce store. It must not look like a generic AI-generated landing page, dashboard template, or repetitive UI kit.**

The interface prioritizes intuitive discovery, persistent search, scannable product cards, transparent pricing, variant selection, and a smooth WhatsApp order handoff.

## Routes and workflows

| Route | Purpose | State / Verification |
| --- | --- | --- |
| `/` | Brand editorial header, category discovery pills, featured items, dedicated WhatsApp Community section, and WhatsApp advisory banner. | Static prerendered (`○`), responsive, verified. |
| `/shop` | Search bar, category filter pills, sort options (newest, price_asc, price_desc), responsive product grid, pagination. | Dynamic server-rendered (`ƒ`), verified. |
| `/products/[slug]` | Product imagery / handcrafted visual, price, variant selectors (e.g. Classic/Premium), quantity controls, personalisation notes, 'About this piece', and WhatsApp inquiry link. | Dynamic server-rendered (`ƒ`), verified. |
| `/cart` | Interactive item list, quantity controls (+ / - / remove), subtotal, guest or authenticated customer details form, server validation, and formatted WhatsApp handoff link. | Client interactive with SSR fallback (`○`), verified. |
| `/login`, `/register` | Supabase Auth login, registration, and password recovery. Shows clear guidance when Supabase is not yet configured. | Static prerendered (`○`), verified. |
| `/account` | Authenticated profile and customer order history fetched securely from `/api/orders/me`. | Client interactive (`○`), verified. |
| `/admin` | Complete role-protected workspace: Overview KPI metrics, Products & Variants management (CRUD), Order request management with status transitions, Categories management, Notion integration status card, and Store settings. | Client interactive (`○`), 13.3 kB bundle, verified. |
| `/_not-found` | Branded 404 page ("This little bloom isn't here") with clear return to catalogue. | Static prerendered (`○`), verified. |
| `/icon.svg` | Branded vector SVG favicon emblem in Forest Green, Blush Pink, and Gold. | Static asset (`○`), 0 bytes runtime overhead, verified. |

## Responsive and accessibility behavior

- **Mobile (320px, 375px, 430px)**: Single-line utility header with circular floral badge, accessible hamburger drawer, two-column product card grid, full-width actions, and minimum 44px touch targets. Zero horizontal overflow across all tested viewports.
- **Tablet (768px, 1024px)**: 3-column product grid, wrapped filter pills, side-by-side cart and summary panel.
- **Desktop (1280px, 1440px, 1920px)**: Centered 1200px container, 4-column product grid, expanded desktop navigation, inline header search, and side-by-side product detail layout.
- **Accessibility**: Semantic HTML5 tags (`<main>`, `<nav>`, `<article>`, `<header>`, `<footer>`), visible 3px forest green focus rings (`#29483B`), `aria-label` attributes on icon controls, persistent single `<h1>` across all route states, and full adherence to `prefers-reduced-motion`.

## Components and integration

- `SiteHeader`: Accessible navigation, brand badge, inline search on desktop, mobile slide-out drawer, cart item count badge, account link. Displays brand mark `FLORETTTZ`.
- `SiteFooter`: Brand editorial copy, Community section with direct "Join Our WhatsApp Group" and "Follow Our WhatsApp Channel" buttons, shop navigation, and copyright line.
- `ProductCard`: Consistent card height, category eyebrow, title, formatted INR price, variant indicator, and view action.
- `ProductVisual`: Displays real uploaded image when `product.image_url` is present; falls back gracefully to a warm pastel container with sparkles and "Photo pending" badge.
- `ProductPurchase`: Variant radio group, optional personalisation note (up to 280 characters), quantity controls (1-20), and CartProvider connection.
- `CartProvider`: React Context backed by `localStorage` (`floretz-cart`). Provides add, updateQuantity, remove, clear, item count, and subtotal.
- `AdminWorkspace` (`app/admin/page.tsx`): Role-gated portal connected to FastAPI admin endpoints (`/api/admin/*`) using Bearer tokens. Includes live metric cards, product CRUD, variant creation/deletion, order status management, category creation, Notion integration status card, and secure image upload with magic-byte validation.
- `lib/api.ts`: API adapter reading `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_WHATSAPP_GROUP_URL`, and `NEXT_PUBLIC_WHATSAPP_CHANNEL_URL`. Handles public catalogue requests, order creation, Notion status queries, and authenticated admin API calls.
- `lib/supabase.ts`: Supabase client singleton supporting both `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, safely disabled when default placeholder keys are present to prevent false authentication states.

## Verification record — 2026-10-27

- **TypeScript Typecheck**: Passed with `0 errors` (`npm run typecheck`).
- **Production Build**: Successfully compiled and generated with Next.js 15.5.28 (`npm run build`). All 11 static and dynamic routes compiled without errors in 22.4s.
- **Real Headless Chrome Browser Audit**: Executed via Puppeteer Core driving native Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) in `scripts/browser-audit.mjs`:
  - **8 Routes Audited**: `/`, `/shop`, `/products/lily-bouquet`, `/cart`, `/account`, `/login`, `/register`, `/admin`.
  - **8 Viewports Tested**: 320px, 375px, 430px, 768px, 1024px, 1280px, 1440px, 1920px.
  - **Overflow Issues**: **0** horizontal overflow issues detected.
  - **Console Errors**: **0** console errors.
  - **Network Failures**: **0** failed network requests.
  - **Interactive User Flows**: Tested live search filtering (12 products found for "lily"), Add to Cart, cart quantity incrementing, admin authentication gating ("FLORETTTZ Admin Workspace"), and verified 2 WhatsApp Group links and 2 WhatsApp Channel links.
  - **Screenshots Saved**: 24 responsive screenshots stored in `public/test-screenshots/`.
- **FastAPI Backend Integration**: All 26 unit, authorization, checkout idempotency, Notion status check, WhatsApp webhook verification, payment verification workflow, and JWT token verification tests passed (`cd backend && python -m pytest tests -v`).
