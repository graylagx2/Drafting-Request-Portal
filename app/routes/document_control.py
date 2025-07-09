# app/routes/document_control.py

"""
Routes for Document Control:
- /docs/           → full Document Control dashboard (JS-driven)
- /docs/checkouts  → legacy checkout tracker
- /docs/archives   → legacy archive history
"""

from flask import Blueprint, render_template, current_app
from flask_login import login_required

# blueprint is mounted at /docs
document_control_bp = Blueprint(
    "document_control",
    __name__,
)


@document_control_bp.route("/", methods=["GET"])
@login_required
def control_index():
    """
    Browse the legacy Document_Control folder as your “home” tree.
    """
    static_root = Path(current_app.root_path) / "static"
    dc_root = static_root / "Document_Control"
    # list only subfolders under Document_Control
    folder_list = []
    if dc_root.exists() and dc_root.is_dir():
        for p in sorted(dc_root.iterdir()):
            if p.is_dir():
                folder_list.append(p.relative_to(static_root).as_posix())
    # set home to the root Document_Control
    user_home = "Document_Control"
    return render_template(
        "pages/document_control/control_index.html",
        folder_list=folder_list,
        user_home=user_home
    )


@document_control_bp.route("/checkouts", methods=["GET"])
@login_required
def checkout_tracker():
    """
    Legacy view: list of current checkouts.
    """
    return render_template("pages/document_control/checkout_tracker.html")


@document_control_bp.route("/archives", methods=["GET"])
@login_required
def archive_history():
    """
    Legacy view: archived drawing packages.
    """
    return render_template("pages/document_control/archive_history.html")
