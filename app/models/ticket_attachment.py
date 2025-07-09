from datetime import datetime
from app.extensions import db


class TicketAttachment(db.Model):
    __tablename__ = 'ticket_attachments'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('drafting_tickets.id'), nullable=False)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    file_path = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)

    category = db.Column(db.String(50), nullable=False)  # request, drafting, review, revision, completed
    version = db.Column(db.Integer, nullable=True)
    is_latest = db.Column(db.Boolean, default=True)

    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    ticket = db.relationship("DraftingTicket", back_populates="attachments")
    uploader = db.relationship("User", back_populates="attachments_uploaded")

    def __repr__(self):
        return f"<Attachment {self.filename} ({self.category})>"
