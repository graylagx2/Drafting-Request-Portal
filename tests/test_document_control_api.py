# tests/test_document_control_api.py

import pytest
from io import BytesIO
from uuid import UUID

from app import create_app
from app.extensions import db
from app.models.user import User
from app.document_control.models import DocumentMaster, DocumentRevision


@pytest.fixture
def app():
    """Create a Flask app configured for testing with in-memory SQLite."""
    app = create_app()
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "WTF_CSRF_ENABLED": False,
    })
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture
def test_user(app):
    """Create and return a test user."""
    u = User(
        username="tester",
        actual_name="Tester T",
        email="tester@example.com",
        role="author"
    )
    u.set_password("secret")
    db.session.add(u)
    db.session.commit()
    return u

@pytest.fixture
def logged_in_client(client, test_user):
    """Log in the test user and return the logged-in client."""
    resp = client.post(
        "/auth/login",
        data={"username": "tester", "password": "secret"},
        follow_redirects=True
    )
    assert resp.status_code == 200
    return client

@pytest.fixture
def doc_master(app):
    """Create and return a DocumentMaster record."""
    master = DocumentMaster(
        document_number="DOC-001",
        title="Test Doc",
        unit="U1",
        sheet_number="001"
    )
    db.session.add(master)
    db.session.commit()
    return master

def test_upload_first_revision(logged_in_client, doc_master, app):
    """
    Test uploading the very first revision for a DocumentMaster.
    """
    data = {
        # simulate form‐field "comments"
        "comments": "Initial upload"
    }
    # simulate a PDF file
    pdf_bytes = b"%PDF-1.4\n%Mock PDF content\n"
    data["file"] = (BytesIO(pdf_bytes), "initial.pdf")

    url = f"/api/documents/{doc_master.id}/revisions"
    rv = logged_in_client.post(
        url,
        data=data,
        content_type="multipart/form-data"
    )
    assert rv.status_code == 201, rv.get_data(as_text=True)

    payload = rv.get_json()
    assert "revision_id" in payload
    assert payload["revision_code"] == "A"
    assert payload["file_key"].endswith("initial.pdf")

    # verify in database
    with app.app_context():
        revs = DocumentRevision.query.filter_by(master_id=doc_master.id).all()
        assert len(revs) == 1
        rev = revs[0]
        assert rev.revision_code.value == "A"
        assert rev.comments == "Initial upload"
        # checksum should match our bytes
        import hashlib
        md5 = hashlib.md5(pdf_bytes).hexdigest()
        assert rev.checksum == md5

def test_upload_second_revision(logged_in_client, doc_master, app):
    """
    Test uploading a second revision and auto‐increment to 'B'.
    """
    # first revision
    first = BytesIO(b"PDFv1")
    response1 = logged_in_client.post(
        f"/api/documents/{doc_master.id}/revisions",
        data={"file": (first, "v1.pdf")},
        content_type="multipart/form-data"
    )
    assert response1.status_code == 201

    # second revision
    second = BytesIO(b"PDFv2")
    response2 = logged_in_client.post(
        f"/api/documents/{doc_master.id}/revisions",
        data={
            "file": (second, "v2.pdf"),
            "comments": "Second rev"
        },
        content_type="multipart/form-data"
    )
    assert response2.status_code == 201

    payload2 = response2.get_json()
    assert payload2["revision_code"] == "B"

    # verify two revisions in DB, newest first
    with app.app_context():
        revs = DocumentRevision.query.filter_by(
            master_id=doc_master.id
        ).order_by(DocumentRevision.created_at.desc()).all()
        assert len(revs) == 2
        assert revs[0].revision_code.value == "B"
        assert revs[0].comments == "Second rev"
        assert revs[1].revision_code.value == "A"
