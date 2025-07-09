# app/models/__init__.py
"""
Initialize all models for the Kern-Energy-Nexus platform.
"""

from app.models.user import User
from app.models.ticket import DraftingTicket
from app.models.project import Project
from app.models.revision_history import RevisionHistory
from app.models.form_submission import QualityForm
from app.models.ticket_attachment import TicketAttachment
from app.models.review_comment import ReviewComment
from app.models.review_comment_read_status import ReviewCommentReadStatus


from app.document_control.models import (
    DocumentMaster,
    DocumentRevision,
    CheckoutLog,
    ChangeRequest,
    AuditLog
)
