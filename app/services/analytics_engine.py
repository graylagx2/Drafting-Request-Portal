# app/services/analytics_engine.py
"""
Crunches data for dashboard charts.
"""

from app.extensions import db
from app.models.ticket import DraftingTicket
from sqlalchemy import func
from datetime import datetime, timedelta


def get_ticket_stats(days=30):
    since = datetime.utcnow() - timedelta(days=days)
    data = (
        db.session.query(
            func.date(DraftingTicket.created_at).label("day"),
            func.count(DraftingTicket.id)
        )
        .filter(DraftingTicket.created_at >= since)
        .group_by(func.date(DraftingTicket.created_at))
        .order_by("day")
        .all()
    )

    return [{"date": str(row[0]), "count": row[1]} for row in data]


def get_drafter_performance():
    from app.models.user import User

    drafters = (
        db.session.query(User.username, func.count(DraftingTicket.id))
        .join(DraftingTicket, DraftingTicket.assigned_to_id == User.id)
        .filter(User.role == "drafter")
        .group_by(User.username)
        .all()
    )

    return [{"drafter": name, "count": count} for name, count in drafters]
