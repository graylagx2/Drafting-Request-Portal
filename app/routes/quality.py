# app/routes/quality.py
"""
Quality form intake routes.
"""

from flask import Blueprint, render_template
from flask_login import login_required

quality_bp = Blueprint("quality", __name__)


@quality_bp.route("/submit")
@login_required
def submit_quality_form():
    return render_template("pages/quality/form_submission.html")
