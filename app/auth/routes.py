# app/auth/routes.py
"""
Handles user authentication: login, logout,
and session management with secure redirect logic.
"""

from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.urls import url_parse
from app.extensions import db, login_manager
from app.auth.forms import LoginForm
from app.models.user import User

auth_bp = Blueprint("auth", __name__)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    form = LoginForm()

    print(">>> REQUEST METHOD:", request.method)
    print(">>> FORM SUBMITTED:", form.is_submitted())
    print(">>> FORM VALID:", form.validate_on_submit())
    print(">>> FORM ERRORS:", form.errors)

    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    if form.validate_on_submit():
        username = form.username.data.strip()
        password = form.password.data

        user = User.query.filter_by(username=username).first()

        print(">>> Submitted username:", username)
        print(">>> Found user:", user)
        if user:
            print(">>> Password check result:", user.check_password(password))
        else:
            print(">>> No user found for that username.")

        if user and user.check_password(password):
            login_user(user)

            print(">>> Login successful:", user.username)
            print(">>> Authenticated?", current_user.is_authenticated)
            print(">>> Session keys:", list(session.keys()))
            print(">>> Session data:", dict(session))

            next_page = request.args.get("next")
            if not next_page or url_parse(next_page).netloc != "":
                next_page = url_for("dashboard.index")

            return redirect(next_page)
        else:
            flash("Invalid username or password. Please try again.", "danger")

    return render_template("pages/auth/login.html", form=form)


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out successfully.", "info")
    return redirect(url_for("auth.login"))
