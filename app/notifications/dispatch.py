# app/notifications/dispatch.py
"""
Handles outbound notification dispatching across channels.

To be extended with in-app alerts, Slack, SMS, or task queues later.
"""

from app.services.email_service import send_email
from flask import url_for


def notify_ticket_assignment(ticket, drafter):
    subject = f"[Drafting Ticket Assigned] {ticket.ticket_number}"
    recipients = [drafter.email]
    body = f"""
Hello {drafter.actual_name},

You have been assigned a new drafting ticket: {ticket.ticket_number}

Title: {ticket.title}
Priority: {ticket.priority}
Unit: {ticket.unit}

Please log in to begin your work.
"""

    # Optionally: include a direct link if frontend routing evolves
    send_email(subject, recipients, body)


def notify_engineer_review(ticket, engineer):
    subject = f"[Review Required] {ticket.ticket_number} needs approval"
    recipients = [engineer.email]
    body = f"""
Hello {engineer.actual_name},

A drafting package for {ticket.ticket_number} is ready for your review.

Please log in to approve, request revisions, or comment.
"""

    send_email(subject, recipients, body, cc=[ticket.submitted_by.email])


def notify_ticket_completion(ticket, admin):
    subject = f"[Ticket Complete] {ticket.ticket_number}"
    recipients = [admin.email]
    body = f"""
The drafting ticket {ticket.ticket_number} has been marked complete.

Submitted by: {ticket.submitted_by.username}
Assigned to: {ticket.assigned_to.username}

You may now archive or release the final project package.
"""
    send_email(subject, recipients, body)
