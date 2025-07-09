# app/models/project.py
"""
Project tracking for engineering views.
"""

from datetime import datetime
from app.extensions import db


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default='design')  # design, construction, archive
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    owner = db.relationship('User', backref='owned_projects')

    def __repr__(self):
        return f"<Project {self.title}>"
