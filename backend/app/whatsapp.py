"""WhatsApp service module for FLORETTTZ.

Manages:
1. Prefilled order handoff deep links to the FLORETTTZ business contact.
2. WhatsApp Group and WhatsApp Channel community invitations.
3. Clean, isolated interface for the Meta WhatsApp Cloud API integration
   (webhook verification, HMAC-SHA256 signature validation, deduplication,
    payment screenshot intake flagging 'pending_verification', and payment instructions).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import urllib.parse
from collections import OrderedDict
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import Order

logger = logging.getLogger("floretttz.whatsapp")

# In-memory message deduplication cache (LRU up to 1000 messages)
_PROCESSED_MESSAGES: OrderedDict[str, datetime] = OrderedDict()
_MAX_PROCESSED_MESSAGES = 1000


def is_placeholder_number(number: str) -> bool:
    """Returns True if the number is the default placeholder 919999999999."""
    cleaned = "".join(ch for ch in number if ch.isdigit())
    return "9999999999" in cleaned or cleaned == "919999999999"


def build_order_whatsapp_message(
    reference: str,
    customer_name: str,
    items_summary: str,
    total: float | str,
    note: str | None = None,
) -> str:
    """Format the customer order message for the WhatsApp handoff."""
    lines = [
        "Hello Floretttz! \U0001F338",
        "",
        "I would like to place an order request:",
        f"\u2022 Order Reference: {reference}",
        f"\u2022 Customer Name: {customer_name}",
        f"\u2022 Items:\n{items_summary}",
        f"\u2022 Total (calculated by server): INR {total}",
    ]
    if note:
        lines.append(f"\u2022 Note / Personalisation: {note}")
    lines.extend([
        "",
        "Please let me know how to proceed with payment and delivery confirmation. Thank you!",
    ])
    return "\n".join(lines)


def format_whatsapp_order_message(order: Any) -> str:
    """Format an Order model instance into an official Floretttz WhatsApp order message."""
    def _item_line(item: Any) -> str:
        line_cost = getattr(item, "line_total", None) or (item.unit_price * item.quantity)
        variant_part = f" ({item.variant_name})" if getattr(item, "variant_name", None) else ""
        note = getattr(item, "personalisation_note", None)
        note_part = f" [Note: {note}]" if note else ""
        return f"  - {item.product_name}{variant_part} x{item.quantity} (INR {line_cost}){note_part}"

    items_summary = "\n".join(_item_line(item) for item in order.items)
    return build_order_whatsapp_message(
        reference=order.reference,
        customer_name=order.customer_name,
        items_summary=items_summary,
        total=str(order.total),
    )


def create_prefilled_whatsapp_url(
    phone_number: str,
    message: str,
) -> str:
    """Construct a web-safe wa.me URL with encoded message."""
    cleaned_number = "".join(ch for ch in phone_number if ch.isdigit())
    encoded_text = urllib.parse.quote(message)
    return f"https://wa.me/{cleaned_number}?text={encoded_text}"


def get_community_links() -> dict[str, str]:
    """Retrieve verified owner-provided WhatsApp community links."""
    settings = get_settings()
    return {
        "group_url": settings.whatsapp_group_url,
        "channel_url": settings.whatsapp_channel_url,
    }


def format_payment_instructions(order: Order, settings: Settings) -> str:
    """Build payment instructions with real owner-configured UPI details."""
    lines = [
        f"Payment Details for Floretttz Order {order.reference}:",
        f"Amount: INR {order.total}",
    ]
    if settings.upi_id:
        lines.extend([
            f"UPI ID: {settings.upi_id}",
            f"Payee Name: {settings.upi_payee_name}",
            "",
            "Please transfer via Google Pay, PhonePe, Paytm or your UPI app.",
            "Once paid, please share a screenshot of the payment confirmation here.",
            "Our team will manually verify it and confirm your order!",
        ])
    else:
        lines.extend([
            "",
            "Our team will send you our official UPI payment details shortly.",
            "Thank you for your patience!",
        ])
    return "\n".join(lines)


class WhatsAppCloudAPIService:
    """Production-ready interface for Meta WhatsApp Cloud API.

    Handles webhook verification, HMAC-SHA256 signatures, deduplication,
    payment screenshot intake (marking pending_verification), and payment instructions.
    """

    def __init__(
        self,
        access_token: str | None = None,
        phone_number_id: str | None = None,
        app_secret: str | None = None,
        webhook_verify_token: str | None = None,
    ):
        self.access_token = access_token
        self.phone_number_id = phone_number_id
        self.app_secret = app_secret
        self.webhook_verify_token = webhook_verify_token

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token and self.phone_number_id)

    def verify_webhook_challenge(
        self,
        mode: str | None,
        token: str | None,
        challenge: str | None,
        expected_token: str | None = None,
    ) -> str | None:
        """Standard Meta webhook verification handshake."""
        target_token = expected_token or self.webhook_verify_token
        if mode == "subscribe" and token and target_token and token == target_token:
            return challenge
        return None

    def validate_signature(self, raw_body: bytes, signature_header: str | None) -> bool:
        """Validate Meta X-Hub-Signature-256 header using app secret."""
        if not self.app_secret:
            return True
        if not signature_header or not signature_header.startswith("sha256="):
            return False
        expected_sig = signature_header.removeprefix("sha256=").strip()
        computed = hmac.new(self.app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, expected_sig)

    def is_duplicate(self, message_id: str) -> bool:
        """Check if message has already been processed to prevent duplicate actions."""
        if not message_id:
            return False
        if message_id in _PROCESSED_MESSAGES:
            return True
        _PROCESSED_MESSAGES[message_id] = datetime.now(UTC)
        while len(_PROCESSED_MESSAGES) > _MAX_PROCESSED_MESSAGES:
            _PROCESSED_MESSAGES.popitem(last=False)
        return False

    def extract_order_reference(self, text: str) -> str | None:
        """Extract order reference (e.g., FLZ-202610-ABCD or similar pattern)."""
        match = re.search(r"\b(FLZ-[A-Z0-9-]+)\b", text, re.IGNORECASE)
        return match.group(1).upper() if match else None

    def parse_webhook_payload(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        """Extract individual messages from Meta's nested webhook JSON."""
        messages: list[dict[str, Any]] = []
        entries = payload.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for msg in value.get("messages", []):
                    sender = msg.get("from", "")
                    msg_id = msg.get("id", "")
                    msg_type = msg.get("type", "")
                    body = ""
                    media_id = None
                    if msg_type == "text":
                        body = msg.get("text", {}).get("body", "")
                    elif msg_type == "image":
                        media_id = msg.get("image", {}).get("id")
                    messages.append({
                        "id": msg_id,
                        "from": sender,
                        "type": msg_type,
                        "body": body,
                        "media_id": media_id,
                        "timestamp": msg.get("timestamp"),
                    })
        return messages

    def process_incoming_messages(
        self,
        db: Session,
        payload: dict[str, Any],
        settings: Settings,
    ) -> list[dict[str, Any]]:
        """Process incoming messages, handling screenshots and inquiries."""
        results: list[dict[str, Any]] = []
        messages = self.parse_webhook_payload(payload)

        for msg in messages:
            msg_id = msg["id"]
            if self.is_duplicate(msg_id):
                results.append({"id": msg_id, "status": "duplicate_ignored"})
                continue

            sender = msg["from"]
            msg_type = msg["type"]

            if msg_type == "image":
                order = db.scalar(
                    select(Order)
                    .where(Order.status.in_(["pending", "awaiting_confirmation"]))
                    .order_by(Order.created_at.desc())
                )
                if order:
                    order.status = "pending_verification"
                    if msg.get("media_id"):
                        order.payment_screenshot_url = f"meta_media:{msg['media_id']}"
                    db.commit()
                    db.refresh(order)
                    logger.info("Order %s updated to pending_verification from WhatsApp image", order.reference)
                    results.append({
                        "id": msg_id,
                        "action": "order_flagged_pending_verification",
                        "order_reference": order.reference,
                    })
                else:
                    results.append({"id": msg_id, "action": "image_received_no_active_order"})

            elif msg_type == "text":
                ref = self.extract_order_reference(msg["body"])
                results.append({
                    "id": msg_id,
                    "action": "text_received",
                    "detected_reference": ref,
                })
            else:
                results.append({"id": msg_id, "action": "unhandled_message_type", "type": msg_type})

        return results

