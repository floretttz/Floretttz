# FLORETTTZ Research and Development

## Purpose and product scope

FLORETTTZ (brand name *Floretttz*) sells handmade floral pieces, gifts, hampers, accessories, personalised products, lamps, and home decor to customers in India. The storefront supports product discovery, an extensive 34-item catalogue, a persistent cart, and a WhatsApp order handoff in INR. It intentionally does not accept online credit cards or payment gateways.

Primary journeys:
- A mobile customer browses categories, inspects product details, configures variants/personalisation, adds to cart, and initiates an authoritative WhatsApp order handoff.
- An authenticated customer can view their profile and account-linked orders once authentication is established.
- A staff member (*catalog_manager* or *admin*) manages products, variants, categories, customer orders, and monitors external Notion synchronization.

## Brand rename & visual assets

The brand has been renamed from **FLORETZ** to **FLORETTTZ** (with **Floretttz** used for sentence/mixed-case copy and **FLORETTTZ** for uppercase brandings and headers):
- **User-facing copy**: Homepage, headers, footers, shop catalogue, product pages, cart, account, and admin workspace updated to Floretttz / FLORETTTZ.
- **Brand asset status**: `public/brand/floretz-handmade-floral-badge.png` visually renders "FLORETTTZ" (with three Ts) and "HANDMADE GIFTS, BLOOMS & MORE". A direct asset copy was also added at `public/brand/floretttz-handmade-floral-badge.png` to ensure seamless resolution under both filenames.

## Architecture

`Next.js 15 App Router (TypeScript)` serves the storefront and admin workspace. `FastAPI` (Python 3.12) owns catalogue queries, authoritative cart validation, order creation, image uploads, Notion synchronization, WhatsApp Cloud API webhooks, and role-based authorization.

```text
Storefront (Next.js) -> FastAPI API -> PostgreSQL (Supabase) / SQLite Fallback
                     -> WhatsApp Deep Link (wa.me handoff)
                     -> Notion Integration (Official Notion API / Bot "Floretttz's")
                     -> WhatsApp Community (Verified Group & Channel links)
                     -> WhatsApp Cloud API (Webhook, HMAC signature validation, screenshot intake)
```

## Integrations

### 1. Supabase Project Integration
- **Project URL**: `https://tzemepkyhzxhtiohdcrh.supabase.co`
- **Publishable Key**: Configured via `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (and legacy fallback `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **JWKS Endpoint**: Live endpoint `/auth/v1/.well-known/jwks.json` verified returning public signing key (alg: ES256, kty: EC) for server-side verification.
- **Client Configuration**: `lib/supabase.ts` safely distinguishes genuine Supabase credentials from template placeholder values.
- **Privilege Separation**: Privileged keys remain strictly server-side and are never exposed to browser code.

### 2. Notion API Integration
- **Service Module**: `backend/app/notion.py` (`NotionService`).
- **Authentication**: Verified live with Notion API (`https://api.notion.com/v1/users/me`) as bot user `"Floretttz's"`.
- **Order Synchronization**: `sync_order()` creates or updates Notion pages with order reference, customer name, phone, item summary, total, and status. Includes idempotency checking via reference queries and resilient schema fallbacks.
- **Owner Action Required**: The Notion bot `"Floretttz's"` is active, but the owner must share their target Notion Orders database with the bot (open Notion database -> click `•••` -> `Connections` -> select `Floretttz's`).

### 3. WhatsApp Community Links
- **Group URL**: `https://chat.whatsapp.com/KpDZ3hfIAJH4iFLWSTyXjw?s=cl&p=a&iam=2`
- **Channel URL**: `https://whatsapp.com/channel/0029Vb9L4MLG3R3Zpsx31l1U`
- **Placement**: Featured in a dedicated homepage Community section and the site-wide footer with safe external link handling (`target="_blank"` and `rel="noopener noreferrer"`).
- **Configuration**: Managed via `NEXT_PUBLIC_WHATSAPP_GROUP_URL` and `NEXT_PUBLIC_WHATSAPP_CHANNEL_URL` with backend API endpoint `GET /api/community`.

### 4. WhatsApp Cloud API & Payment Verification
- **Status**: READY FOR CONFIGURATION (all application code and tests complete; awaiting live Meta Developer App credentials).
- **Service Implementation**: `WhatsAppCloudAPIService` in `backend/app/whatsapp.py`.
- **Webhook Handshake**: `GET /api/whatsapp/webhook` handles Meta verification challenge with `hub.mode`, `hub.verify_token`, and `hub.challenge`.
- **Signature Security**: `POST /api/whatsapp/webhook` enforces `X-Hub-Signature-256` HMAC-SHA256 validation using `FLORETTTZ_WHATSAPP_APP_SECRET`.
- **Deduplication**: In-memory LRU cache tracks up to 1,000 `wamid` message IDs to prevent duplicate actions on retried deliveries.
- **Payment Screenshot Intake**: Incoming image messages automatically transition the customer's active order to `pending_verification` (NEVER automatically marked paid).
- **Payment Instructions**: Formatter outputs order reference, total in INR, and owner-configured UPI details (`FLORETTTZ_UPI_ID`, `FLORETTTZ_UPI_PAYEE_NAME`).
- **Admin Review Action**: `POST /api/admin/orders/{order_id}/verify-payment` allows authorized administrators to verify or reject payments, recording `payment_verified_by` and `payment_verified_at` timestamps.

## Testing and Verification Record

### 1. TypeScript & Static Analysis
- Command: `npm run typecheck` (`tsc --noEmit`)
- Result: **0 errors** (100% pass).

### 2. Production Build
- Command: `npm run build` (`next build`)
- Result: Completed successfully. All 11 static and dynamic routes compiled without errors.

### 3. Backend Automated Tests
- Command: `cd backend && python -m pytest tests -v`
- Result: **26 passed in 43.13s (100% pass rate)**.
  1. `test_catalogue_returns_only_published_products`
  2. `test_catalogue_search_and_filter`
  3. `test_anonymous_user_attempts_admin_operation`
  4. `test_customer_attempts_admin_operation`
  5. `test_catalog_manager_cannot_perform_admin_only_operations`
  6. `test_admin_can_perform_allowed_operations`
  7. `test_catalog_manager_can_manage_catalogue`
  8. `test_user_cannot_access_another_customers_orders`
  9. `test_user_cannot_change_their_own_role`
  10. `test_client_price_tampering_is_prevented_and_order_is_idempotent`
  11. `test_invalid_or_expired_or_forged_tokens_rejected`
  12. `test_unsafe_image_upload_and_invalid_input`
  13. `test_published_product_requires_confirmed_price`
  14. `test_duplicate_sku_or_slug_rejected`
  15. `test_admin_order_status_workflow`
  16. `test_supabase_jwt_hs256_verification_and_role_lookup`
  17. `test_community_links_endpoint`
  18. `test_admin_notion_status_role_enforcement`
  19. `test_admin_notion_sync_order_not_found`
  20. `test_whatsapp_message_format_has_floretttz_branding`
  21. `test_whatsapp_webhook_challenge_verification`
  22. `test_whatsapp_webhook_signature_and_deduplication`
  23. `test_whatsapp_payment_screenshot_intake_workflow`
  24. `test_admin_payment_verification_workflow`
  25. `test_admin_settings_status_redacted`
  26. `test_production_mode_fails_with_insecure_defaults`

### 4. Chrome Browser-Based UI/UX Audit
- Script: `node scripts/browser-audit.mjs`
- Engine: Native Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`)
- Scope: 8 pages across 8 viewports (320px, 375px, 430px, 768px, 1024px, 1280px, 1440px, 1920px).
- Audit findings:
  - **Horizontal Overflow**: 0 issues detected across all 8 viewports.
  - **Console Errors**: 0 errors.
  - **Network Failures**: 0 failed requests.
  - **Landmarks**: `<main>`, `<header>`, `<footer>`, and a single `<h1>` present on all audited routes.
  - **Interactive Flows**: Search, Cart add, Admin gating, and Community link discovery all verified.
  - **Screenshots**: 24 responsive screenshots stored in `public/test-screenshots/`.

