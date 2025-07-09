"""
Landing view based on user role. Displays:
- Admin, Engineering, QC, User dashboards unchanged.
- Drafter dashboard with tickets tile + Drive‑style sidebar + file explorer.
"""

import logging
from pathlib import Path
from flask import Blueprint, render_template, current_app
from flask_login import login_required, current_user

dashboard_bp = Blueprint("dashboard", __name__)
logger = logging.getLogger(__name__)


@dashboard_bp.route("/")
@login_required
def index():
    if current_user.has_role("admin"):
        # Build folder list under static/Document_Control
        static_root = Path(current_app.root_path) / "static"
        dc_root = static_root / "Document_Control"
        folder_list = []
        if dc_root.exists() and dc_root.is_dir():
            for p in sorted(dc_root.iterdir()):
                if p.is_dir():
                    folder_list.append(p.relative_to(static_root).as_posix())
        user_home = folder_list[0] if folder_list else ""
        return render_template(
            "pages/dashboard/index.html",
            user=current_user,
            folder_list=folder_list,
            user_home=user_home
        )

    elif current_user.has_role("engineer"):
        # Replicate the "drafter" style approach for engineering
        # so they have a drive sidebar, feed, etc.

        # 1) Build an archive tickets list if you want them to see
        archive_dir = Path(current_app.root_path) / \
            "static" / "drafting_tickets"
        archive_tickets = []
        try:
            archive_tickets = sorted([
                p.name for p in archive_dir.iterdir() if p.is_dir()
            ])
        except Exception as e:
            logger.error(f"Failed to list archive tickets: {e}", exc_info=True)

        # 2) Build a user home folder under static/users/<id> (for the drive)
        static_dir = Path(current_app.root_path) / "static"
        user_home = f"users/{current_user.id}"
        (static_dir / "users" / str(current_user.id)
         ).mkdir(parents=True, exist_ok=True)

        # 3) Build folder_list (the sidebar)
        # - skip 'js','css','img','users' to avoid clutter
        folder_list = [user_home] + [
            p.name for p in sorted(static_dir.iterdir())
            if p.is_dir() and p.name not in ("js", "css", "img", "users")
        ]

        # 4) Example feed items, if any
        feed_items = []
        # feed_items could be loaded from DB if you have a table for that
        # e.g. feed_items = get_feed_for_user(current_user.id)

        return render_template(
            "pages/dashboard/engineering_index.html",
            user=current_user,
            archive_tickets=archive_tickets,
            feed_items=feed_items,
            folder_list=folder_list,
            user_home=user_home
        )

    elif current_user.has_role("drafter"):
        # Archive tickets
        archive_dir = Path(current_app.root_path) / \
            "static" / "drafting_tickets"
        archive_tickets = []
        try:
            archive_tickets = sorted(
                [p.name for p in archive_dir.iterdir() if p.is_dir()])
        except Exception as e:
            logger.error(f"Failed to list archive tickets: {e}", exc_info=True)

        # Sidebar folders
        static_dir = Path(current_app.root_path) / "static"
        user_home = f"users/{current_user.id}"
        (static_dir / "users" / str(current_user.id)
         ).mkdir(parents=True, exist_ok=True)
        folder_list = [user_home] + [
            p.name for p in sorted(static_dir.iterdir())
            if p.is_dir() and p.name not in ("js", "css", "img", "users")
        ]

        feed_items = []  # populate as needed

        return render_template(
            "pages/dashboard/drafter_index.html",
            user=current_user,
            archive_tickets=archive_tickets,
            feed_items=feed_items,
            folder_list=folder_list,
            user_home=user_home
        )

    elif current_user.has_role("qc"):
        return render_template("pages/dashboard/qc_index.html", user=current_user)

    else:
        return render_template("pages/dashboard/user_index.html", user=current_user)
