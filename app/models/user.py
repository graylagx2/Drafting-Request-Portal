"""
User model with roles and secure password handling.
"""
from datetime import datetime
from app.extensions import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Enum as SQLEnum
from app.models.enums import Role

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    actual_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(
        SQLEnum(Role, name="role_enum", native_enum=False),
        nullable=False,
        default=Role.VIEWER,
        index=True
    )
    last_login_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    # --- Refactored Relationships ---
    # Relationships to DraftingTicket
    tickets_submitted = db.relationship('DraftingTicket', foreign_keys='DraftingTicket.submitted_by_id', back_populates='submitted_by', lazy='dynamic')
    tickets_assigned = db.relationship('DraftingTicket', foreign_keys='DraftingTicket.assigned_to_id', back_populates='assigned_to', lazy='dynamic')
    tickets_reviewing = db.relationship('DraftingTicket', foreign_keys='DraftingTicket.review_engineer_id', back_populates='review_engineer', lazy='dynamic')
    tickets_project_lead = db.relationship('DraftingTicket', foreign_keys='DraftingTicket.project_engineer_id', back_populates='project_engineer', lazy='dynamic')

    # Other relationships
    attachments_uploaded = db.relationship('TicketAttachment', back_populates='uploader', foreign_keys='TicketAttachment.uploaded_by_id', cascade='all, delete-orphan')
    review_comments = db.relationship('ReviewComment', back_populates='author', foreign_keys='ReviewComment.user_id', lazy='dynamic', cascade='all, delete-orphan')
    review_read_status = db.relationship('ReviewCommentReadStatus', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, raw_password):
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password, raw_password)

    def has_role(self, role_name):
        """Check against the Role enum value."""
        return self.role.value == role_name

    @property
    def roles(self):
        """
        Returns a list for compatibility with templates/JS.
        Currently single-role; prepare for multi-role in future.
        """
        return [self.role.value]

    @property
    def full_name(self):
        return self.actual_name

    def __repr__(self):
        return f"<User {self.username} ({self.role.value})>"
