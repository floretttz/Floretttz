from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.phone import normalize_indian_mobile


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    name: str
    description: str | None = None


class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    name: str
    price: Decimal
    available_for_order: bool


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    slug: str
    name: str
    description: str
    price: Decimal | None
    image_url: str | None = None
    published: bool
    featured: bool
    available_for_order: bool
    category: CategoryOut | None = None
    variants: list[VariantOut] = []
    created_at: datetime


class ProductListOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int


class CheckoutItem(BaseModel):
    product_id: int = Field(gt=0)
    variant_id: int | None = Field(default=None, gt=0)
    quantity: int = Field(ge=1, le=20)
    personalisation: str | None = Field(default=None, max_length=280)

class CheckoutRequest(BaseModel):
    customer_name: str = Field(min_length=2, max_length=160)
    customer_phone: str = Field(min_length=8, max_length=30)
    items: list[CheckoutItem] = Field(min_length=1, max_length=30)
    idempotency_key: str = Field(min_length=12, max_length=120)

    @field_validator("customer_phone")
    @classmethod
    def phone_characters(cls, value: str) -> str:
        return normalize_indian_mobile(value)


class CheckoutOut(BaseModel):
    reference: str
    status: Literal["pending", "awaiting_confirmation"]
    total: Decimal
    whatsapp_url: str
    message: str


class OrderSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    reference: str
    status: str
    total: Decimal
    created_at: datetime


class AdminProductCreate(BaseModel):
    sku: str = Field(min_length=3, max_length=80)
    slug: str = Field(min_length=2, max_length=160)
    name: str = Field(min_length=2, max_length=180)
    description: str = Field(default="Handmade Floretttz piece. Details will be added by the catalogue team.")
    price: Decimal | None = None
    image_url: str | None = None
    published: bool = False
    featured: bool = False
    available_for_order: bool = False
    category_id: int | None = None


class AdminProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    price: Decimal | None = None
    image_url: str | None = None
    published: bool | None = None
    available_for_order: bool | None = None
    featured: bool | None = None
    category_id: int | None = None


class AdminVariantCreate(BaseModel):
    sku: str = Field(min_length=3, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    price: Decimal = Field(ge=0)
    available_for_order: bool = True


class AdminVariantUpdate(BaseModel):
    name: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    available_for_order: bool | None = None


class AdminCategoryCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=120)
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None


class AdminCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    archived: bool | None = None


class AdminOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    variant_id: int | None = None
    product_name: str
    variant_name: str | None = None
    quantity: int
    unit_price: Decimal


class AdminOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reference: str
    customer_id: str | None = None
    customer_name: str
    customer_phone: str
    status: str
    total: Decimal
    idempotency_key: str
    payment_screenshot_url: str | None = None
    payment_verified_by: str | None = None
    payment_verified_at: datetime | None = None
    created_at: datetime
    items: list[AdminOrderItemOut] = []


class AdminOrderUpdate(BaseModel):
    status: Literal[
        "pending",
        "pending_verification",
        "awaiting_confirmation",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
    ]


class AdminPaymentVerification(BaseModel):
    action: Literal["verify", "reject"]
    note: str | None = Field(default=None, max_length=500)


class AdminRoleAssign(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)
    role: Literal["customer", "catalog_manager", "admin"]


class RoleAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: str
    role: str
    created_at: datetime


class AdminOverviewOut(BaseModel):
    total_products: int
    published_products: int
    draft_products: int
    total_categories: int
    total_orders: int
    pending_orders: int
    total_revenue: Decimal


class AuthMeOut(BaseModel):
    user_id: str
    role: str


class AdminLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=255)


class AdminLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    user_id: str


class ImageUploadOut(BaseModel):
    filename: str
    url: str
    size_bytes: int
    mime_type: str


class ErrorOut(BaseModel):
    detail: str
