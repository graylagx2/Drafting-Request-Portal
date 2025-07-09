# config.py
"""
Environment-based Flask configuration.

- Config: Base configuration, shared by all environments.
- ProductionConfig: For production environment.
- DevelopmentConfig: For local development.
- TestingConfig: For running automated tests.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base directory of the application
basedir = Path(__file__).resolve().parent.parent
instance_dir = basedir / "instance"

# Ensure the instance folder exists
instance_dir.mkdir(exist_ok=True)

class Config:
    """Base configuration settings."""
    SECRET_KEY = os.environ.get("SECRET_KEY")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_HTTPONLY = True

    # Media and Storage Configuration
    STORAGE_DIR_NAME = "kern_nexus_storage"
    MEDIA_ROOT = basedir / "var" / "data" / STORAGE_DIR_NAME
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

    # Email Configuration
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "localhost")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 1025))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "false").lower() in ["true", "1"]
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER")
    MAILING_ADDRESS = os.environ.get("MAILING_ADDRESS")

class ProductionConfig(Config):
    """Production-specific configuration."""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", f"sqlite:///{instance_dir / 'kern_energy_nexus.db'}")

    # Ensure a strong secret key is set in production
    if not Config.SECRET_KEY:
        raise ValueError("No SECRET_KEY set for production environment. Please set it in .env or environment variables.")

class DevelopmentConfig(Config):
    """Development-specific configuration."""
    DEBUG = True
    TESTING = False  # Testing should be false for dev to get proper error handling
    SECRET_KEY = Config.SECRET_KEY or "unsafe-dev-secret-key"
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{instance_dir / 'kern_energy_nexus.db'}"

class TestingConfig(Config):
    """Testing-specific configuration."""
    TESTING = True
    SECRET_KEY = "test-secret-key"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"  # Use in-memory SQLite database for tests
    WTF_CSRF_ENABLED = False  # Disable CSRF forms for testing
    DEBUG = True

def load_config():
    """Load the appropriate configuration based on FLASK_ENV."""
    env = os.getenv("FLASK_ENV", "development")
    if env == "production":
        return ProductionConfig
    elif env == "testing":
        return TestingConfig
    return DevelopmentConfig
