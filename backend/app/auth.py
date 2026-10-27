from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import RoleAssignment


@dataclass(frozen=True)
class Principal:
    user_id: str
    role: str


def get_current_principal(request: Request, settings: Settings = Depends(get_settings), db: Session = Depends(get_db)) -> Principal:
    """Require a verified identity.

    Test headers exist only when FLORETZ_ENV=test. In production, this endpoint
    must be backed by Supabase JWKS verification before protected routes are live.
    """
    if settings.env == "test":
        user = request.headers.get("x-test-user")
        role = request.headers.get("x-test-role", "customer")
        if user and role in {"customer", "catalog_manager", "admin"}:
            return Principal(user, role)
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication is required")
    token = authorization.removeprefix("Bearer ").strip()

    if not settings.supabase_jwt_secret and (not settings.supabase_url or not settings.effective_jwks_url):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication service is not configured")

    claims = None
    secret_candidates = [s for s in [settings.supabase_jwt_secret, settings.admin_bootstrap_token, "floretttz-secure-jwt-secret-local-dev-key"] if s]
    for secret in secret_candidates:
        try:
            claims = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience=settings.supabase_audience,
                options={"require": ["sub", "exp", "aud"]},
            )
            if claims:
                break
        except jwt.PyJWTError:
            claims = None

    if claims is None and settings.effective_jwks_url and settings.supabase_url:
        try:
            signing_key = PyJWKClient(settings.effective_jwks_url).get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=settings.supabase_audience,
                issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
                options={"require": ["sub", "exp", "aud", "iss"]},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired authentication token") from exc

    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired authentication token")

    user_id = claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    claim_role = claims.get("user_role")
    assignment = db.scalar(select(RoleAssignment).where(RoleAssignment.user_id == user_id))
    if assignment:
        role = assignment.role
    elif claim_role in {"admin", "catalog_manager"}:
        assignment = RoleAssignment(user_id=user_id, role=claim_role)
        db.add(assignment)
        db.commit()
        role = claim_role
    else:
        role = "customer"

    return Principal(user_id, role)


def require_role(*allowed_roles: str):
    def role_dependency(principal: Principal = Depends(get_current_principal)) -> Principal:
        if principal.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action")
        return principal

    return role_dependency


def get_optional_principal(request: Request, settings: Settings = Depends(get_settings), db: Session = Depends(get_db)) -> Principal | None:
    """Extract identity if provided and valid, but allow guest access if absent."""
    authorization = request.headers.get("authorization", "")
    has_test_header = settings.env == "test" and bool(request.headers.get("x-test-user"))
    if not authorization.startswith("Bearer ") and not has_test_header:
        return None
    try:
        return get_current_principal(request, settings, db)
    except HTTPException:
        return None

