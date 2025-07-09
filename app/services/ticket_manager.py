# app/services/ticket_manager.py
"""
Ticket creation, assignment, and state transitions.
"""

from datetime import datetime
from app.extensions import db
from app.models.ticket import DraftingTicket
from app.models.user import User


def generate_ticket_number():
    year = datetime.now().year % 100
    base = f"{year:02d}DDDC"
    latest = DraftingTicket.query.order_by(DraftingTicket.id.desc()).first()
    if latest:
        latest_number = int(latest.ticket_number[-3:])
        new_number = latest_number + 1
    else:
        new_number = 80  # Start from 25DDDC080
    return f"{base}{new_number:03d}"


def create_ticket(data, submitted_by_id):
    ticket = DraftingTicket(
        ticket_number=generate_ticket_number(),
        title=data["title"],
        description=data["description"],
        priority=data["priority"],
        unit=data["unit"],
        submitted_by_id=submitted_by_id,
        project_engineer_id=data["project_engineer_id"]
    )
    db.session.add(ticket)
    db.session.commit()
    return ticket


def assign_drafter(ticket_id, drafter_id):
    ticket = DraftingTicket.query.get(ticket_id)
    drafter = User.query.get(drafter_id)

    if not ticket or not drafter:
        return None

    ticket.assigned_to_id = drafter_id
    ticket.status = "in_progress"
    db.session.commit()
    return ticket
