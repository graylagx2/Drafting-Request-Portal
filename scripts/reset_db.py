import sys
from pathlib import Path

# Dynamically add project root to PYTHONPATH
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from app import create_app, db

app = create_app()
with app.app_context():
    db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
    db_path = Path(db_uri.replace("sqlite:///", ""))

    print(f"[DEBUG] Target DB Path: {db_path}")

    try:
        # Confirm instance directory exists
        db_path.parent.mkdir(parents=True, exist_ok=True)

        # Remove old DB file if it exists
        if db_path.exists():
            db_path.unlink()
            print("[✓] Existing DB deleted.")
        else:
            print("[✓] No existing DB to delete.")

        # Create fresh tables
        db.create_all()
        print("[✓] Database reset and initialized.")
    except Exception as e:
        print(f"[X] Failed to reset database: {e}")
