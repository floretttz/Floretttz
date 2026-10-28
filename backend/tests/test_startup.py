from fastapi.testclient import TestClient
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
