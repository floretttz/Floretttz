from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def normalize_database_url(raw_url: str) -> str:
    """Normalize database URL for SQLAlchemy compatibility."""
    url = raw_url.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    return url


def _engine_url() -> str:
    return normalize_database_url(get_settings().database_url)


def create_app_engine(url: str | None = None):
    target_url = normalize_database_url(url or get_settings().database_url)
    if target_url.startswith("sqlite"):
        return create_engine(
            target_url,
            connect_args={"check_same_thread": False},
        )
    # Production / Cloud PostgreSQL (Supabase, Render)
    connect_args = {}
    if "sslmode=" not in target_url and any(domain in target_url for domain in ("supabase.co", "supabase.com", "pooler.supabase.com", "render.com")):
        connect_args["sslmode"] = "require"
    return create_engine(
        target_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=5,
        pool_recycle=300,
        connect_args=connect_args,
    )


engine = create_app_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
