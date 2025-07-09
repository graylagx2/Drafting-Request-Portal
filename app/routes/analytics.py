# app/routes/analytics.py
"""
Master analytics view – includes charts and data exports.
"""

from flask import Blueprint, render_template
from flask_login import login_required

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/")
@login_required
def insights():
    return render_template("pages/analytics/insights.html")
