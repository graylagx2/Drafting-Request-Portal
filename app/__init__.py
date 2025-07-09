"""
Application Factory for Kern-Energy-Nexus

This module initializes the core application, its extensions, and blueprints.
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

from flask import Flask, got_request_exception
from app.config import load_config
from app.extensions import db, mail, login_manager, migrate  # Import migrate

# Import blueprints
from app.routes import (
    dashboard_bp,
    drafting_bp,
    engineering_bp,
    quality_bp,
    document_control_bp,
    analytics_bp,
    file_mgmt_bp,
)
from app.auth.routes import auth_bp
from app.document_control.api.documents import bp as doc_api_bp

# Import all models.
# Although they are not directly used in this file, they must be imported
# here to ensure SQLAlchemy properly registers them before the database is initialized.
from app.models import (
    document, # Import the new document model
    revision_history,
    user,
    ticket,
    project,
    form_submission,
    folder,
    review_comment,
    review_comment_read_status,
    ticket_attachment,
)

def setup_logging(app: Flask):
    """Configure robust logging for the application."""
    log_dir = app.config.get("LOG_DIR", os.path.join(app.instance_path, "logs"))
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "app.log")

    log_level = app.config.get("LOG_LEVEL", "INFO").upper()
    handler = RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=10, encoding="utf-8"
    )
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
        )
    )
    app.logger.addHandler(handler)
    app.logger.setLevel(log_level)
    app.logger.info("Application logging configured.")

def log_unhandled_exception(sender, exception, **extra):
    """Log unhandled exceptions to diagnose critical issues."""
    sender.logger.error("Unhandled application exception", exc_info=exception)

def create_app() -> Flask:
    """Create and configure the Flask application instance."""
    app = Flask(__name__, instance_relative_config=True)

    # Load configuration from object
    app.config.from_object(load_config())

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)  # Initialize Flask-Migrate
    mail.init_app(app)
    login_manager.init_app(app)

    # Setup logging and error handling
    setup_logging(app)
    got_request_exception.connect(log_unhandled_exception, app)

    # Register a global Jinja helper to get the current time
    @app.context_processor
    def inject_now():
        return {"now": datetime.utcnow()}

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(dashboard_bp, url_prefix="/")
    app.register_blueprint(drafting_bp, url_prefix="/drafting")
    app.register_blueprint(engineering_bp, url_prefix="/engineering")
    app.register_blueprint(quality_bp, url_prefix="/quality")
    app.register_blueprint(document_control_bp, url_prefix="/docs")
    app.register_blueprint(file_mgmt_bp, url_prefix="/files")
    app.register_blueprint(analytics_bp, url_prefix="/analytics")

    # Register API blueprints
    app.register_blueprint(doc_api_bp, url_prefix="/api/documents")

    app.logger.info("Application factory setup complete.")
    return app
