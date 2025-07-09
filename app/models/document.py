# app/models/document.py
"""
Document model representing the master record for all controlled documents.
"""

from datetime import datetime
from app.extensions import db
from app.models.enums import DocumentStatus

class Document(db.Model):
    __tablename__ = 'documents'

    id = db.Column(db.Integer, primary_key=True)
    document_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    status = db.Column(db.Enum(DocumentStatus), default=DocumentStatus.IN_DEVELOPMENT, nullable=False)

    # Foreign Keys
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    ticket_id = db.Column(db.Integer, db.ForeignKey('drafting_tickets.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = db.relationship('Project', backref=db.backref('documents', lazy='dynamic'))
    ticket = db.relationship('DraftingTicket', backref=db.backref('document', uselist=False))
    
    # Relationship to its revisions
    revisions = db.relationship('RevisionHistory', back_populates='document', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Document {self.document_number}>'
