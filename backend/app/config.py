from functools import lru_cache
from typing import Any, Literal

from pathlib import Path

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).resolve().parent.parent
_repo_dir = _backend_dir.parent


class Settings(BaseSettings):
    """Server configuration. All secrets stay server-side."""

    model_config = SettingsConfigDict(
        env_file=(_backend_dir / ".env", _repo_dir / ".env", ".env", "../.env"),
        env_file_encoding="utf-8",
        env_prefix="FLORETZ_",
        extra="ignore",
    )

    env: Literal["development", "test", "production"] = Field(
        default="development",
        validation_alias=AliasChoices("FLORETTTZ_ENV", "FLORETZ_ENV", "env"),
    )
    frontend_url: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("FLORETTTZ_FRONTEND_URL", "FLORETZ_FRONTEND_URL", "frontend_url"),
    )
    allowed_origins: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("FLORETTTZ_ALLOWED_ORIGINS", "FLORETZ_ALLOWED_ORIGINS", "allowed_origins"),
    )
    database_url: str = Field(
        default="sqlite:///./floretz.db",
        validation_alias=AliasChoices("FLORETTTZ_DATABASE_URL", "FLORETZ_DATABASE_URL", "database_url"),
    )
    whatsapp_number: str = Field(
        default="917533832123",
        validation_alias=AliasChoices(
            "FLORETTTZ_WHATSAPP_BUSINESS_NUMBER",
            "FLORETTTZ_WHATSAPP_NUMBER",
            "FLORETZ_WHATSAPP_NUMBER",
            "NEXT_PUBLIC_WHATSAPP_NUMBER",
            "whatsapp_number",
        ),
    )
    admin_name: str = Field(
        default="ISHUPISHU",
        validation_alias=AliasChoices("FLORETTTZ_ADMIN_NAME", "admin_name"),
    )
    admin_phone_number: str = Field(
        default="7533832123",
        validation_alias=AliasChoices("FLORETTTZ_ADMIN_PHONE_NUMBER", "admin_phone_number"),
    )
    admin_email: str = Field(
        default="floretttz@gmail.com",
        validation_alias=AliasChoices("FLORETTTZ_ADMIN_EMAIL", "admin_email"),
    )
    admin_password: str = Field(
        default="Ishita@2005",
        validation_alias=AliasChoices("FLORETTTZ_ADMIN_PASSWORD", "admin_password"),
    )
    whatsapp_group_url: str = Field(
        default="https://chat.whatsapp.com/HQAdFVG6arGFh77oRGZsQk?s=cl&p=a&mlu=4&ilr=4",
        validation_alias=AliasChoices("NEXT_PUBLIC_WHATSAPP_GROUP_URL", "FLORETTTZ_WHATSAPP_GROUP_URL", "FLORETZ_WHATSAPP_GROUP_URL", "whatsapp_group_url"),
    )
    whatsapp_channel_url: str = Field(
        default="https://whatsapp.com/channel/0029Vb9L4MLG3R3Zpsx31l1U",
        validation_alias=AliasChoices("NEXT_PUBLIC_WHATSAPP_CHANNEL_URL", "FLORETTTZ_WHATSAPP_CHANNEL_URL", "FLORETZ_WHATSAPP_CHANNEL_URL", "whatsapp_channel_url"),
    )
    supabase_url: str | None = Field(
        default="https://tzemepkyhzxhtiohdcrh.supabase.co",
        validation_alias=AliasChoices("NEXT_PUBLIC_SUPABASE_URL", "FLORETTTZ_SUPABASE_URL", "FLORETZ_SUPABASE_URL", "supabase_url"),
    )
    supabase_jwks_url: str | None = Field(
        default="https://tzemepkyhzxhtiohdcrh.supabase.co/auth/v1/.well-known/jwks.json",
        validation_alias=AliasChoices("FLORETTTZ_SUPABASE_JWKS_URL", "FLORETZ_SUPABASE_JWKS_URL", "supabase_jwks_url"),
    )
    supabase_jwt_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_SUPABASE_JWT_SECRET", "FLORETZ_SUPABASE_JWT_SECRET", "supabase_jwt_secret"),
    )
    supabase_audience: str = Field(
        default="authenticated",
        validation_alias=AliasChoices("FLORETTTZ_SUPABASE_AUDIENCE", "FLORETZ_SUPABASE_AUDIENCE", "supabase_audience"),
    )
    supabase_service_role_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_SUPABASE_SERVICE_ROLE_KEY", "FLORETZ_SUPABASE_SERVICE_ROLE_KEY", "supabase_service_role_key"),
    )
    notion_api_key: str | None = Field(
        default="replace-with-your-notion-api-key",
        validation_alias=AliasChoices("FLORETTTZ_NOTION_API_KEY", "FLORETZ_NOTION_API_KEY", "notion_api_key"),
    )
    notion_database_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_NOTION_DATABASE_ID", "FLORETZ_NOTION_DATABASE_ID", "notion_database_id"),
    )
    admin_bootstrap_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_ADMIN_BOOTSTRAP_TOKEN", "FLORETZ_ADMIN_BOOTSTRAP_TOKEN", "admin_bootstrap_token"),
    )
    # Meta WhatsApp Cloud API credentials (server-only)
    whatsapp_cloud_api_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_WHATSAPP_CLOUD_API_TOKEN", "WHATSAPP_CLOUD_API_TOKEN", "whatsapp_cloud_api_token"),
    )
    whatsapp_phone_number_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_PHONE_NUMBER_ID", "whatsapp_phone_number_id"),
    )
    whatsapp_webhook_verify_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_WHATSAPP_WEBHOOK_VERIFY_TOKEN", "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "whatsapp_webhook_verify_token"),
    )
    whatsapp_app_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_WHATSAPP_APP_SECRET", "WHATSAPP_APP_SECRET", "whatsapp_app_secret"),
    )
    # Business UPI payment details
    upi_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_UPI_ID", "UPI_ID", "upi_id"),
    )
    upi_payee_name: str = Field(
        default="Floretttz",
        validation_alias=AliasChoices("FLORETTTZ_UPI_PAYEE_NAME", "UPI_PAYEE_NAME", "upi_payee_name"),
    )
    payment_qr_image_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FLORETTTZ_PAYMENT_QR_IMAGE_URL", "PAYMENT_QR_IMAGE_URL", "payment_qr_image_url"),
    )

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        if self.whatsapp_number:
            self.whatsapp_number = "".join(c for c in self.whatsapp_number if c.isdigit())
        if self.admin_phone_number:
            self.admin_phone_number = "".join(c for c in self.admin_phone_number if c.isdigit())
        if self.env == "production":
            if "9999999999" in self.whatsapp_number or self.whatsapp_number == "919999999999":
                raise ValueError("Production mode requires a verified business phone number, not the placeholder 919999999999")
            if "*" in self.allowed_origins:
                raise ValueError("Production mode forbids wildcard '*' in allowed_origins")
            if not self.supabase_url:
                raise ValueError("Production mode requires a configured FLORETTTZ_SUPABASE_URL")
        return self

    @property
    def effective_jwks_url(self) -> str | None:
        if self.supabase_jwks_url:
            return self.supabase_jwks_url
        if self.supabase_url:
            return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        return None

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]

    def get_redacted_status(self) -> dict[str, Any]:
        """Return safe configuration status with all secret values redacted."""
        return {
            "env": self.env,
            "frontend_url": self.frontend_url,
            "allowed_origins": self.cors_origins,
            "database_configured": bool(self.database_url),
            "whatsapp_number_is_placeholder": "9999999999" in self.whatsapp_number or self.whatsapp_number == "919999999999",
            "supabase_configured": bool(self.supabase_url),
            "supabase_url": self.supabase_url,
            "supabase_jwt_secret_configured": bool(self.supabase_jwt_secret),
            "supabase_service_role_key_configured": bool(self.supabase_service_role_key),
            "notion_configured": bool(self.notion_api_key),
            "notion_database_configured": bool(self.notion_database_id),
            "whatsapp_cloud_api_configured": bool(self.whatsapp_cloud_api_token and self.whatsapp_phone_number_id),
            "whatsapp_webhook_verify_configured": bool(self.whatsapp_webhook_verify_token),
            "whatsapp_app_secret_configured": bool(self.whatsapp_app_secret),
            "upi_configured": bool(self.upi_id),
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()

