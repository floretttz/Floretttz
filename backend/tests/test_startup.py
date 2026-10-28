from fastapi.testclient import TestClient

from app.main import app


def test_application_imports_and_health_endpoint_responds():
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
