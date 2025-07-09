#!/usr/bin/env python3
import sys
from pathlib import Path
from io import BytesIO

# 1) Allow 'import app' from project root
SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app import create_app

def main():
    # 2) Build your Flask app (uses real DB)
    app = create_app()
    app.config.update({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,   # ← disable CSRF so login works
    })

    client = app.test_client()

    # 3) Log in as your real user
    rv = client.post(
        "/auth/login",
        data={"username": "mleonard", "password": "password"},
        follow_redirects=True
    )
    print("Login:", rv.status_code)
    if rv.status_code != 200:
        print(rv.data.decode())
        return

    # 4) List document masters
    rv = client.get("/api/documents")
    print("List Documents:", rv.status_code, rv.get_json())
    docs = rv.get_json().get("documents", [])
    if not docs:
        print("❌ No documents found. Create one via POST /api/documents first.")
        return

    doc_id = docs[0]["id"]
    print("Using document id:", doc_id)

    # 5) Upload revision
    pdf = BytesIO(b"%PDF-1.4\n%Test PDF content\n")
    data = {
        "comments": "Automated test",
        "file": (pdf, "initial.pdf")
    }
    rv = client.post(
        f"/api/documents/{doc_id}/revisions",
        data=data,
        content_type="multipart/form-data"
    )
    print("Upload Revision:", rv.status_code, rv.get_json())
    if rv.status_code != 201:
        return
    rev_id = rv.get_json()["revision_id"]

    # 6) Checkout
    rv = client.post(
        f"/api/documents/{doc_id}/revisions/{rev_id}/checkout",
        json={"purpose": "Testing checkout"}
    )
    print("Checkout:", rv.status_code, rv.get_json())
    if rv.status_code != 200:
        return

    # 7) Checkin
    rv = client.post(
        f"/api/documents/{doc_id}/revisions/{rev_id}/checkin"
    )
    print("Checkin:", rv.status_code, rv.get_json())

if __name__ == "__main__":
    main()
