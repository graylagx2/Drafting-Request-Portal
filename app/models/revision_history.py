from datetime import datetime
from app.extensions import db

class RevisionHistory(db.Model):
    __tablename__ = 'revision_history'

    id = db.Column(db.Integer, primary_key=True)
    
    # A revision belongs to a single document
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False, index=True)
    
    revision_number = db.Column(db.Integer, nullable=False)  # 0 = original, 1 = Rev A, etc.
    status = db.Column(db.String(50), nullable=False)        # 'submitted', 'rejected', 'approved', etc.
    message = db.Column(db.Text, nullable=True)

    submitted_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    document = db.relationship("Document", back_populates="revisions")
    submitted_by = db.relationship("User", foreign_keys=[submitted_by_id])
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_id])

    def __repr__(self):
        return f"<Rev {self.revision_number} for Doc {self.document_id} - {self.status}>"
