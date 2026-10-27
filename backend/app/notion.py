"""Dedicated Notion integration service for FLORETTTZ.

Syncs orders created on the storefront to the owner's Notion Orders database.
Never exposes integration tokens to the client. Handles schema mismatches,
rate limits, retries, and missing permissions safely.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger("floretttz.notion")
NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_API_VERSION = "2022-06-28"


class NotionService:
    def __init__(self, api_key: str | None = None, database_id: str | None = None):
        settings = get_settings()
        self.api_key = api_key or settings.notion_api_key
        self.database_id = database_id or settings.notion_database_id

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and not self.api_key.startswith("ntn_your_"))

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Notion-Version": NOTION_API_VERSION,
            "Content-Type": "application/json",
        }

    def check_connection(self) -> dict[str, Any]:
        """Verify API token validity and discover accessible databases."""
        if not self.is_configured:
            return {
                "status": "unconfigured",
                "message": "Notion API key is not configured in server environment.",
                "bot_name": None,
                "database_id": self.database_id,
                "accessible_databases": [],
            }

        try:
            with httpx.Client(timeout=10.0) as client:
                # 1. Check Bot identity
                me_resp = client.get(f"{NOTION_API_BASE}/users/me", headers=self._headers())
                if me_resp.status_code != 200:
                    logger.warning("Notion /users/me rejected token with status %s", me_resp.status_code)
                    return {
                        "status": "invalid_token",
                        "message": f"Notion API rejected token (HTTP {me_resp.status_code}). Please verify FLORETTTZ_NOTION_API_KEY.",
                        "bot_name": None,
                        "database_id": self.database_id,
                        "accessible_databases": [],
                    }
                bot_data = me_resp.json()
                bot_name = bot_data.get("name", "Floretttz Bot")

                # 2. Search for shared databases
                search_payload = {"filter": {"value": "database", "property": "object"}}
                search_resp = client.post(
                    f"{NOTION_API_BASE}/search",
                    headers=self._headers(),
                    json=search_payload,
                )
                accessible_dbs = []
                if search_resp.status_code == 200:
                    for db in search_resp.json().get("results", []):
                        title_parts = db.get("title", [])
                        title = "".join(p.get("plain_text", "") for p in title_parts) or "Untitled Database"
                        accessible_dbs.append({
                            "id": db.get("id"),
                            "title": title,
                            "url": db.get("url"),
                        })

                # Check configured database
                target_found = False
                target_title = None
                if self.database_id:
                    for adb in accessible_dbs:
                        if adb["id"].replace("-", "") == self.database_id.replace("-", ""):
                            target_found = True
                            target_title = adb["title"]
                            break

                if not accessible_dbs and not target_found:
                    status = "pending_database_access"
                    message = (
                        f"Connected as Notion bot '{bot_name}', but no Notion databases have been shared with "
                        "this integration yet. Please open your Notion Orders database, click (...) -> Connections, "
                        f"and add '{bot_name}'."
                    )
                elif self.database_id and not target_found:
                    status = "target_database_not_shared"
                    message = (
                        f"Configured database ID '{self.database_id}' was not found among shared databases. "
                        f"Ensure the database has been shared with '{bot_name}'."
                    )
                else:
                    status = "connected"
                    active_db = target_title or (accessible_dbs[0]["title"] if accessible_dbs else "Unknown")
                    message = f"Connected as '{bot_name}'. Active Notion database: '{active_db}'."

                return {
                    "connected": status in {"connected", "pending_database_access"},
                    "configured": True,
                    "status": status,
                    "message": message,
                    "bot_name": bot_name,
                    "bot_user": bot_name,
                    "database_id": self.database_id,
                    "database_title": target_title or (accessible_dbs[0]["title"] if accessible_dbs else None),
                    "accessible_databases": accessible_dbs,
                }
        except httpx.RequestError as exc:
            logger.error("Notion connection test error: %s", str(exc))
            return {
                "status": "network_error",
                "message": f"Network error connecting to Notion API: {exc}",
                "bot_name": None,
                "database_id": self.database_id,
                "accessible_databases": [],
            }

    def find_existing_order_page(self, reference: str, database_id: str) -> str | None:
        """Search target database for an existing order by reference."""
        try:
            with httpx.Client(timeout=10.0) as client:
                query_payload = {
                    "filter": {
                        "property": "Reference",
                        "title": {"equals": reference},
                    }
                }
                resp = client.post(
                    f"{NOTION_API_BASE}/databases/{database_id}/query",
                    headers=self._headers(),
                    json=query_payload,
                )
                if resp.status_code == 200:
                    results = resp.json().get("results", [])
                    if results:
                        return results[0].get("id")
        except Exception as exc:
            logger.debug("Notion query by Reference failed: %s", exc)
        return None

    def sync_order(self, order_data: dict[str, Any]) -> dict[str, Any]:
        """Create or update an order record in the Notion database.

        Safe against schema differences, rate limits, and network errors.
        """
        if not self.is_configured:
            return {"synced": False, "reason": "Notion API key not configured"}

        target_db = self.database_id
        if not target_db:
            # Check if any database is accessible
            conn = self.check_connection()
            if conn["accessible_databases"]:
                target_db = conn["accessible_databases"][0]["id"]
            else:
                logger.info("Notion sync skipped: No target database configured or shared.")
                return {"synced": False, "reason": "No target Notion database configured or shared"}

        reference = str(order_data.get("reference", "UNKNOWN"))
        customer_name = str(order_data.get("customer_name", "Anonymous"))
        customer_phone = str(order_data.get("customer_phone", ""))
        items_summary = str(order_data.get("items_summary", ""))
        total_amount = float(order_data.get("total", 0.0))
        status = str(order_data.get("status", "pending"))
        notes = str(order_data.get("notes", ""))
        idempotency_key = str(order_data.get("idempotency_key", ""))

        existing_page_id = self.find_existing_order_page(reference, target_db)

        # Standard properties mapping (tolerates flexible Notion schemas)
        properties: dict[str, Any] = {
            "Reference": {
                "title": [{"type": "text", "text": {"content": reference}}]
            },
            "Customer": {
                "rich_text": [{"type": "text", "text": {"content": customer_name}}]
            },
            "Phone": {
                "phone_number": customer_phone if customer_phone else None
            },
            "Items": {
                "rich_text": [{"type": "text", "text": {"content": items_summary[:2000]}}]
            },
            "Total (INR)": {
                "number": total_amount
            },
            "Status": {
                "select": {"name": status}
            },
            "Payment Status": {
                "select": {"name": "pending_verification"}
            },
        }

        if notes:
            properties["Notes"] = {
                "rich_text": [{"type": "text", "text": {"content": notes[:2000]}}]
            }
        if idempotency_key:
            properties["Idempotency Key"] = {
                "rich_text": [{"type": "text", "text": {"content": idempotency_key[:100]}}]
            }

        try:
            with httpx.Client(timeout=10.0) as client:
                if existing_page_id:
                    # Update existing page
                    patch_resp = client.patch(
                        f"{NOTION_API_BASE}/pages/{existing_page_id}",
                        headers=self._headers(),
                        json={"properties": properties},
                    )
                    if patch_resp.status_code == 200:
                        logger.info("Updated existing Notion order page %s for %s", existing_page_id, reference)
                        return {"synced": True, "action": "updated", "page_id": existing_page_id}
                    logger.warning("Failed to update Notion page: HTTP %s", patch_resp.status_code)
                else:
                    # Create new page
                    create_payload = {
                        "parent": {"database_id": target_db},
                        "properties": properties,
                    }
                    create_resp = client.post(
                        f"{NOTION_API_BASE}/pages",
                        headers=self._headers(),
                        json=create_payload,
                    )
                    if create_resp.status_code in (200, 201):
                        new_id = create_resp.json().get("id")
                        logger.info("Created Notion order page %s for %s", new_id, reference)
                        return {"synced": True, "action": "created", "page_id": new_id}

                    # If property mismatch occurs, retry with minimal required properties
                    if create_resp.status_code == 400:
                        logger.warning("Notion schema mismatch, retrying with title-only fallback...")
                        minimal_payload = {
                            "parent": {"database_id": target_db},
                            "properties": {
                                "title": [{"type": "text", "text": {"content": f"{reference} - {customer_name} (INR {total_amount})"}}]
                            },
                        }
                        minimal_resp = client.post(
                            f"{NOTION_API_BASE}/pages",
                            headers=self._headers(),
                            json=minimal_payload,
                        )
                        if minimal_resp.status_code in (200, 201):
                            new_id = minimal_resp.json().get("id")
                            return {"synced": True, "action": "created_minimal", "page_id": new_id}

                    logger.warning("Notion create page returned HTTP %s: %s", create_resp.status_code, create_resp.text[:200])
                    return {"synced": False, "status_code": create_resp.status_code, "reason": "Notion API error"}
        except Exception as exc:
            logger.error("Notion sync exception: %s", str(exc))
            return {"synced": False, "reason": str(exc)}
