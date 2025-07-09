from datetime import datetime
from app.extensions import db

class DraftingTicket(db.Model):
    __tablename__ = 'drafting_tickets'

    id = db.Column(db.Integer, primary_key=True)
    ticket_number = db.Column(db.String(20), unique=True, nullable=False, index=True)

    # Meta
    work_order = db.Column(db.String(100), nullable=True)
    moc = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=False)
    priority = db.Column(db.Integer, nullable=False, default=3)
    unit = db.Column(db.String(50), nullable=True)
    request_type = db.Column(db.String(50), nullable=False)

    # Assignment Foreign Keys
    review_engineer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    submitted_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    project_engineer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)

    # Status and timeline
    status = db.Column(db.String(50), default='unassigned', index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime, nullable=True)
    assigned_viewed = db.Column(db.Boolean, default=False)

    # --- Refactored Relationships ---
    review_engineer = db.relationship('User', foreign_keys=[review_engineer_id], back_populates='tickets_reviewing')
    assigned_to = db.relationship('User', foreign_keys=[assigned_to_id], back_populates='tickets_assigned')
    submitted_by = db.relationship('User', foreign_keys=[submitted_by_id], back_populates='tickets_submitted')
    project_engineer = db.relationship('User', foreign_keys=[project_engineer_id], back_populates='tickets_project_lead')

    attachments = db.relationship('TicketAttachment', back_populates='ticket', lazy='joined', cascade='all, delete-orphan')
    review_comments = db.relationship('ReviewComment', back_populates='ticket', lazy='dynamic', cascade='all, delete-orphan')

    # Specs (isometric/as-built fields)
    service = db.Column(db.String(100), nullable=True)
    pipe_spec = db.Column(db.String(100), nullable=True)
    operating_psig = db.Column(db.String(50), nullable=True)
    operating_temp = db.Column(db.String(50), nullable=True)
    design_psig = db.Column(db.String(50), nullable=True)
    design_temp = db.Column(db.String(50), nullable=True)
    nde_rt = db.Column(db.String(20), nullable=True)
    nde_pt = db.Column(db.String(20), nullable=True)
    pressure_test = db.Column(db.String(50), nullable=True)
    paint_spec = db.Column(db.String(100), nullable=True)
    pwht_temp = db.Column(db.String(50), nullable=True)
    pwht_hold = db.Column(db.String(50), nullable=True)
    insulation_spec = db.Column(db.String(100), nullable=True)

    def __repr__(self):
        return f"<Ticket {self.ticket_number} ({self.status})>"