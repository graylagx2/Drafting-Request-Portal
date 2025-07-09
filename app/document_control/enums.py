# app/document_control/enums.py

from enum import Enum, auto

class RevisionCode(Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"

class StatusCode(Enum):
    DR = "Draft"
    FR = "For Review"
    FC = "For Construction"
    AB = "As-Built"
    SP = "Superseded"

class SensitivityClass(Enum):
    PUBLIC = "Public"
    INTERNAL = "Internal"
    CONFIDENTIAL = "Confidential"

class ComplianceTag(Enum):
    ISO_9001 = "ISO 9001"
    API_STANDARD = "API Standard"
    HSE_CATEGORY = "HSE Category"

class Role(Enum):
    VIEWER = "viewer"
    AUTHOR = "author"
    APPROVER = "approver"
    DOC_CONTROL_ADMIN = "doc_control_admin"
