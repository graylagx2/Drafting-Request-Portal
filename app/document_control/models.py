# app/document_control/models.py

from datetime import datetime, timezone
import uuid

from sqlalchemy import (
    Column, String, Integer, DateTime, Boolean, ForeignKey, Text,
    Enum as PgEnum, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.extensions import db
from app.models.folder import Folder
from app.document_control.enums import (
    RevisionCode, StatusCode, SensitivityClass, ComplianceTag
)

class DocumentMaster(db.Model):
    __tablename__ = "document_masters"

    id = Column(UUID(as_uuid=True), primary_key=True,
                default=uuid.uuid4)
    document_number = Column(String(50), unique=True,
                             nullable=False, index=True)
    title           = Column(String(255), nullable=False)
    unit            = Column(String(50), nullable=False)
    sheet_number    = Column(String(20), nullable=False)

    discipline             = Column(String(100), nullable=True)
    responsible_engineer   = Column(String(100), nullable=True)
    originating_department = Column(String(100), nullable=True)

    status      = Column(PgEnum(StatusCode),
                         default=StatusCode.DR, nullable=False)
    sensitivity = Column(PgEnum(SensitivityClass),
                         default=SensitivityClass.INTERNAL,
                         nullable=False)
    compliance  = Column(PgEnum(ComplianceTag), nullable=True)

    created_at     = Column(DateTime(timezone=True),
                            default=lambda: datetime.now(timezone.utc))
    effective_date = Column(DateTime(timezone=True), nullable=True)
    review_due     = Column(DateTime(timezone=True), nullable=True)
    retired_at     = Column(DateTime(timezone=True), nullable=True)

    is_master      = Column(Boolean, default=True)
    retention_rule = Column(String(100), nullable=True)

    revisions = relationship(
        "DocumentRevision",
        back_populates="master",
        cascade="all, delete-orphan",
        order_by="DocumentRevision.created_at.desc()"
    )

    def __repr__(self):
        return f"<DocMaster {self.document_number} – {self.title}>"

class DocumentRevision(db.Model):
    __tablename__ = "document_revisions"

    id           = Column(UUID(as_uuid=True), primary_key=True,
                          default=uuid.uuid4)
    master_id    = Column(UUID(as_uuid=True),
                          ForeignKey("document_masters.id"),
                          nullable=False, index=True)
    revision_code = Column(PgEnum(RevisionCode),
                           default=RevisionCode.A, nullable=False)
    file_key     = Column(String(512), nullable=False)
    checksum     = Column(String(128), nullable=False)
    file_size    = Column(Integer, nullable=False)

    created_at     = Column(DateTime(timezone=True),
                            default=lambda: datetime.now(timezone.utc))
    uploaded_by_id = Column(Integer, ForeignKey("users.id"),
                            nullable=False)
    comments       = Column(Text, nullable=True)

    master      = relationship("DocumentMaster",
                               back_populates="revisions")
    uploaded_by = relationship("User")

    checkouts = relationship(
        "CheckoutLog",
        back_populates="revision",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        num  = self.master.document_number if self.master else "?"
        code = self.revision_code.value
        return f"<DocRev {num}-{code}>"

class CheckoutLog(db.Model):
    __tablename__ = "checkout_logs"

    id             = Column(Integer, primary_key=True)
    revision_id    = Column(UUID(as_uuid=True),
                            ForeignKey("document_revisions.id"),
                            nullable=False, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"),
                            nullable=False)
    purpose        = Column(String(255), nullable=True)
    checked_out_at = Column(DateTime(timezone=True),
                            default=lambda: datetime.now(timezone.utc))
    returned_at    = Column(DateTime(timezone=True), nullable=True)

    revision = relationship("DocumentRevision",
                            back_populates="checkouts")
    user     = relationship("User")

    def is_active(self):
        return self.returned_at is None

    def __repr__(self):
        return (f"<Checkout user={self.user.username} "
                f"doc={self.revision.master.document_number} "
                f"rev={self.revision.revision_code.value}>")

class ChangeRequest(db.Model):
    __tablename__ = "change_requests"

    id                  = Column(Integer, primary_key=True)
    master_id           = Column(UUID(as_uuid=True),
                                 ForeignKey("document_masters.id"),
                                 nullable=False)
    requested_by_id     = Column(Integer, ForeignKey("users.id"),
                                 nullable=False)
    reason              = Column(Text, nullable=False)
    impact_assessment   = Column(Text, nullable=True)
    risk_level          = Column(String(50), nullable=True)
    status              = Column(PgEnum(StatusCode),
                                 default=StatusCode.FR,
                                 nullable=False)
    created_at          = Column(DateTime(timezone=True),
                                 default=lambda: datetime.now(timezone.utc))
    due_date            = Column(DateTime(timezone=True), nullable=True)

    master         = relationship("DocumentMaster")
    requested_by   = relationship("User")

    def __repr__(self):
        return (f"<CR {self.id} doc={self.master.document_number} "
                f"status={self.status.value}>")

class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"),
                        nullable=False)
    action     = Column(String(100), nullable=False)
    entity_type= Column(String(50), nullable=False)
    entity_id  = Column(String(50), nullable=False)
    timestamp  = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc))
    details    = Column(Text, nullable=True)

    user = relationship("User")

    def __repr__(self):
        return (f"<Audit {self.user.username} {self.action} "
                f"{self.entity_type}:{self.entity_id}>")
