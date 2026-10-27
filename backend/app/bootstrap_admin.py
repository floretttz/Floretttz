"""Controlled CLI for assigning the first privileged role.

Run only in a trusted server environment:
FLORETTTZ_ADMIN_BOOTSTRAP_TOKEN=... python -m app.bootstrap_admin --user-id <Supabase UUID> --token ...
"""
import argparse
import os
import secrets

from app.database import Base, SessionLocal, engine
from app.models import RoleAssignment


def main() -> None:
    parser = argparse.ArgumentParser(description="Assign a Floretttz admin role using an out-of-band bootstrap token.")
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--token", required=True)
    arguments = parser.parse_args()
    expected = os.environ.get("FLORETTTZ_ADMIN_BOOTSTRAP_TOKEN") or os.environ.get("FLORETZ_ADMIN_BOOTSTRAP_TOKEN")
    if not expected or not secrets.compare_digest(arguments.token, expected):
        raise SystemExit("Bootstrap token rejected")
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        role = db.query(RoleAssignment).filter_by(user_id=arguments.user_id).one_or_none()
        if role is None:
            role = RoleAssignment(user_id=arguments.user_id, role="admin")
            db.add(role)
        else:
            role.role = "admin"
        db.commit()
    print("Admin role assigned")


if __name__ == "__main__":
    main()
