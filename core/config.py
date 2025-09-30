"""
Pydantic settings configuration for Django.
This module provides environment-based configuration management using Pydantic.
"""
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DjangoSettings(BaseSettings):
    """
    Django settings configuration using Pydantic BaseSettings.
    Automatically loads values from environment variables and .env file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Core Django Settings
    secret_key: str = Field(..., description="Django secret key")
    debug: bool = Field(default=False, description="Debug mode")
    allowed_hosts: str = Field(default="localhost,127.0.0.1", description="Allowed hosts comma-separated")

    # Database Configuration
    db_engine: str = Field(default="django.db.backends.postgresql_psycopg2", description="Database engine")
    db_name: str = Field(..., description="Database name")
    db_user: str = Field(..., description="Database user")
    db_password: str = Field(..., description="Database password")
    db_host: str = Field(default="localhost", description="Database host")
    db_port: str = Field(default="5432", description="Database port")

    # Static Files
    static_url: str = Field(default="static/", description="Static files URL")

    # Internationalization
    language_code: str = Field(default="en-us", description="Language code")
    time_zone: str = Field(default="UTC", description="Time zone")

    # Email Configuration
    email_backend: str = Field(
        default="django.core.mail.backends.console.EmailBackend",
        description="Email backend"
    )
    email_host: Optional[str] = Field(default=None, description="Email host")
    email_port: int = Field(default=587, description="Email port")
    email_use_tls: bool = Field(default=True, description="Use TLS for email")
    email_host_user: Optional[str] = Field(default=None, description="Email host user")
    email_host_password: Optional[str] = Field(default=None, description="Email host password")

    # Cache Configuration
    cache_backend: str = Field(
        default="django.core.cache.backends.locmem.LocMemCache",
        description="Cache backend"
    )
    cache_location: str = Field(default="unique-snowflake", description="Cache location")

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")

    # CORS Configuration
    cors_origin_whitelist: str = Field(default="http://localhost:3000", description="CORS origin whitelist")

    # API Configuration
    enable_camel_case_api: bool = Field(default=True, description="Enable camelCase/snake_case API conversion")

    # AWS S3 Configuration
    aws_access_key_id: Optional[str] = Field(default=None, description="AWS Access Key ID")
    aws_secret_access_key: Optional[str] = Field(default=None, description="AWS Secret Access Key")
    aws_storage_bucket_name: Optional[str] = Field(default=None, description="AWS S3 bucket name")
    aws_s3_region_name: str = Field(default="us-east-1", description="AWS S3 region")
    aws_s3_custom_domain: Optional[str] = Field(default=None, description="AWS S3 custom domain")
    aws_default_acl: str = Field(default="private", description="AWS S3 default ACL")
    aws_s3_object_parameters: dict = Field(
        default={"CacheControl": "max-age=86400"},
        description="AWS S3 object parameters"
    )
    use_s3_for_media: bool = Field(default=False, description="Use S3 for media files storage")

    # Stripe Configuration
    stripe_publishable_key: str = Field(default="pk_test_placeholder", description="Stripe publishable key")
    stripe_secret_key: str = Field(default="sk_test_placeholder", description="Stripe secret key")
    stripe_webhook_secret: Optional[str] = Field(default=None, description="Stripe webhook endpoint secret")
    stripe_currency: str = Field(default="usd", description="Default currency for Stripe transactions")

    # Frontend Configuration
    frontend_url: str = Field(default="http://localhost:3000", description="Frontend application URL")

    @property
    def allowed_hosts_list(self) -> List[str]:
        """Convert comma-separated allowed hosts to list."""
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]

    @property
    def database_config(self) -> dict:
        """Get database configuration dictionary."""
        return {
            "ENGINE": self.db_engine,
            "NAME": self.db_name,
            "USER": self.db_user,
            "PASSWORD": self.db_password,
            "HOST": self.db_host,
            "PORT": self.db_port,
        }

    @property
    def email_config(self) -> dict:
        """Get email configuration dictionary."""
        config = {
            "EMAIL_BACKEND": self.email_backend,
            "EMAIL_PORT": self.email_port,
            "EMAIL_USE_TLS": self.email_use_tls,
        }

        if self.email_host:
            config["EMAIL_HOST"] = self.email_host
        if self.email_host_user:
            config["EMAIL_HOST_USER"] = self.email_host_user
        if self.email_host_password:
            config["EMAIL_HOST_PASSWORD"] = self.email_host_password

        return config

    @property
    def cache_config(self) -> dict:
        """Get cache configuration dictionary."""
        return {
            "default": {
                "BACKEND": self.cache_backend,
                "LOCATION": self.cache_location,
            }
        }

    @property
    def cors_origin_whitelist_list(self) -> List[str]:
        """Convert comma-separated CORS origins to list."""
        return [origin.strip() for origin in self.cors_origin_whitelist.split(",") if origin.strip()]

    @property
    def aws_s3_config(self) -> dict:
        """Get AWS S3 configuration dictionary."""
        if not self.use_s3_for_media:
            return {}

        config = {
            "AWS_ACCESS_KEY_ID": self.aws_access_key_id,
            "AWS_SECRET_ACCESS_KEY": self.aws_secret_access_key,
            "AWS_STORAGE_BUCKET_NAME": self.aws_storage_bucket_name,
            "AWS_S3_REGION_NAME": self.aws_s3_region_name,
            "AWS_DEFAULT_ACL": self.aws_default_acl,
            "AWS_S3_OBJECT_PARAMETERS": self.aws_s3_object_parameters,
            "AWS_S3_FILE_OVERWRITE": False,
            "AWS_QUERYSTRING_AUTH": True,
            "AWS_S3_SIGNATURE_VERSION": "s3v4",
        }

        if self.aws_s3_custom_domain:
            config["AWS_S3_CUSTOM_DOMAIN"] = self.aws_s3_custom_domain

        return config


# Create a global instance of settings
settings = DjangoSettings()
