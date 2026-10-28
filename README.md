# FLORETTTZ E-Commerce Platform

FLORETTTZ (*Floretttz*) is a responsive, elegant e-commerce storefront for handmade gifts, pipe-cleaner flower bouquets, customized hampers, lamps, and decorative keepsakes. The application is built with a Next.js 15 App Router frontend and a Python FastAPI backend, designed for WhatsApp-first order fulfillment with server-authoritative pricing, Notion order synchronization, and role-based administrative access.

## Core Architecture

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript (strict), Vanilla CSS & design tokens.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, PyJWT, HTTPX.
- **Database / Auth**: SQLite for local fallback; Supabase PostgreSQL with Row Level Security (RLS) and Supabase Auth for production.
- **Order Flow**: WhatsApp handoff with cryptographic server validation, idempotency, and server-side Indian phone normalization.
- **Phone Format & Validation**: India-only mobile input with fixed non-editable `🇮🇳 +91` prefix, strict 10-digit validation (`^[6-9]\d{9}$`), and E.164 normalization on both frontend and backend.
- **Customer Entry & Checkout**: Streamlined customer profile (Full name, Indian mobile, optional email) with zero mandatory password or OTP requirements for instant WhatsApp ordering.
- **Community & Floating Popup**: Top community announcement strip, hero quick links, and floating bottom-right WhatsApp community modal with verified Group and Channel links.
- **Responsive Standard**: Full fluid responsiveness tested and verified across 11 distinct viewports (`320px` to `1920px`) with zero horizontal overflow.
- **Notion Integration**: Official Notion API order synchronization via dedicated backend service (`NotionService`).

---

## Brand Identity & Rename

- **User-Facing Copy**: Standardized to **Floretttz** in mixed/sentence-case copy and **FLORETTTZ** for uppercase headers and navigation.
- **Emblem / Logo**: The badge graphic at `public/brand/floretttz-handmade-floral-badge.png` (and alias `public/brand/floretz-handmade-floral-badge.png`) visually renders "FLORETTTZ" (with three Ts) and "HANDMADE GIFTS, BLOOMS & MORE".

---

## Running Locally

### 1. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key configuration variables:
- `NEXT_PUBLIC_API_URL`: `http://localhost:8000`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: Store WhatsApp number (`917533832123`)
- `NEXT_PUBLIC_WHATSAPP_GROUP_URL`: Verified WhatsApp Group invitation URL
- `NEXT_PUBLIC_WHATSAPP_CHANNEL_URL`: Verified WhatsApp Channel invitation URL
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (`https://tzemepkyhzxhtiohdcrh.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key (`sb_publishable_...`)

### 2. Backend Setup & Run
From the project root:
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
The FastAPI backend will automatically initialize the database schema and seed the initial 34 catalogue products on startup.
- API documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
- Community links: `http://localhost:8000/api/community`

### 3. Frontend Setup & Run
From the project root in a second terminal:
```bash
npm install
npm run dev
```
Open `http://localhost:3000` to browse the store.

---

## Integrations Status

### Supabase Project
- Project URL (`https://tzemepkyhzxhtiohdcrh.supabase.co`) is live and verified.
- JWKS endpoint (`/auth/v1/.well-known/jwks.json`) returns active signing key (alg: ES256, kty: EC).
- Client initialized with publishable key; service-role keys remain strictly server-side.

### Notion API Order Synchronization
- Backend service `backend/app/notion.py` connects using official Notion API.
- Authenticated with bot user **"Floretttz's"**.
- Orders created on storefront automatically synchronize to Notion with idempotency and schema fallback.
- **Action Required by Owner**: Open your Notion Orders database, click `•••` -> `Connections`, and select **Floretttz's**.

### WhatsApp Community & Cloud API
- **Group URL**: `https://chat.whatsapp.com/KpDZ3hfIAJH4iFLWSTyXjw?s=cl&p=a&iam=2`
- **Channel URL**: `https://whatsapp.com/channel/0029Vb9L4MLG3R3Zpsx31l1U`
- Displayed prominently in the homepage Community section and site-wide footer.
- **Cloud API Readiness**: Fully implemented in `backend/app/whatsapp.py` and `backend/app/main.py`:
  - `GET /api/whatsapp/webhook`: Meta webhook verification challenge.
  - `POST /api/whatsapp/webhook`: HMAC-SHA256 signature verification and message deduplication.
  - Payment screenshot intake automatically transitions orders to `pending_verification` (never marked paid).
  - `POST /api/admin/orders/{order_id}/verify-payment`: Admin review action with actor and timestamp audit.
  - Status: **READY FOR CONFIGURATION** (pending Meta Developer App credentials).

---

## Verification & Testing

### TypeScript Verification
```bash
npm run typecheck
```
*Result: Passed with 0 errors (`tsc --noEmit`).*

### Production Build
```bash
npm run build
```
*Result: Next.js 15.5.28 compiled all 11 static and dynamic routes cleanly.*

### Real Headless Chrome Browser & Responsive Audit (11 Viewports)
```bash
node scripts/browser-audit.mjs
```
*Result: Visited 9 routes across 11 responsive viewports (`320px`, `375px`, `390px`, `430px`, `600px`, `768px`, `820px`, `1024px`, `1280px`, `1440px`, `1920px`). **0 horizontal overflow issues**, 0 console errors (excluding deliberate 404 test), 10 verified interactive flows, and 36 responsive screenshots captured in `public/test-screenshots/`.*

### Backend Unit, Security, & Integration Tests
```bash
cd backend
python -m pytest tests -v
```
*Result: 28 passed in 47.24s (100% pass rate).*
Tests cover:
- Catalogue filtering & visibility (unpublished items hidden)
- Anonymous user access rejection (HTTP 401)
- Customer role isolation (HTTP 403 on admin routes)
- Catalog Manager permission boundaries
- Admin operations (product CRUD, orders, overview metrics)
- Customer order isolation (Customer A cannot access Customer B's orders)
- Customer self-role elevation prevention
- Client price tampering protection (server recomputes authoritative prices)
- Order idempotency (network retries reuse reference without duplicate DB records)
- Invalid/forged token rejection
- Unsafe file upload rejection (magic-byte verification) and size limits (5MB)
- Mandatory confirmed prices for published products
- Duplicate SKU and slug collision rejection
- Order status fulfillment transitions (pending -> confirmed)
- Supabase HS256 JWT decoding, claim verification, and role resolution
- WhatsApp community links endpoint integrity
- Notion status role enforcement (admin only)
- Notion sync on missing orders (HTTP 404)
- Floretttz branded WhatsApp order message format
- WhatsApp webhook challenge verification (`GET /api/whatsapp/webhook`)
- WhatsApp webhook HMAC-SHA256 signature validation and message deduplication
- WhatsApp screenshot intake -> order status transition to `pending_verification`
- Admin payment verification authorization and audit attribution
- Admin settings status inspection with credential redaction
- Indian phone number normalization and validation (`normalize_indian_mobile`)
- Checkout enforcement of Indian phone validation and E.164 normalization
- Server startup validation rejecting insecure defaults in production mode

---

## Owner Launch Checklist

1. **Notion Database Sharing**: Open your Notion Orders database -> `•••` -> `Connections` -> Add **Floretttz's**.
2. **WhatsApp Contact Number**: Configure `NEXT_PUBLIC_WHATSAPP_NUMBER` and `FLORETTTZ_WHATSAPP_NUMBER` with your verified business WhatsApp number before public launch.
3. **WhatsApp Cloud API**: When ready to provision Meta Cloud API credentials, supply the Cloud API Token, Phone Number ID, App Secret, and Webhook Verify Token.
4. **Business UPI Details**: Configure `FLORETTTZ_UPI_ID` and `FLORETTTZ_UPI_PAYEE_NAME` for payment instructions.
5. **Rotate Credentials**: As a security best practice, rotate any credentials previously placed in `.env.example`.
6. **Bootstrap Initial Administrator**:
   Assign the first admin securely from the server CLI:
   ```bash
   FLORETTTZ_ADMIN_BOOTSTRAP_TOKEN="your-secret-token" python -m app.bootstrap_admin --user-id "<SUPABASE-USER-UUID>" --token "your-secret-token"
   ```


---

## Permanent Specifications

The repository includes four permanent specification files:
- `RESEARCH_AND_DEVELOPMENT.md`: Architecture decisions, implementation milestones, and test records.
- `FRONTEND_SPECIFICATION.md`: Route inventory, component contracts, responsive behavior, and accessibility.
- `SECURITY_ARCHITECTURE.md`: Threat model, role architecture, RLS policies, and security verification.
- `UI_UX_GUIDELINES.md`: Brand tokens, visual standards, responsive breakpoints, and UI guidelines.
