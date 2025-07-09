"""
Registers all modular Blueprints to the app factory.
"""

from app.routes.dashboard import dashboard_bp
from app.routes.drafting import drafting_bp
from app.routes.engineering import engineering_bp
from app.routes.quality import quality_bp
from app.routes.document_control import document_control_bp
from app.routes.analytics import analytics_bp
from app.routes.file_management import file_mgmt_bp
