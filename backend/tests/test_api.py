import io
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.auth import Principal, get_current_principal, require_role
from app.config import Settings
from app.main import app
from app.models import Category, Order, Product
from app.schemas import CheckoutItem, CheckoutRequest
from app.services import catalogue_products, create_whatsapp_order, product_query


@pytest.fixture
def client():
    return TestClient(app)


def request_with_headers(headers: dict[str, str] | None = None) -> Request:
    return Request(
        {"type": "http", "headers": [(key.encode(), value.encode()) for key, value in (headers or {}).items()]}
    )


def test_catalogue_returns_only_published_products(db):
    products, total = catalogue_products(db, None, None, "newest", 1, 48)
    assert total == 33
    assert all(product.published for product in products)
    assert "mirror-mirror-on-the-wall" not in [product.slug for product in products]


def test_catalogue_search_and_filter(client):
    response = client.get("/api/products?q=lamp")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("lamp" in item["name"].lower() for item in data["items"])

    response_cat = client.get("/api/products?category=flowers")
    assert response_cat.status_code == 200
    cat_data = response_cat.json()
    assert cat_data["total"] >= 1
    assert all(item["category"]["slug"] == "flowers" for item in cat_data["items"])


def test_anonymous_user_attempts_admin_operation(client):
    endpoints = [
        ("GET", "/api/admin/overview"),
        ("GET", "/api/admin/products"),
        ("POST", "/api/admin/products"),
        ("GET", "/api/admin/orders"),
        ("GET", "/api/admin/roles"),
    ]
    for method, path in endpoints:
        res = client.request(method, path)
        assert res.status_code == 401, f"Expected 401 for anonymous access to {path}, got {res.status_code}"


def test_customer_attempts_admin_operation(client):
    headers = {"x-test-user": "user-cust-1", "x-test-role": "customer"}
    endpoints = [
        ("GET", "/api/admin/overview"),
        ("GET", "/api/admin/products"),
        ("POST", "/api/admin/products"),
        ("GET", "/api/admin/orders"),
        ("GET", "/api/admin/roles"),
    ]
    for method, path in endpoints:
        res = client.request(method, path, headers=headers)
        assert res.status_code == 403, f"Expected 403 for customer access to {path}, got {res.status_code}"


def test_catalog_manager_cannot_perform_admin_only_operations(client):
    headers = {"x-test-user": "worker-1", "x-test-role": "catalog_manager"}
    # Catalog manager cannot manage orders or assign roles
    res_orders = client.get("/api/admin/orders", headers=headers)
    assert res_orders.status_code == 403
    res_roles = client.get("/api/admin/roles", headers=headers)
    assert res_roles.status_code == 403


def test_admin_can_perform_allowed_operations(client):
    headers = {"x-test-user": "admin-1", "x-test-role": "admin"}

    # Overview
    res = client.get("/api/admin/overview", headers=headers)
    assert res.status_code == 200
    overview = res.json()
    assert overview["total_products"] >= 34
    assert overview["published_products"] == 33
    assert overview["draft_products"] >= 1

    # Create Product
    product_payload = {
        "sku": "FLR-TEST-NEW-001",
        "slug": "test-new-piece",
        "name": "Test Handmade Piece",
        "description": "Lovely handmade piece for testing",
        "price": "399.00",
        "published": True,
        "available_for_order": True,
    }
    create_res = client.post("/api/admin/products", json=product_payload, headers=headers)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["sku"] == "FLR-TEST-NEW-001"
    product_id = created["id"]

    # Update Product
    update_res = client.patch(f"/api/admin/products/{product_id}", json={"name": "Updated Piece Name"}, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Piece Name"

    # List Admin Products (including drafts)
    list_res = client.get("/api/admin/products", headers=headers)
    assert list_res.status_code == 200
    assert any(p["slug"] == "mirror-mirror-on-the-wall" for p in list_res.json()["items"])


def test_catalog_manager_can_manage_catalogue(client):
    headers = {"x-test-user": "catman-1", "x-test-role": "catalog_manager"}

    # Create category
    cat_res = client.post(
        "/api/admin/categories",
        json={"slug": "mini-blooms", "name": "Mini Blooms", "description": "Small decorative flowers"},
        headers=headers,
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # Create product in category
    prod_res = client.post(
        "/api/admin/products",
        json={
            "sku": "FLR-MINI-001",
            "slug": "single-mini-rose",
            "name": "Single Mini Rose",
            "description": "Handmade single rose",
            "price": "99.00",
            "published": True,
            "available_for_order": True,
            "category_id": cat_id,
        },
        headers=headers,
    )
    assert prod_res.status_code == 201
    product_id = prod_res.json()["id"]

    # Add variant
    var_res = client.post(
        f"/api/admin/products/{product_id}/variants",
        json={"sku": "FLR-MINI-001-RED", "name": "Ruby Red", "price": "109.00", "available_for_order": True},
        headers=headers,
    )
    assert var_res.status_code == 201
    variant_id = var_res.json()["id"]

    # Update variant
    var_patch = client.patch(
        f"/api/admin/variants/{variant_id}",
        json={"name": "Velvet Red", "price": "119.00"},
        headers=headers,
    )
    assert var_patch.status_code == 200
    assert var_patch.json()["name"] == "Velvet Red"

    # Delete variant
    del_res = client.delete(f"/api/admin/variants/{variant_id}", headers=headers)
    assert del_res.status_code == 200


def test_user_cannot_access_another_customers_orders(client, db):
    # Customer 1 places an order
    product = db.scalar(product_query().where(Product.slug == "lily-bouquet"))
    checkout_1 = {
        "customer_name": "Customer One",
        "customer_phone": "+91 9999911111",
        "idempotency_key": "idemp-cust1-isolation-001",
        "items": [{"product_id": product.id, "quantity": 1}],
    }
    res1 = client.post(
        "/api/orders/whatsapp-handoff",
        json=checkout_1,
        headers={"x-test-user": "user-cust-1", "x-test-role": "customer"},
    )
    assert res1.status_code == 201
    ref1 = res1.json()["reference"]

    # Customer 2 queries their own orders
    res2 = client.get(
        "/api/orders/me",
        headers={"x-test-user": "user-cust-2", "x-test-role": "customer"},
    )
    assert res2.status_code == 200
    orders2 = res2.json()
    # Customer 2 must NOT see Customer 1's order
    assert all(o["reference"] != ref1 for o in orders2)

    # Customer 1 queries their own orders
    res1_orders = client.get(
        "/api/orders/me",
        headers={"x-test-user": "user-cust-1", "x-test-role": "customer"},
    )
    assert res1_orders.status_code == 200
    orders1 = res1_orders.json()
    assert any(o["reference"] == ref1 for o in orders1)


def test_user_cannot_change_their_own_role(client):
    # Non-admin attempts to assign role
    headers = {"x-test-user": "hacker-user", "x-test-role": "customer"}
    res = client.post(
        "/api/admin/roles",
        json={"user_id": "hacker-user", "role": "admin"},
        headers=headers,
    )
    assert res.status_code == 403


def test_client_price_tampering_is_prevented_and_order_is_idempotent(db):
    product = db.scalar(product_query().where(Product.slug == "lily-bouquet"))
    payload = CheckoutRequest(
        customer_name="Asha Sharma",
        customer_phone="+91 9876543210",
        idempotency_key="checkout-test-price-tamper-001",
        items=[CheckoutItem(product_id=product.id, quantity=2)],
    )
    first, first_url = create_whatsapp_order(db, payload, Settings(env="test", database_url="sqlite:///./test_floretz.db"))
    second, _ = create_whatsapp_order(db, payload, Settings(env="test", database_url="sqlite:///./test_floretz.db"))
    # Lily Bouquet is ₹299. 2 * 299 = ₹598
    assert str(first.total) == "598.00"
    assert first.reference == second.reference
    assert "wa.me" in first_url


def test_invalid_or_expired_or_forged_tokens_rejected(client):
    # Bearer token without valid configuration or valid signature must be rejected with 401
    bad_headers = {"Authorization": "Bearer forged.token.signature"}
    res = client.get("/api/orders/me", headers=bad_headers)
    assert res.status_code == 401
    assert "detail" in res.json()


def test_unsafe_image_upload_and_invalid_input(client):
    headers = {"x-test-user": "admin-1", "x-test-role": "admin"}

    # 1. Reject text file disguised as image
    fake_file = io.BytesIO(b"<script>alert('xss')</script>")
    res_fake = client.post(
        "/api/admin/upload-image",
        files={"file": ("malicious.jpg", fake_file, "image/jpeg")},
        headers=headers,
    )
    assert res_fake.status_code == 415

    # 2. Reject oversized file (>5MB)
    huge_file = io.BytesIO(b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024 + 100))
    res_huge = client.post(
        "/api/admin/upload-image",
        files={"file": ("huge.jpg", huge_file, "image/jpeg")},
        headers=headers,
    )
    assert res_huge.status_code == 413

    # 3. Accept valid PNG file (PNG signature: \x89PNG\r\n\x1a\n)
    valid_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4")
    res_valid = client.post(
        "/api/admin/upload-image",
        files={"file": ("valid.png", valid_png, "image/png")},
        headers=headers,
    )
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["mime_type"] == "image/png"
    assert data["url"].startswith("/uploads/")


def test_published_product_requires_confirmed_price(client):
    headers = {"x-test-user": "admin-1", "x-test-role": "admin"}
    # Attempt to create published product with null price
    res = client.post(
        "/api/admin/products",
        json={
            "sku": "FLR-NO-PRICE-001",
            "slug": "unconfirmed-price-item",
            "name": "Unconfirmed Price Item",
            "price": None,
            "published": True,
            "available_for_order": True,
        },
        headers=headers,
    )
    assert res.status_code == 422


def test_duplicate_sku_or_slug_rejected(client):
    headers = {"x-test-user": "admin-1", "x-test-role": "admin"}
    # Attempt to reuse existing SKU
    res_dup_sku = client.post(
        "/api/admin/products",
        json={
            "sku": "FLR-CAKE",
            "slug": "different-slug-cake",
            "name": "Another Cake",
            "price": "599.00",
            "published": False,
        },
        headers=headers,
    )
    assert res_dup_sku.status_code == 409

    # Attempt to reuse existing slug
    res_dup_slug = client.post(
        "/api/admin/products",
        json={
            "sku": "FLR-NEW-SKU-999",
            "slug": "cake",
            "name": "Another Cake",
            "price": "599.00",
            "published": False,
        },
        headers=headers,
    )
    assert res_dup_slug.status_code == 409


def test_admin_order_status_workflow(client, db):
    # Create an order
    product = db.scalar(product_query().where(Product.slug == "flower-lamp"))
    checkout = {
        "customer_name": "Devi Rao",
        "customer_phone": "+91 9123456789",
        "idempotency_key": "idemp-admin-order-status-001",
        "items": [{"product_id": product.id, "quantity": 1}],
    }
    create_res = client.post("/api/orders/whatsapp-handoff", json=checkout)
    assert create_res.status_code == 201
    ref = create_res.json()["reference"]

    admin_headers = {"x-test-user": "admin-1", "x-test-role": "admin"}
    # Admin lists orders
    orders_res = client.get("/api/admin/orders", headers=admin_headers)
    assert orders_res.status_code == 200
    matched_order = next(o for o in orders_res.json() if o["reference"] == ref)
    order_id = matched_order["id"]
    assert matched_order["status"] == "pending"

    # Admin updates order status to confirmed
    patch_res = client.patch(f"/api/admin/orders/{order_id}", json={"status": "confirmed"}, headers=admin_headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "confirmed"


def test_supabase_jwt_hs256_verification_and_role_lookup(db):
    import time
    import jwt

    test_secret = "test-super-secret-key-for-supabase-jwt-12345"
    test_settings = Settings(
        env="production",  # strict mode, test headers disabled!
        supabase_jwt_secret=test_secret,
        supabase_audience="authenticated",
    )

    # 1. Valid token for customer
    payload = {
        "sub": "user-uuid-1234",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
    }
    valid_token = jwt.encode(payload, test_secret, algorithm="HS256")
    req = request_with_headers({"authorization": f"Bearer {valid_token}"})
    principal = get_current_principal(req, test_settings, db)
    assert principal.user_id == "user-uuid-1234"
    assert principal.role == "customer"

    # 2. Expired token rejected with 401
    expired_payload = {
        "sub": "user-uuid-1234",
        "aud": "authenticated",
        "exp": int(time.time()) - 100,
    }
    expired_token = jwt.encode(expired_payload, test_secret, algorithm="HS256")
    req_expired = request_with_headers({"authorization": f"Bearer {expired_token}"})
    with pytest.raises(HTTPException) as exc_info:
        get_current_principal(req_expired, test_settings, db)
    assert exc_info.value.status_code == 401

    # 3. Forged token with wrong secret rejected with 401
    forged_token = jwt.encode(payload, "wrong-secret-key-9999", algorithm="HS256")
    req_forged = request_with_headers({"authorization": f"Bearer {forged_token}"})
    with pytest.raises(HTTPException) as exc_info2:
        get_current_principal(req_forged, test_settings, db)
    assert exc_info2.value.status_code == 401


def test_community_links_endpoint(client):
    res = client.get("/api/community")
    assert res.status_code == 200
    data = res.json()
    assert "whatsapp_group_url" in data
    assert "whatsapp_channel_url" in data
    assert "chat.whatsapp.com/HQAdFVG6arGFh77oRGZsQk" in data["whatsapp_group_url"]
    assert "whatsapp.com/channel/0029Vb9L4MLG3R3Zpsx31l1U" in data["whatsapp_channel_url"]
    # Check query params in group url are preserved
    assert "s=cl" in data["whatsapp_group_url"]


def test_admin_notion_status_role_enforcement(client):
    # 1. Unauthenticated request -> 401
    anon_res = client.get("/api/admin/notion/status")
    assert anon_res.status_code == 401

    # 2. Customer role -> 403
    customer_headers = {"x-test-user": "user-cust-1", "x-test-role": "customer"}
    cust_res = client.get("/api/admin/notion/status", headers=customer_headers)
    assert cust_res.status_code == 403

    # 3. Catalog manager -> 403 (Notion sync status is admin-only)
    mgr_headers = {"x-test-user": "user-mgr-1", "x-test-role": "catalog_manager"}
    mgr_res = client.get("/api/admin/notion/status", headers=mgr_headers)
    assert mgr_res.status_code == 403

    # 4. Admin role -> 200 with connection report
    admin_headers = {"x-test-user": "admin-1", "x-test-role": "admin"}
    admin_res = client.get("/api/admin/notion/status", headers=admin_headers)
    assert admin_res.status_code == 200
    body = admin_res.json()
    assert "connected" in body
    assert "configured" in body


def test_admin_notion_sync_order_not_found(client):
    admin_headers = {"x-test-user": "admin-1", "x-test-role": "admin"}
    res = client.post("/api/admin/notion/sync/999999", headers=admin_headers)
    assert res.status_code == 404


def test_whatsapp_message_format_has_floretttz_branding(db):
    from app.whatsapp import format_whatsapp_order_message
    from app.models import Order, OrderItem
    from decimal import Decimal

    order = Order(
        reference="FLR-TEST-MSG-001",
        customer_name="Aarav Sharma",
        customer_phone="+91 9876543210",
        total=Decimal("899.00"),
        status="pending",
        idempotency_key="idemp-test-msg-001",
    )
    item = OrderItem(
        product_id=1,
        product_name="Hot Wheels Bouquet",
        variant_name="Classic",
        unit_price=Decimal("899.00"),
        quantity=1,
    )
    order.items = [item]

    msg = format_whatsapp_order_message(order)
    assert "Hello Floretttz!" in msg
    assert "FLR-TEST-MSG-001" in msg
    assert "Hot Wheels Bouquet (Classic)" in msg
    assert "899" in msg


def test_whatsapp_webhook_challenge_verification(client):
    from app.config import get_settings
    settings = get_settings()
    settings.whatsapp_webhook_verify_token = "test_floretttz_verify_secret_123"

    res = client.get(
        "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test_floretttz_verify_secret_123&hub.challenge=1158201444"
    )
    assert res.status_code == 200
    assert res.text == "1158201444"

    bad_res = client.get(
        "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=1158201444"
    )
    assert bad_res.status_code == 403

    bad_mode = client.get(
        "/api/whatsapp/webhook?hub.mode=publish&hub.verify_token=test_floretttz_verify_secret_123&hub.challenge=1158201444"
    )
    assert bad_mode.status_code == 403


def test_whatsapp_webhook_signature_and_deduplication(client, db):
    import hashlib
    import hmac
    import json
    from app.config import get_settings

    settings = get_settings()
    settings.whatsapp_app_secret = "test_meta_app_secret_xyz"

    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "id": "wamid.TEST_MSG_DEDUP_001",
                        "from": "919876543210",
                        "type": "text",
                        "text": {"body": "Hi, I placed order FLZ-202610-TEST"},
                        "timestamp": "1730000000",
                    }]
                }
            }]
        }]
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = "sha256=" + hmac.new(b"test_meta_app_secret_xyz", raw_body, hashlib.sha256).hexdigest()

    # 1. Invalid signature rejection
    res_bad = client.post(
        "/api/whatsapp/webhook",
        content=raw_body,
        headers={"x-hub-signature-256": "sha256=invalidhash", "content-type": "application/json"},
    )
    assert res_bad.status_code == 401

    # 2. Valid signature accepted
    res_ok = client.post(
        "/api/whatsapp/webhook",
        content=raw_body,
        headers={"x-hub-signature-256": sig, "content-type": "application/json"},
    )
    assert res_ok.status_code == 200
    results = res_ok.json().get("results", [])
    assert len(results) == 1
    assert results[0]["id"] == "wamid.TEST_MSG_DEDUP_001"

    # 3. Duplicate message delivery safely ignored
    res_dup = client.post(
        "/api/whatsapp/webhook",
        content=raw_body,
        headers={"x-hub-signature-256": sig, "content-type": "application/json"},
    )
    assert res_dup.status_code == 200
    dup_results = res_dup.json().get("results", [])
    assert dup_results[0]["status"] == "duplicate_ignored"


def test_whatsapp_payment_screenshot_intake_workflow(client, db):
    from app.config import get_settings
    from app.models import Order
    from decimal import Decimal

    settings = get_settings()
    settings.whatsapp_app_secret = None

    order = Order(
        reference="FLZ-TEST-IMG-001",
        customer_name="Pooja Patel",
        customer_phone="919876543210",
        total=Decimal("1250.00"),
        status="pending",
        idempotency_key="idemp-img-test-001",
    )
    db.add(order)
    db.commit()

    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "id": "wamid.TEST_IMG_001",
                        "from": "919876543210",
                        "type": "image",
                        "image": {"id": "meta_img_media_98765"},
                        "timestamp": "1730000001",
                    }]
                }
            }]
        }]
    }
    res = client.post("/api/whatsapp/webhook", json=payload)
    assert res.status_code == 200

    db.refresh(order)
    assert order.status == "pending_verification"
    assert "meta_img_media_98765" in (order.payment_screenshot_url or "")


def test_admin_payment_verification_workflow(client, db):
    from app.models import Order
    from decimal import Decimal

    order = Order(
        reference="FLZ-TEST-VERIFY-001",
        customer_name="Rohan Gupta",
        customer_phone="919876543211",
        total=Decimal("699.00"),
        status="pending_verification",
        payment_screenshot_url="meta_media:12345",
        idempotency_key="idemp-verify-test-001",
    )
    db.add(order)
    db.commit()

    # 1. Customer forbidden
    cust_res = client.post(
        f"/api/admin/orders/{order.id}/verify-payment",
        json={"action": "verify"},
        headers={"x-test-user": "customer-1", "x-test-role": "customer"},
    )
    assert cust_res.status_code == 403

    # 2. Admin verifies payment -> confirmed
    admin_res = client.post(
        f"/api/admin/orders/{order.id}/verify-payment",
        json={"action": "verify", "note": "GPay transaction verified"},
        headers={"x-test-user": "admin-1", "x-test-role": "admin"},
    )
    assert admin_res.status_code == 200
    db.refresh(order)
    assert order.status == "confirmed"
    assert order.payment_verified_by == "admin-1"
    assert order.payment_verified_at is not None


def test_admin_settings_status_redacted(client):
    import json

    cust_res = client.get("/api/admin/settings/status", headers={"x-test-user": "c1", "x-test-role": "customer"})
    assert cust_res.status_code == 403

    admin_res = client.get("/api/admin/settings/status", headers={"x-test-user": "admin-1", "x-test-role": "admin"})
    assert admin_res.status_code == 200
    status_data = admin_res.json()
    assert "env" in status_data
    assert "whatsapp_cloud_api_configured" in status_data
    assert "supabase_configured" in status_data
    assert "notion_configured" in status_data
    assert "sb_publishable" not in json.dumps(status_data)
    assert "ntn_" not in json.dumps(status_data)


def test_indian_phone_normalization_and_validation():
    import pytest
    from app.phone import normalize_indian_mobile, is_valid_indian_mobile, PhoneValidationError

    # 1. Valid 10-digit formats normalize to E.164 +91<10-digits>
    assert normalize_indian_mobile("9876543210") == "+919876543210"
    assert normalize_indian_mobile("98765 43210") == "+919876543210"
    assert normalize_indian_mobile("98765-43210") == "+919876543210"
    assert normalize_indian_mobile("(98765) 43210") == "+919876543210"
    assert normalize_indian_mobile("+91 9876543210") == "+919876543210"
    assert normalize_indian_mobile("+919876543210") == "+919876543210"
    assert normalize_indian_mobile("919876543210") == "+919876543210"
    assert normalize_indian_mobile("09876543210") == "+919876543210"

    # Valid starting digits in India (6, 7, 8, 9)
    assert normalize_indian_mobile("6123456789") == "+916123456789"
    assert normalize_indian_mobile("7123456789") == "+917123456789"
    assert normalize_indian_mobile("8123456789") == "+918123456789"
    assert normalize_indian_mobile("9123456789") == "+919123456789"
    assert is_valid_indian_mobile("9876543210") is True

    # 2. Rejection of short inputs
    with pytest.raises(PhoneValidationError, match="exactly 10 digits"):
        normalize_indian_mobile("987654321")

    # 3. Rejection of long inputs
    with pytest.raises(PhoneValidationError, match="cannot exceed 10 digits"):
        normalize_indian_mobile("987654321099")

    # 4. Rejection of invalid initial digit (e.g. 1-5)
    with pytest.raises(PhoneValidationError, match="must start with 6, 7, 8, or 9"):
        normalize_indian_mobile("5123456789")
    with pytest.raises(PhoneValidationError, match="must start with 6, 7, 8, or 9"):
        normalize_indian_mobile("1234567890")

    # 5. Rejection of multiple / redundant country codes
    with pytest.raises(PhoneValidationError, match="Multiple country codes"):
        normalize_indian_mobile("+91 +91 9876543210")
    with pytest.raises(PhoneValidationError, match="Multiple country codes detected"):
        normalize_indian_mobile("+91919876543210")

    # 6. Rejection of non-Indian country codes for checkout
    with pytest.raises(PhoneValidationError, match="serves customers in India only"):
        normalize_indian_mobile("+1 555 123 4567")

    # 7. Preserves existing international number explicitly when requested
    assert normalize_indian_mobile("+1 555 123 4567", allow_existing_international=True) == "+15551234567"
    assert normalize_indian_mobile("+44 20 7946 0958", allow_existing_international=True) == "+442079460958"


def test_checkout_enforces_indian_phone_validation_and_normalization(client, db):
    # 1. Valid checkout with 10-digit number gets normalized in DB to +919876543210
    response = client.post(
        "/api/orders/whatsapp-handoff",
        json={
            "customer_name": "Kavita Rao",
            "customer_phone": "98765 43210",
            "idempotency_key": "idemp-india-phone-001",
            "items": [{"product_id": 1, "quantity": 1}],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "reference" in data

    from app.models import Order
    from sqlalchemy import select
    order = db.scalar(select(Order).where(Order.reference == data["reference"]))
    assert order is not None
    assert order.customer_phone == "+919876543210"

    # 2. Invalid checkout: short number rejected with 422
    short_res = client.post(
        "/api/orders/whatsapp-handoff",
        json={
            "customer_name": "Kavita Rao",
            "customer_phone": "9876543",
            "idempotency_key": "idemp-india-phone-002",
            "items": [{"product_id": 1, "quantity": 1}],
        },
    )
    assert short_res.status_code == 422

    # 3. Invalid checkout: non-Indian international number rejected with 422
    intl_res = client.post(
        "/api/orders/whatsapp-handoff",
        json={
            "customer_name": "Kavita Rao",
            "customer_phone": "+1 555 123 4567",
            "idempotency_key": "idemp-india-phone-003",
            "items": [{"product_id": 1, "quantity": 1}],
        },
    )
    assert intl_res.status_code == 422


def test_production_mode_fails_with_insecure_defaults(monkeypatch):
    import pytest
    from pydantic import ValidationError
    from app.config import Settings

    monkeypatch.setenv("FLORETTTZ_ENV", "production")
    monkeypatch.setenv("FLORETZ_ENV", "production")
    monkeypatch.setenv("FLORETTTZ_WHATSAPP_NUMBER", "919999999999")
    monkeypatch.setenv("FLORETTTZ_WHATSAPP_BUSINESS_NUMBER", "919999999999")
    monkeypatch.setenv("FLORETTTZ_SUPABASE_URL", "https://valid.supabase.co")

    with pytest.raises(ValidationError):
        Settings()






