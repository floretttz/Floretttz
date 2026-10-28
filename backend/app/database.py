from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


from urllib.parse import quote, quote_plus, unquote, urlparse


def extract_project_ref(supabase_url: str | None) -> str | None:
    """Extract project ref identifier from Supabase project URL."""
    if not supabase_url:
        return None
    try:
        parsed = urlparse(supabase_url.strip())
        hostname = parsed.hostname or ""
        if ".supabase." in hostname:
            return hostname.split(".")[0]
    except Exception:
        pass
    return None


def normalize_database_url(raw_url: str, supabase_url: str | None = None) -> str:
    """Normalize database URL for SQLAlchemy compatibility.
    
    1. Converts postgres:// -> postgresql://
    2. Corrects password encoding for special characters (@, #, etc.)
    3. When connecting to Supabase Pooler (*.pooler.supabase.com) with generic user 'postgres',
       automatically formats username as postgres.<project-ref>.
    """
    url = raw_url.strip()
    if not url or url.startswith("sqlite"):
        return url

    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")

    # Handle credential encoding and pooler username routing
    if "://" in url and "@" in url:
        scheme, rest = url.split("://", 1)
        userinfo, host_path = rest.rsplit("@", 1)
        if ":" in userinfo:
            user, password = userinfo.split(":", 1)
            raw_user = unquote(user)
            raw_password = unquote(password)

            # Check if this is Supabase Pooler (e.g. aws-0-ap-northeast-2.pooler.supabase.com)
            if "pooler.supabase.com" in host_path:
                if raw_user == "postgres":
                    proj_ref = extract_project_ref(supabase_url)
                    if proj_ref:
                        raw_user = f"postgres.{proj_ref}"

            quoted_user = quote(raw_user, safe=".")
            quoted_password = quote_plus(raw_password)
            url = f"{scheme}://{quoted_user}:{quoted_password}@{host_path}"

    return url


def validate_database_url(raw_url: str, supabase_url: str | None = None) -> str:
    """Validate and normalize a database URL without exposing credentials."""
    normalized = normalize_database_url(raw_url, supabase_url)
    if not normalized:
        raise ValueError("Database URL is empty; set FLORETTTZ_DATABASE_URL")
    if normalized.startswith("sqlite"):
        return normalized

    parsed = urlparse(normalized)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("Database URL must use sqlite, postgres, or postgresql")
    if not parsed.hostname:
        raise ValueError("PostgreSQL database URL must include a host")
    if not parsed.username or parsed.password is None:
        raise ValueError("PostgreSQL database URL must include a username and password")
    if parsed.port is None:
        raise ValueError("PostgreSQL database URL must include a port")
    if "pooler.supabase.com" in parsed.hostname and parsed.port not in {5432, 6543}:
        raise ValueError("Supabase pooler database URL must use port 5432 or 6543")
    return normalized


def get_safe_db_host(url: str | None = None) -> str:
    """Return safe host and port without exposing passwords or tokens."""
    target = url or _engine_url()
    if target.startswith("sqlite"):
        return "sqlite"
    try:
        parsed = urlparse(target)
        return f"{parsed.hostname or 'unknown'}:{parsed.port or 'default'}"
    except Exception:
        return "[redacted-host]"


def _engine_url() -> str:
    settings = get_settings()
    return validate_database_url(settings.database_url, settings.supabase_url)


def create_app_engine(url: str | None = None):
    settings = get_settings()
    target_url = validate_database_url(url or settings.database_url, settings.supabase_url)
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
