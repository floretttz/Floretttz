from fastapi.testclient import TestClient

import pytest

from app.database import normalize_database_url, validate_database_url
from sqlalchemy.orm import configure_mappers

from app.database import Base
from app.main import app
from app.models import Category, Order, OrderItem, Product, ProductVariant, RoleAssignment


def test_models_import_and_mappers_initialize():
    """Smoke test: verify that all SQLAlchemy models and annotations compile cleanly."""
    configure_mappers()

    # Verify registered tables in metadata
    registered_tables = set(Base.metadata.tables.keys())
    expected_tables = {
        "categories",
        "products",
        "product_variants",
        "role_assignments",
        "orders",
        "order_items",
    }
    assert expected_tables.issubset(registered_tables), f"Missing tables: {expected_tables - registered_tables}"

    # Verify model relationships resolve without typing or mapper errors
    assert hasattr(Category, "products")
    assert hasattr(Product, "category")
    assert hasattr(Product, "variants")
    assert hasattr(ProductVariant, "product")
    assert hasattr(Order, "items")
    assert hasattr(OrderItem, "order")


def test_application_imports_and_health_endpoint_responds():
    """Verify that FastAPI application initializes and health check succeeds."""
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["brand"] == "FLORETTTZ"


def test_pooler_url_uses_project_scoped_username_and_encodes_password():
    normalized = normalize_database_url(
        "postgresql://postgres:p%40ss%23word@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres",
        "https://tzemepkyhzxhtiohdcrh.supabase.co",
    )

    assert normalized.startswith(
        "postgresql://postgres.tzemepkyhzxhtiohdcrh:p%40ss%23word@"
    )


@pytest.mark.parametrize(
    "url, message",
    [
        ("", "empty"),
        ("postgresql://postgres@db.example.com:5432/postgres", "username and password"),
        ("postgresql://user:password@db.example.com/postgres", "include a port"),
    ],
)
def test_database_url_validation_rejects_malformed_settings(url, message):
    with pytest.raises(ValueError, match=message):
        validate_database_url(url)
