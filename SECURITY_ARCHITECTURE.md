# FLORETTTZ Security Architecture

## Trust boundaries and roles

The browser is untrusted. Next.js is a presentation layer, FastAPI is the policy-enforcement layer, and PostgreSQL/Supabase is the protected data store.
- **Roles**:
  - `customer`: Can view published catalogue, submit guest/authenticated order requests, and view their own account-linked orders.
  - `catalog_manager`: Can manage catalogue items (create/update products, add/delete variants, upload product images, create/update categories).
  - `admin`: Full system privileges, including catalogue management, viewing and managing all customer orders, updating order fulfillment statuses, assigning user roles, and monitoring Notion synchronization.
- **Role Enforcement**:
  - Roles are stored exclusively in the backend `role_assignments` database table.
  - Roles are **never** trusted from client inputs, URL query parameters, JWT user metadata, or localStorage.
  - Every protected API endpoint uses FastAPI's `require_role(...)` dependency to verify the caller's server-stored role before execution.

## Credential safety and hygiene

- **Clean Template (`.env.example`)**: Strictly contains sanitized placeholders (`sb_publishable_...`, `your-notion-token`, etc.). No private credentials, tokens, or project keys are committed to Git.
- **Ignored Real Environment (`.env` & `backend/.env`)**: Both `.gitignore` and `backend/.gitignore` explicitly ignore `.env`, `.env.local`, `.env.*.local`, and test screenshots.
- **Dual Prefix Support**: Backend configuration gracefully supports both `FLORETTTZ_*` and legacy `FLORETZ_*` environment aliases via Pydantic `AliasChoices`.
- **Browser Protection**: Private tokens (`FLORETTTZ_NOTION_API_KEY`, `FLORETTTZ_SUPABASE_SERVICE_ROLE_KEY`, `FLORETTTZ_ADMIN_BOOTSTRAP_TOKEN`) are strictly server-side and never prefixed with `NEXT_PUBLIC_`.
- **Credential Rotation Notice**: Store owner is advised to rotate any API tokens that were previously placed in `.env.example` before public launch.

## Authentication and token verification

1. **Supabase Auth**: Once users sign in via the storefront, Supabase issues signed JWT access tokens containing the user's UUID in `sub`.
2. **FastAPI Token Verification**: FastAPI decodes and validates incoming Bearer tokens using:
   - **JWKS Endpoint**: Live endpoint (`https://tzemepkyhzxhtiohdcrh.supabase.co/auth/v1/.well-known/jwks.json`) verified returning public signing keys for asymmetric RS256/ES256 verification.
   - **HMAC Secret**: Optional fallback verifying symmetric HS256 tokens using `FLORETTTZ_SUPABASE_JWT_SECRET`.
3. **Role Assignment Lookup**: FastAPI looks up the verified `user_id` in the `role_assignments` table to determine the user's role (defaulting to `customer` if unassigned).
4. **Bootstrap Admin**: Initial administrator assignment requires trusted server execution using `bootstrap_admin.py` with an out-of-band secret token (`FLORETTTZ_ADMIN_BOOTSTRAP_TOKEN`), preventing public self-elevation.

## Notion integration security

- **Server-Side Only**: The Notion integration token (`FLORETTTZ_NOTION_API_KEY`) is stored exclusively in `backend/.env` and accessed through `NotionService`.
- **Role-Gated Endpoints**:
  - `GET /api/admin/notion/status`: Restricted to `admin` role (returns HTTP 401 for anonymous, HTTP 403 for customers and catalog managers).
  - `POST /api/admin/notion/sync/{order_id}`: Restricted to `admin` role.
- **Idempotency & Masking**: Orders are checked for existing Notion records via `reference` property queries before creation. Diagnostic logs never print private tokens or unmasked customer credentials.

## WhatsApp Cloud API security model

- **Webhook Verification**: Meta webhook handshake verifies `hub.mode == "subscribe"` and matches `hub.verify_token` against the server-stored secret before responding with `hub.challenge`.
- **Payload Signature Validation**: Enforces HMAC-SHA256 signature verification (`X-Hub-Signature-256`) against `FLORETTTZ_WHATSAPP_APP_SECRET`. Forged or missing signatures are rejected with HTTP 401 Unauthorized.
- **Message Deduplication**: In-memory LRU cache tracks up to 1,000 `wamid` message IDs so retried deliveries from Meta do not produce duplicate processing or duplicate status changes.
- **Payment Verification Constraint**: A payment screenshot incoming via WhatsApp transitions an order to `pending_verification`. A screenshot will **never** automatically mark an order `paid` or `confirmed`.
- **Payment Verification Audit**: Only authenticated administrators can verify or reject payments via `POST /api/admin/orders/{order_id}/verify-payment`. The system records `payment_verified_by` (admin UUID) and `payment_verified_at` (UTC timestamp).
- **Safe Admin Configuration Inspection**: `GET /api/admin/settings/status` returns boolean configuration flags and redacted identifiers, ensuring administrators can inspect integration status without exposing tokens.
- **Production Mode Invariant Protection**: Server refuses to start in production mode if insecure defaults remain (placeholder business phone `919999999999`, wildcard CORS `*`, or missing Supabase URL).

## Database, RLS, and storage security

- **Migrations**:
  - `001_initial.sql`: Core schema, constraints, indexes, public read policies, and customer order isolation policies.
  - `002_admin_rls_and_storage.sql`: `public.has_role(required_role text)` helper function (`SECURITY DEFINER`), administrative RLS policies for catalogue and orders, and Supabase Storage policies for the `product-images` bucket.
  - `003_payment_verification_and_statuses.sql`: Adds `payment_screenshot_url`, `payment_verified_by`, `payment_verified_at`, and updates the status constraint to support `pending_verification`.
- **PostgreSQL Row Level Security (RLS)**:
  - `products`: Public can SELECT only `published = true`. Managers and admins can INSERT and UPDATE. Admins can DELETE.
  - `product_variants`: Public can SELECT variants belonging to published products. Managers and admins can INSERT, UPDATE, and DELETE.
  - `categories`: Public can SELECT `archived = false`. Managers and admins can INSERT and UPDATE.
  - `orders`: Customers can SELECT only their own orders (`customer_id = auth.uid()`). Admins can SELECT and UPDATE all orders.
  - `role_assignments`: Users can read only their own role assignment. Only admins can insert, update, or delete role assignments.
- **Supabase Storage Rules (`product-images` bucket)**:
  - Public read access for product images.
  - Write access (INSERT, UPDATE, DELETE) restricted to users with `public.has_role('catalog_manager')`.
  - Max file size: 5,242,880 bytes (5MB).
  - Allowed MIME types restricted: `image/jpeg`, `image/png`, `image/webp`.

## Web & API security controls

- **Authoritative Price Validation**: Client requests cannot dictate prices or totals. The server re-queries each product and variant from the database, sums the authoritative prices, and creates the order transactionally.
- **Order Idempotency**: An `idempotency_key` (UUID) prevents duplicate order creation on network retries.
- **Secure Image Uploads**:
  - Requires `catalog_manager` or `admin` authentication.
  - Enforces 5MB maximum file size.
  - Sniffs file header magic bytes (`\xff\xd8\xff` for JPEG, `\x89PNG\r\n\x1a\n` for PNG, `RIFF...WEBP` for WebP). Rejects text, scripts, HTML, SVG, or executables disguised with image extensions (HTTP 415).
  - Generates secure random UUID filenames (`{uuid4().hex}.{ext}`) to eliminate path traversal attacks.
- **CORS Allowlist**: CORS origins restricted to configured frontend domains (`FLORETTTZ_ALLOWED_ORIGINS`).

## Security verification record — 2026-10-27

| Security Check | Status | Evidence / Verification Method |
| --- | --- | --- |
| Anonymous attempts admin operation | **PASSED** | Automated test `test_anonymous_user_attempts_admin_operation` verifies HTTP 401 Unauthorized across all `/api/admin/*` routes. |
| Customer attempts admin operation | **PASSED** | Automated test `test_customer_attempts_admin_operation` verifies HTTP 403 Forbidden for non-staff users. |
| Catalog manager permission boundary | **PASSED** | Automated test `test_catalog_manager_cannot_perform_admin_only_operations` verifies HTTP 403 on order management and role assignment. |
| Admin privileged operations | **PASSED** | Automated test `test_admin_can_perform_allowed_operations` verifies successful product CRUD, metrics overview, and order workflows. |
| Customer-to-customer order isolation | **PASSED** | Automated test `test_user_cannot_access_another_customers_orders` confirms Customer 2 cannot access Customer 1's orders on `/api/orders/me`. |
| Customer self-role escalation | **PASSED** | Automated test `test_user_cannot_change_their_own_role` confirms non-admins receive HTTP 403 when attempting to assign roles. |
| Client price tampering prevention | **PASSED** | Automated test `test_client_price_tampering_is_prevented_and_order_is_idempotent` confirms totals are computed from DB, not client payload. |
| Order idempotency | **PASSED** | Automated test verifies duplicate idempotency key returns the existing order reference without duplicate DB records. |
| Forged / invalid token rejection | **PASSED** | Automated test `test_invalid_or_expired_or_forged_tokens_rejected` confirms unverified tokens receive HTTP 401. |
| Disguised / unsafe file upload rejection | **PASSED** | Automated test `test_unsafe_image_upload_and_invalid_input` confirms script files disguised as images receive HTTP 415. |
| Oversized upload rejection (>5MB) | **PASSED** | Automated test confirms uploads exceeding 5MB receive HTTP 413. |
| Valid image upload | **PASSED** | Automated test confirms legitimate PNG upload succeeds, generates random UUID filename, and returns URL. |
| Unconfirmed price publishing check | **PASSED** | Automated test `test_published_product_requires_confirmed_price` confirms publishing null-price items without variants is rejected (HTTP 422). |
| Duplicate SKU or slug collision | **PASSED** | Automated test `test_duplicate_sku_or_slug_rejected` confirms duplicate creation is blocked with HTTP 409 Conflict. |
| Supabase HS256 JWT & claim verification | **PASSED** | Automated test `test_supabase_jwt_hs256_verification_and_role_lookup` verifies symmetric HS256 secret decoding, claim validation, expiration rejection, and forged signature rejection. |
| Notion status role enforcement | **PASSED** | Automated test `test_admin_notion_status_role_enforcement` verifies unauthenticated (401), customer (403), and catalog manager (403) are blocked while admin succeeds (200). |
| Community links security | **PASSED** | Automated test `test_community_links_endpoint` verifies query parameters and URLs are preserved without injection or truncation. |
| WhatsApp webhook challenge verification | **PASSED** | Automated test `test_whatsapp_webhook_challenge_verification` verifies hub.challenge returned only on token match; invalid token/mode rejected (403). |
| WhatsApp webhook HMAC signature & dedup | **PASSED** | Automated test `test_whatsapp_webhook_signature_and_deduplication` verifies SHA-256 HMAC validation and duplicate delivery suppression. |
| WhatsApp screenshot intake -> pending_verification | **PASSED** | Automated test `test_whatsapp_payment_screenshot_intake_workflow` verifies order status changes to pending_verification (never paid). |
| Admin payment verification authorization & audit | **PASSED** | Automated test `test_admin_payment_verification_workflow` verifies customer forbidden (403) and admin records actor and timestamp. |
| Admin settings status redaction | **PASSED** | Automated test `test_admin_settings_status_redacted` verifies secrets are masked and non-admins are blocked. |
| Production configuration validation | **PASSED** | Automated test `test_production_mode_fails_with_insecure_defaults` verifies server startup rejection on placeholder numbers or wildcard CORS. |
| Live Supabase project reachability | **VERIFIED** | Live connection to `https://tzemepkyhzxhtiohdcrh.supabase.co` and JWKS public key retrieval verified (ES256). |
| Live Notion API bot authentication | **VERIFIED** | Live authenticated call to `https://api.notion.com/v1/users/me` succeeded as bot user `"Floretttz's"`. |

