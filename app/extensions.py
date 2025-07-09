# app/extensions.py
"""
Centralized extensions for reuse across app.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_mail import Mail
from flask_login import LoginManager

# Database ORM
db = SQLAlchemy()

# Database Migrations
migrate = Migrate()

# Mail Sender
mail = Mail()

# User Session Management
login_manager = LoginManager()
login_manager.login_view = "auth.login"  # If not logged in, redirect here
login_manager.login_message = ""         # Remove default flash message