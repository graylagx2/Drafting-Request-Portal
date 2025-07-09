from datetime import datetime
from app.extensions import db
from app.models.enums import SensitivityClass, Role

class Folder(db.Model):
    __tablename__ = 'folders'
    id            = db.Column(db.Integer, primary_key=True)
    path          = db.Column(db.String(512), unique=True, nullable=False)
    sensitivity   = db.Column(db.Enum(SensitivityClass,
                                      name='sensitivity_enum',
                                      native_enum=False),
                              nullable=False,
                              default=SensitivityClass.INTERNAL)
    allowed_roles = db.Column(db.JSON, nullable=False,
                         default=lambda: [r.value for r in Role])
    created_by_id = db.Column(db.Integer,
                              db.ForeignKey('users.id'),
                              nullable=False)
    created_at    = db.Column(db.DateTime(timezone=True),
                              default=lambda: datetime.utcnow())

    created_by    = db.relationship('User')
