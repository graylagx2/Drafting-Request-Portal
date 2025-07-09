from datetime import datetime
from app.extensions import db


class ReviewCommentReadStatus(db.Model):
    __tablename__ = 'review_comment_read_status'

    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('review_comments.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    read_at = db.Column(db.DateTime, default=datetime.utcnow)

    comment = db.relationship("ReviewComment", backref="read_statuses")
    user = db.relationship("User", back_populates="review_read_status")

    def __repr__(self):
        return f"<ReadStatus user={self.user_id} comment={self.comment_id}>"
