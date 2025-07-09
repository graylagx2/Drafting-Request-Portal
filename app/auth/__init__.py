# app/auth/__init__.py
"""
Auth Blueprint for login/logout routes.
"""

from flask import Blueprint

auth_bp = Blueprint("auth", __name__)

from app.auth import routes  # noqa: F401
