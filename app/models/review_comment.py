from datetime import datetime
from app.extensions import db


class ReviewComment(db.Model):
    __tablename__ = 'review_comments'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(
        db.Integer,
        db.ForeignKey('drafting_tickets.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=False,
        index=True
    )
    message = db.Column(db.Text, nullable=False)
    page_number = db.Column(db.Integer, nullable=True)
    created_at = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    ticket = db.relationship(
        'DraftingTicket',
        back_populates='review_comments',
        lazy='joined'
    )
    author = db.relationship(
        'User',
        back_populates='review_comments',
        lazy='joined'
    )

    def to_dict(self):
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'user_id': self.user_id,
            'message': self.message,
            'page_number': self.page_number,
            'created_at': self.created_at.isoformat()
        }

    def __repr__(self):
        return f"<ReviewComment id={self.id} ticket={self.ticket_id} user={self.user_id}>"
