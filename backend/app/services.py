from datetime import UTC, datetime
from decimal import Decimal
from urllib.parse import quote
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.models import Order, OrderItem, Product, ProductVariant
from app.schemas import CheckoutRequest


def product_query() -> Select[tuple[Product]]:
    return select(Product).options(selectinload(Product.category), selectinload(Product.variants))


def catalogue_products(
    db: Session, search_term: str | None, category_slug: str | None, sort: str, page: int, page_size: int
) -> tuple[list[Product], int]:
    query = product_query().where(Product.published.is_(True))
    count_query = select(func.count(Product.id)).where(Product.published.is_(True))
    if search_term:
        needle = f"%{search_term.strip()}%"
        predicate = Product.name.ilike(needle) | Product.description.ilike(needle) | Product.sku.ilike(needle)
        query = query.where(predicate)
        count_query = count_query.where(predicate)
    if category_slug:
        query = query.where(Product.category.has(slug=category_slug))
        count_query = count_query.where(Product.category.has(slug=category_slug))
    if sort == "price_asc":
        query = query.order_by(Product.price.asc().nullslast(), Product.name.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc().nullslast(), Product.name.asc())
    else:
        query = query.order_by(Product.created_at.desc(), Product.id.desc())
    total = db.scalar(count_query) or 0
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return items, total


def admin_catalogue_products(
    db: Session,
    search_term: str | None = None,
    category_slug: str | None = None,
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[Product], int]:
    query = product_query()
    count_query = select(func.count(Product.id))
    if search_term:
        needle = f"%{search_term.strip()}%"
        predicate = Product.name.ilike(needle) | Product.description.ilike(needle) | Product.sku.ilike(needle)
        query = query.where(predicate)
        count_query = count_query.where(predicate)
    if category_slug:
        query = query.where(Product.category.has(slug=category_slug))
        count_query = count_query.where(Product.category.has(slug=category_slug))
    if status_filter == "published":
        query = query.where(Product.published.is_(True))
        count_query = count_query.where(Product.published.is_(True))
    elif status_filter == "draft":
        query = query.where(Product.published.is_(False))
        count_query = count_query.where(Product.published.is_(False))

    query = query.order_by(Product.created_at.desc(), Product.id.desc())
    total = db.scalar(count_query) or 0
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return items, total


def create_whatsapp_order(db: Session, checkout: CheckoutRequest, settings: Settings, customer_id: str | None = None) -> tuple[Order, str]:
    existing = db.scalar(select(Order).where(Order.idempotency_key == checkout.idempotency_key))
    if existing:
        return existing, build_whatsapp_url(existing, settings)

    resolved: list[tuple[Product, ProductVariant | None, int]] = []
    seen: set[tuple[int, int | None]] = set()
    for requested in checkout.items:
        key = (requested.product_id, requested.variant_id)
        if key in seen:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Duplicate cart item")
        seen.add(key)
        product = db.scalar(product_query().where(Product.id == requested.product_id))
        if product is None or not product.published or not product.available_for_order:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="One or more products are unavailable")
        variant = None
        if requested.variant_id is not None:
            variant = next((item for item in product.variants if item.id == requested.variant_id), None)
            if variant is None or not variant.available_for_order:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Selected product option is unavailable")
        if variant is None and product.price is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product price needs confirmation")
        resolved.append((product, variant, requested.quantity))

    total = sum((item[1].price if item[1] else item[0].price) * item[2] for item in resolved)
    reference = f"FLR-{datetime.now(UTC):%Y%m%d}-{uuid4().hex[:6].upper()}"
    order = Order(
        reference=reference,
        customer_id=customer_id,
        customer_name=checkout.customer_name.strip(),
        customer_phone=checkout.customer_phone.strip(),
        status="pending",
        total=Decimal(total),
        idempotency_key=checkout.idempotency_key,
    )
    for product, variant, quantity in resolved:
        unit_price = variant.price if variant else product.price
        order.items.append(
            OrderItem(
                product_id=product.id,
                variant_id=variant.id if variant else None,
                product_name=product.name,
                variant_name=variant.name if variant else None,
                quantity=quantity,
                unit_price=unit_price,
            )
        )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Sync to Notion Orders database if integration is configured
    try:
        from app.notion import NotionService
        notion_svc = NotionService(settings.notion_api_key, settings.notion_database_id)
        if notion_svc.is_configured:
            items_summary = "\n".join(
                f"• {item.product_name}" + (f" ({item.variant_name})" if item.variant_name else "") + f" × {item.quantity}"
                for item in order.items
            )
            notion_svc.sync_order({
                "reference": order.reference,
                "customer_name": order.customer_name,
                "customer_phone": order.customer_phone,
                "items_summary": items_summary,
                "total": float(order.total),
                "status": order.status,
                "idempotency_key": order.idempotency_key,
            })
    except Exception:
        # Non-blocking: External API downtime must not fail customer checkout
        pass

    return order, build_whatsapp_url(order, settings)


def build_whatsapp_url(order: Order, settings: Settings) -> str:
    lines = [f"Hello Floretttz! I would like to place order {order.reference}.", ""]
    for item in order.items:
        variant = f" — {item.variant_name}" if item.variant_name else ""
        lines.append(f"• {item.product_name}{variant} × {item.quantity} — ₹{item.unit_price * item.quantity}")
    lines.extend(["", f"Total: ₹{order.total}", "Please confirm availability and next steps."])
    return f"https://wa.me/{settings.whatsapp_number}?text={quote(chr(10).join(lines))}"

