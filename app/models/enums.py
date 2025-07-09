# app/models/enums.py
from enum import Enum

class Role(Enum):
    ADMIN            = "admin"
    DOC_CONTROL_ADMIN= "doc_control_admin"
    DRAFTER          = "drafter"
    ENGINEER         = "engineer"
    QC               = "qc"
    VIEWER           = "viewer"

class DocumentStatus(Enum):
    IN_DEVELOPMENT   = "In Development"
    UNDER_REVIEW     = "Under Review"
    APPROVED         = "Approved"
    ARCHIVED         = "Archived"
    SUPERSEDED       = "Superseded"

class SensitivityClass(Enum):
    CONFIDENTIAL    = "confidential"
    INTERNAL    = "internal"
    PUBLIC    = "public"
