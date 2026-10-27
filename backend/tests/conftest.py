import os

os.environ["FLORETZ_ENV"] = "test"
os.environ["FLORETTTZ_ENV"] = "test"
os.environ["FLORETZ_DATABASE_URL"] = "sqlite:///./test_floretz.db"
os.environ["FLORETTTZ_DATABASE_URL"] = "sqlite:///./test_floretz.db"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.seed import seed

get_settings.cache_clear()

test_engine = create_engine("sqlite:///./test_floretz.db", connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


def override_get_db():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    seed(bind_engine=test_engine, session_maker=TestSessionLocal)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
