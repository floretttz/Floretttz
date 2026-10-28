import json
import logging
import secrets
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import jwt

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.auth import Principal, get_current_principal, get_optional_principal, require_role
from app.config import Settings, get_settings
from app.database import Base, engine, get_db
from app.models import Category, Order, Product, ProductVariant, RoleAssignment
from app.schemas import (
    AdminCategoryCreate,
    AdminCategoryUpdate,
    CategoryDeleteOut,
    AdminOrderOut,
    AdminOrderUpdate,
    AdminOverviewOut,
    AdminPaymentVerification,
    AdminProductCreate,
    AdminProductUpdate,
    AdminRoleAssign,
    AdminVariantCreate,
    AdminVariantUpdate,
    AdminLoginRequest,
    AdminLoginOut,
    AuthMeOut,
    CategoryOut,
    CheckoutOut,
    CheckoutRequest,
    ImageUploadOut,
    OrderSummaryOut,
    ProductListOut,
    ProductOut,
    RoleAssignmentOut,
    VariantOut,
)
from app.seed import seed
from app.services import admin_catalogue_products, catalogue_products, create_whatsapp_order, product_query

logger = logging.getLogger("floretttz")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed()
    yield


settings = get_settings()
app = FastAPI(
    title="FLORETTTZ API",
    version="0.2.0",
    description="Catalogue and WhatsApp-order handoff API for Floretttz. Online payments are not enabled.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https://([a-zA-Z0-9_-]+\.)?vercel\.app$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
)

from fastapi.staticfiles import StaticFiles
uploads_dir = Path(__file__).resolve().parent.parent.parent / "public" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")



@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "floretttz-api", "brand": "FLORETTTZ"}


@app.get("/api/community", tags=["community"])
def community_links(app_settings: Settings = Depends(get_settings)) -> dict[str, str]:
    return {
        "whatsapp_group_url": app_settings.whatsapp_group_url,
        "whatsapp_channel_url": app_settings.whatsapp_channel_url,
    }


@app.get("/api/auth/me", response_model=AuthMeOut, tags=["auth"])
def auth_me(principal: Principal = Depends(get_current_principal)) -> AuthMeOut:
    return AuthMeOut(user_id=principal.user_id, role=principal.role)


@app.post("/api/auth/admin-login", response_model=AdminLoginOut, tags=["auth"])
def admin_login(
    payload: AdminLoginRequest,
    db: Session = Depends(get_db),
    app_settings: Settings = Depends(get_settings),
) -> AdminLoginOut:
    """Authenticate administrator using server-configured credentials."""
    email_matches = payload.email.strip().lower() == app_settings.admin_email.strip().lower()
    password_matches = secrets.compare_digest(payload.password, app_settings.admin_password)

    if not (email_matches and password_matches):
        print(f"[LOGIN ATTEMPT FAILED] email_matches={email_matches} ({repr(payload.email)} vs {repr(app_settings.admin_email)}), password_matches={password_matches} (len={len(payload.password)} vs {len(app_settings.admin_password)})")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    user_id = "admin-ishupishu"
    assignment = db.scalar(select(RoleAssignment).where(RoleAssignment.user_id == user_id))
    if not assignment:
        assignment = RoleAssignment(user_id=user_id, role="admin")
        db.add(assignment)
        db.commit()
    elif assignment.role != "admin":
        assignment.role = "admin"
        db.commit()

    now = datetime.now(UTC)
    server_secret = app_settings.supabase_jwt_secret or app_settings.admin_bootstrap_token or "floretttz-secure-jwt-secret-local-dev-key"
    token_payload = {
        "sub": user_id,
        "email": app_settings.admin_email,
        "user_role": "admin",
        "role": "authenticated",
        "aud": app_settings.supabase_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=7)).timestamp()),
    }
    access_token = jwt.encode(token_payload, server_secret, algorithm="HS256")
    return AdminLoginOut(
        access_token=access_token,
        token_type="bearer",
        role="admin",
        email=app_settings.admin_email,
        user_id=user_id,
    )


@app.get("/api/categories", response_model=list[CategoryOut], tags=["catalogue"])
def list_categories(db: Session = Depends(get_db)) -> list[Category]:
    return db.scalars(select(Category).where(Category.archived.is_(False)).order_by(Category.name)).all()


@app.get("/api/products", response_model=ProductListOut, tags=["catalogue"])
def list_products(
    q: str | None = Query(default=None, min_length=1, max_length=100),
    category: str | None = Query(default=None, min_length=1, max_length=120),
    sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=48),
    db: Session = Depends(get_db),
) -> ProductListOut:
    products, total = catalogue_products(db, q, category, sort, page, page_size)
    return ProductListOut(items=products, total=total, page=page, page_size=page_size)


@app.get("/api/products/{slug}", response_model=ProductOut, tags=["catalogue"])
def get_product(slug: str, db: Session = Depends(get_db)) -> Product:
    product = db.scalar(product_query().where(Product.slug == slug, Product.published.is_(True)))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@app.post("/api/orders/whatsapp-handoff", response_model=CheckoutOut, status_code=status.HTTP_201_CREATED, tags=["orders"])
def whatsapp_handoff(
    checkout: CheckoutRequest,
    db: Session = Depends(get_db),
    app_settings: Settings = Depends(get_settings),
    principal: Principal | None = Depends(get_optional_principal),
) -> CheckoutOut:
    customer_id = principal.user_id if principal else None
    phone_len = len(checkout.customer_phone)
    masked_phone = f"{checkout.customer_phone[:3]}******{checkout.customer_phone[-4:]}" if phone_len >= 7 else "***"
    logger.info(
        "Received WhatsApp handoff request: items_count=%d, customer_name_len=%d, customer_phone=%s",
        len(checkout.items),
        len(checkout.customer_name),
        masked_phone,
    )
    order, whatsapp_url = create_whatsapp_order(db, checkout, app_settings, customer_id=customer_id)
    logger.info("Order %s created successfully with total %s", order.reference, order.total)
    return CheckoutOut(
        reference=order.reference,
        status="pending",
        total=order.total,
        whatsapp_url=whatsapp_url,
        message="Your order request is pending. Opening WhatsApp does not confirm acceptance or payment.",
    )


@app.get("/api/orders/me", response_model=list[OrderSummaryOut], tags=["orders"])
def my_orders(
    db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> list[Order]:
    return db.scalars(select(Order).where(Order.customer_id == principal.user_id).order_by(Order.created_at.desc())).all()


# --- Admin & Catalogue Management Endpoints ---


@app.get("/api/admin/overview", response_model=AdminOverviewOut, tags=["admin"])
def admin_overview(
    db: Session = Depends(get_db), _: Principal = Depends(require_role("catalog_manager", "admin"))
) -> AdminOverviewOut:
    products = db.scalars(select(Product)).all()
    categories = db.scalars(select(Category).where(Category.archived.is_(False))).all()
    orders = db.scalars(select(Order)).all()
    total_revenue = sum((order.total for order in orders if order.status != "cancelled"), 0)
    pending_orders = sum(1 for order in orders if order.status in {"pending", "awaiting_confirmation"})

    return AdminOverviewOut(
        total_products=len(products),
        published_products=sum(1 for p in products if p.published),
        draft_products=sum(1 for p in products if not p.published),
        total_categories=len(categories),
        total_orders=len(orders),
        pending_orders=pending_orders,
        total_revenue=total_revenue,
    )


@app.get("/api/admin/products", response_model=ProductListOut, tags=["admin"])
def admin_list_products(
    q: str | None = Query(default=None, min_length=1, max_length=100),
    category: str | None = Query(default=None, min_length=1, max_length=120),
    status_filter: str | None = Query(default=None, pattern="^(all|published|draft)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> ProductListOut:
    filter_arg = status_filter if status_filter in {"published", "draft"} else None
    products, total = admin_catalogue_products(db, q, category, filter_arg, page, page_size)
    return ProductListOut(items=products, total=total, page=page, page_size=page_size)


@app.post("/api/admin/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED, tags=["admin"])
def admin_create_product(
    payload: AdminProductCreate,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> Product:
    existing_sku = db.scalar(select(Product).where(Product.sku == payload.sku.strip()))
    if existing_sku:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A product with this SKU already exists")

    existing_slug = db.scalar(select(Product).where(Product.slug == payload.slug.strip()))
    if existing_slug:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A product with this slug already exists")

    if payload.published and payload.price is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A published product must have a confirmed price",
        )

    if payload.category_id:
        category = db.scalar(select(Category).where(Category.id == payload.category_id))
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    product = Product(
        sku=payload.sku.strip(),
        slug=payload.slug.strip(),
        name=payload.name.strip(),
        description=payload.description.strip(),
        price=payload.price,
        image_url=payload.image_url,
        published=payload.published,
        featured=payload.featured,
        available_for_order=payload.available_for_order,
        category_id=payload.category_id,
    )
    db.add(product)
    db.commit()
    return db.scalar(product_query().where(Product.id == product.id))


@app.patch("/api/admin/products/{product_id}", response_model=ProductOut, tags=["admin"])
@app.put("/api/admin/products/{product_id}", response_model=ProductOut, tags=["admin"])
def admin_update_product(
    product_id: int,
    update: AdminProductUpdate,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> Product:
    product = db.scalar(product_query().where(Product.id == product_id))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    data = update.model_dump(exclude_unset=True)

    if "slug" in data and data["slug"] and data["slug"] != product.slug:
        existing = db.scalar(select(Product).where(Product.slug == data["slug"], Product.id != product_id))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")

    if data.get("published") is True:
        target_price = data.get("price") if "price" in data else product.price
        has_variants = len(product.variants) > 0
        if target_price is None and not has_variants:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A published product must have a confirmed price or variants",
            )

    if "category_id" in data and data["category_id"] is not None:
        cat = db.scalar(select(Category).where(Category.id == data["category_id"]))
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    for key, value in data.items():
        if value is not None or key in {"price", "image_url", "category_id"}:
            setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product


@app.delete("/api/admin/products/{product_id}", tags=["admin"])
def admin_delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> dict[str, str]:
    product = db.scalar(select(Product).where(Product.id == product_id))
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for variant in list(product.variants):
        db.delete(variant)
    db.delete(product)
    db.commit()
    return {"status": "deleted", "id": str(product_id)}


@app.post("/api/admin/products/{product_id}/variants", response_model=VariantOut, status_code=status.HTTP_201_CREATED, tags=["admin"])
def admin_create_variant(
    product_id: int,
    payload: AdminVariantCreate,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> ProductVariant:
    product = db.scalar(select(Product).where(Product.id == product_id))
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    existing_sku = db.scalar(select(ProductVariant).where(ProductVariant.sku == payload.sku.strip()))
    if existing_sku:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Variant SKU already exists")

    variant = ProductVariant(
        product_id=product_id,
        sku=payload.sku.strip(),
        name=payload.name.strip(),
        price=payload.price,
        available_for_order=payload.available_for_order,
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


@app.patch("/api/admin/variants/{variant_id}", response_model=VariantOut, tags=["admin"])
def admin_update_variant(
    variant_id: int,
    payload: AdminVariantUpdate,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> ProductVariant:
    variant = db.scalar(select(ProductVariant).where(ProductVariant.id == variant_id))
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(variant, key, value)

    db.commit()
    db.refresh(variant)
    return variant


@app.delete("/api/admin/variants/{variant_id}", tags=["admin"])
def admin_delete_variant(
    variant_id: int,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> dict[str, str]:
    variant = db.scalar(select(ProductVariant).where(ProductVariant.id == variant_id))
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    db.delete(variant)
    db.commit()
    return {"status": "deleted", "id": str(variant_id)}


@app.post("/api/admin/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED, tags=["admin"])
def admin_create_category(
    payload: AdminCategoryCreate,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> Category:
    existing = db.scalar(select(Category).where((Category.slug == payload.slug.strip()) | (Category.name == payload.name.strip())))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category slug or name already exists")

    category = Category(
        slug=payload.slug.strip(),
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@app.patch("/api/admin/categories/{category_id}", response_model=CategoryOut, tags=["admin"])
def admin_update_category(
    category_id: int,
    payload: AdminCategoryUpdate,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> Category:
    category = db.scalar(select(Category).where(Category.id == category_id))
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if payload.slug is not None:
        clean_slug = payload.slug.strip()
        if clean_slug:
            conflict = db.scalar(
                select(Category).where(Category.slug == clean_slug, Category.id != category_id)
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Category slug already in use by another category",
                )
            category.slug = clean_slug

    if payload.name is not None:
        clean_name = payload.name.strip()
        if clean_name:
            conflict = db.scalar(
                select(Category).where(Category.name == clean_name, Category.id != category_id)
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Category name already in use by another category",
                )
            category.name = clean_name

    if payload.description is not None:
        category.description = payload.description.strip() if payload.description.strip() else None

    if payload.archived is not None:
        category.archived = payload.archived

    db.commit()
    db.refresh(category)
    return category


@app.get("/api/admin/categories/{category_id}/product-count", tags=["admin"])
def admin_get_category_product_count(
    category_id: int,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> dict:
    category = db.scalar(select(Category).where(Category.id == category_id))
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    count = db.scalar(select(func.count(Product.id)).where(Product.category_id == category_id)) or 0
    return {"category_id": category_id, "product_count": count}


@app.delete("/api/admin/categories/{category_id}", response_model=CategoryDeleteOut, tags=["admin"])
def admin_delete_category(
    category_id: int,
    reassign_to_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
) -> CategoryDeleteOut:
    category = db.scalar(select(Category).where(Category.id == category_id))
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    product_count = db.scalar(select(func.count(Product.id)).where(Product.category_id == category_id)) or 0

    if product_count > 0:
        if reassign_to_id is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete category: {product_count} associated product(s) are assigned to it. Please reassign them to another category first.",
            )
        if reassign_to_id == category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reassign products to the same category being deleted",
            )
        target_cat = db.scalar(select(Category).where(Category.id == reassign_to_id))
        if not target_cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reassignment target category not found",
            )
        db.execute(update(Product).where(Product.category_id == category_id).values(category_id=reassign_to_id))
        db.flush()

    db.delete(category)
    db.commit()
    return CategoryDeleteOut(
        status="deleted",
        id=category_id,
        reassigned_products=product_count if reassign_to_id is not None else 0,
    )



@app.get("/api/admin/orders", response_model=list[AdminOrderOut], tags=["admin"])
def admin_list_orders(
    status_filter: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("admin")),
) -> list[Order]:
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    if status_filter:
        query = query.where(Order.status == status_filter)
    return db.scalars(query).all()


@app.patch("/api/admin/orders/{order_id}", response_model=AdminOrderOut, tags=["admin"])
def admin_update_order(
    order_id: int,
    payload: AdminOrderUpdate,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("admin")),
) -> Order:
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    order.status = payload.status
    db.commit()
    db.refresh(order)
    return order


@app.get("/api/admin/roles", response_model=list[RoleAssignmentOut], tags=["admin"])
def admin_list_roles(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("admin")),
) -> list[RoleAssignment]:
    return db.scalars(select(RoleAssignment).order_by(RoleAssignment.created_at.desc())).all()


@app.post("/api/admin/roles", response_model=RoleAssignmentOut, tags=["admin"])
def admin_assign_role(
    payload: AdminRoleAssign,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("admin")),
) -> RoleAssignment:
    assignment = db.scalar(select(RoleAssignment).where(RoleAssignment.user_id == payload.user_id.strip()))
    if assignment:
        assignment.role = payload.role
    else:
        assignment = RoleAssignment(user_id=payload.user_id.strip(), role=payload.role)
        db.add(assignment)

    db.commit()
    db.refresh(assignment)
    return assignment


@app.post("/api/admin/upload-image", response_model=ImageUploadOut, tags=["admin"])
async def admin_upload_image(
    file: UploadFile = File(...),
    _: Principal = Depends(require_role("catalog_manager", "admin")),
    app_settings: Settings = Depends(get_settings),
) -> ImageUploadOut:
    max_size = 5 * 1024 * 1024  # 5MB
    content = await file.read()

    if len(content) > max_size:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image must be under 5MB")

    # Magic byte verification
    if content.startswith(b"\xff\xd8\xff"):
        ext = "jpg"
        mime = "image/jpeg"
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):
        ext = "png"
        mime = "image/png"
    elif content.startswith(b"RIFF") and b"WEBP" in content[8:16]:
        ext = "webp"
        mime = "image/webp"
    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported image format. Only JPEG, PNG, and WebP are accepted.",
        )

    # Upload to a unique, persistent Storage object. Do not fall back to local disk.
    filename = f"{uuid4().hex}.{ext}"
    if (
        not app_settings.supabase_url
        or not app_settings.supabase_service_role_key
        or app_settings.supabase_service_role_key.startswith("replace-with")
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Product image storage is not configured",
        )

    import httpx

    sb_url = app_settings.supabase_url.rstrip("/")
    storage_endpoint = f"{sb_url}/storage/v1/object/product-images/products/{filename}"
    headers = {
        "Authorization": f"Bearer {app_settings.supabase_service_role_key}",
        "apikey": app_settings.supabase_service_role_key,
        "Content-Type": mime,
        "x-upsert": "false",
    }
    try:
        resp = httpx.post(storage_endpoint, content=content, headers=headers, timeout=10.0)
    except httpx.HTTPError as exc:
        logger.warning("Supabase Storage upload failed due to a transport error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Product image storage is temporarily unavailable",
        ) from exc

    if resp.status_code not in (200, 201):
        logger.warning("Supabase Storage upload returned HTTP %s", resp.status_code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Product image storage rejected the upload",
        )

    final_url = f"{sb_url}/storage/v1/object/public/product-images/products/{filename}"
    return ImageUploadOut(
        filename=filename,
        url=final_url,
        size_bytes=len(content),
        mime_type=mime,
    )



@app.get("/api/admin/notion/status", tags=["admin"])
def admin_notion_status(
    _: Principal = Depends(require_role("admin")),
    settings: Settings = Depends(get_settings),
) -> dict:
    from app.notion import NotionService
    svc = NotionService(settings.notion_api_key, settings.notion_database_id)
    return svc.check_connection()


@app.post("/api/admin/notion/sync/{order_id}", tags=["admin"])
def admin_sync_order_to_notion(
    order_id: int,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_role("admin")),
    settings: Settings = Depends(get_settings),
) -> dict:
    order = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    from app.notion import NotionService
    svc = NotionService(settings.notion_api_key, settings.notion_database_id)
    items_summary = "\n".join(
        f"• {item.product_name}" + (f" ({item.variant_name})" if item.variant_name else "") + f" × {item.quantity}"
        for item in order.items
    )
    return svc.sync_order({
        "reference": order.reference,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "items_summary": items_summary,
        "total": float(order.total),
        "status": order.status,
        "idempotency_key": order.idempotency_key,
    })


@app.get("/api/whatsapp/webhook", tags=["whatsapp"])
def whatsapp_webhook_verify(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> Response:
    """Handle Meta WhatsApp Cloud API webhook verification handshake."""
    hub_mode = request.query_params.get("hub.mode")
    hub_token = request.query_params.get("hub.verify_token")
    hub_challenge = request.query_params.get("hub.challenge")

    from app.whatsapp import WhatsAppCloudAPIService
    svc = WhatsAppCloudAPIService(
        access_token=settings.whatsapp_cloud_api_token,
        phone_number_id=settings.whatsapp_phone_number_id,
        app_secret=settings.whatsapp_app_secret,
        webhook_verify_token=settings.whatsapp_webhook_verify_token,
    )
    result = svc.verify_webhook_challenge(hub_mode, hub_token, hub_challenge)
    if result:
        return Response(content=result, media_type="text/plain")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch or invalid mode")


@app.post("/api/whatsapp/webhook", tags=["whatsapp"])
async def whatsapp_webhook_event(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Handle incoming WhatsApp Cloud API events (messages, payment screenshots)."""
    body_bytes = await request.body()
    sig_header = request.headers.get("x-hub-signature-256")

    from app.whatsapp import WhatsAppCloudAPIService
    svc = WhatsAppCloudAPIService(
        access_token=settings.whatsapp_cloud_api_token,
        phone_number_id=settings.whatsapp_phone_number_id,
        app_secret=settings.whatsapp_app_secret,
        webhook_verify_token=settings.whatsapp_webhook_verify_token,
    )
    if settings.whatsapp_app_secret and not svc.validate_signature(body_bytes, sig_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    try:
        payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    results = svc.process_incoming_messages(db, payload, settings)
    return {"status": "ok", "results": results}


@app.post("/api/admin/orders/{order_id}/verify-payment", response_model=AdminOrderOut, tags=["admin"])
def admin_verify_payment(
    order_id: int,
    payload: AdminPaymentVerification,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_role("admin")),
) -> Order:
    """Verify or reject payment screenshot for an order with full audit attribution."""
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if payload.action == "verify":
        order.status = "confirmed"
    elif payload.action == "reject":
        order.status = "cancelled"

    order.payment_verified_by = principal.user_id
    order.payment_verified_at = datetime.now(UTC)

    db.commit()
    db.refresh(order)
    return order


@app.get("/api/admin/settings/status", tags=["admin"])
def admin_settings_status(
    _: Principal = Depends(require_role("admin")),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Inspect integration health and configuration status without exposing credentials."""
    return settings.get_redacted_status()


