# app/models/form_submission.py
"""
Generic ISO-style quality form submission record.
"""

from datetime import datetime
from app.extensions import db


class QualityForm(db.Model):
    __tablename__ = 'quality_forms'

    id = db.Column(db.Integer, primary_key=True)
    submitted_by_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    form_type = db.Column(db.String(100), nullable=False)  # e.g., weld log, inspection sheet
    data_json = db.Column(db.Text, nullable=False)  # raw JSON dump of form fields
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    submitted_by = db.relationship('User')

    def __repr__(self):
        return f"<Form {self.form_type} by {self.submitted_by.username}>"
