# app/document_control/api/documents.py

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path # Ensure Path is imported
from uuid import UUID # Keep if your IDs are UUIDs

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
# werkzeug.utils.secure_filename is not directly needed here anymore for create_document
# but might be for upload_revision if it still handles files.

from app.extensions import db
from app.services.storage_adapter import LocalFSAdapter # Still needed for checksum/size
from app.document_control.enums import RevisionCode, StatusCode # Assuming SensitivityClass is also here or imported
from app.document_control.models import (
    DocumentMaster,
    DocumentRevision,
    CheckoutLog,
    AuditLog,
    # ChangeRequest, # Keep if used elsewhere
)
# Import User model correctly
from app.models import User


# Ensure blueprint name matches registration, e.g., url_prefix="/api/documents"
bp = Blueprint("doc_api", __name__, url_prefix="/api/documents")


def _compute_checksum(file_path: Path) -> str:
    """Computes MD5 checksum for a file at the given Path object."""
    md5 = hashlib.md5()
    try:
        with file_path.open("rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5.update(chunk)
        return md5.hexdigest()
    except FileNotFoundError:
        current_app.logger.error(f"Checksum calculation: File not found at {file_path}")
        raise
    except Exception as e:
        current_app.logger.error(f"Checksum calculation: Error reading file {file_path}: {e}", exc_info=True)
        raise


@bp.route("", methods=["POST"])
@login_required
def create_document():
    """
    Registers an already uploaded file as a new controlled document master
    with an initial revision.
    Expects JSON payload:
      document_number, title, unit, sheet_number, status (optional, defaults to DR),
      sensitivity (optional, defaults to INTERNAL), comments (optional),
      file_key (mandatory - relative path of the pre-uploaded file in MEDIA_ROOT)
    """
    data = request.get_json()
    if not data:
        return jsonify(error="Invalid JSON payload"), 400

    # --- Required DCS Metadata ---
    doc_num = data.get("document_number", "").strip()
    title = data.get("title", "").strip()
    unit = data.get("unit", "").strip()
    sheet = data.get("sheet_number", "").strip()
    # --- file_key for the pre-uploaded file ---
    file_key = data.get("file_key", "").strip() # e.g., "MyFolder/MyFile.pdf" or "MyFile.pdf"

    if not (doc_num and title and unit and sheet and file_key):
        return jsonify(error="Missing required fields: document_number, title, unit, sheet_number, file_key"), 400

    # --- Optional DCS Metadata ---
    status_str = data.get("status", "DR").strip().upper() # Default to Draft
    # Assuming SensitivityClass is available via enums
    sensitivity_str = data.get("sensitivity", "INTERNAL").strip().upper()
    comments = data.get("comments", "").strip()

    # Validate Status
    try:
        status_enum = StatusCode[status_str]
    except KeyError:
        valid_codes = ', '.join(StatusCode.__members__.keys())
        return jsonify(error=f"Invalid status code. Valid codes: {valid_codes}"), 400

    # Validate Sensitivity (Assuming SensitivityClass is imported from enums)
    # from app.document_control.enums import SensitivityClass # Ensure this import
    try:
        sensitivity_enum = SensitivityClass[sensitivity_str]
    except KeyError:
        valid_sensitivities = ', '.join(SensitivityClass.__members__.keys())
        return jsonify(error=f"Invalid sensitivity class. Valid classes: {valid_sensitivities}"), 400
    except NameError: # If SensitivityClass was not imported
        current_app.logger.error("SensitivityClass enum not available/imported.")
        return jsonify(error="Server configuration error for sensitivity processing."), 500


    if DocumentMaster.query.filter_by(document_number=doc_num).first():
        return jsonify(error="Document number already exists"), 409 # Conflict

    # --- Verify file exists and get its properties ---
    adapter = LocalFSAdapter()
    try:
        # Resolve the file_key to an absolute path
        # The file_key is relative to MEDIA_ROOT
        physical_file_path = adapter._resolve(file_key) # _resolve expects path relative to base_path
        if not physical_file_path.is_file():
            return jsonify(error=f"Specified file_key '{file_key}' does not point to a valid file or was not found."), 404

        checksum = _compute_checksum(physical_file_path)
        size = physical_file_path.stat().st_size
    except ValueError as e: # From _resolve if path is invalid
        current_app.logger.warning(f"Invalid file_key '{file_key}' provided: {e}")
        return jsonify(error=f"Invalid file_key: {e}"), 400
    except FileNotFoundError:
        return jsonify(error=f"File not found for file_key '{file_key}'. Ensure it was uploaded correctly."), 404
    except Exception as e:
        current_app.logger.error(f"Error accessing file or calculating checksum for '{file_key}': {e}", exc_info=True)
        return jsonify(error="Failed to process the specified file."), 500

    # --- Create Database Records ---
    master = DocumentMaster(
        document_number=doc_num,
        title=title,
        unit=unit,
        sheet_number=sheet,
        status=status_enum,
        sensitivity=sensitivity_enum,
        # Add other master fields if provided in 'data' and part of your model
    )
    db.session.add(master)
    try:
        db.session.flush() # To get master.id for revision and audit log
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error flushing session for new DocumentMaster: {e}", exc_info=True)
        return jsonify(error="Database error during document master creation."), 500

    initial_revision_code = RevisionCode.A # Or your default starting revision

    rev = DocumentRevision(
        master_id=master.id,
        revision_code=initial_revision_code,
        file_key=file_key, # Store the path as received
        checksum=checksum,
        file_size=size,
        uploaded_by_id=current_user.id,
        comments=comments,
    )
    db.session.add(rev)
    try:
        db.session.flush() # To get rev.id for audit log
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error flushing session for new DocumentRevision: {e}", exc_info=True)
        return jsonify(error="Database error during document revision creation."), 500

    audit = AuditLog(
        user_id=current_user.id,
        action="create_document_and_revision", # Or a more specific action name
        entity_type="DocumentMaster",
        entity_id=str(master.id),
        details=json.dumps({
            "revision_id": str(rev.id),
            "revision_code": initial_revision_code.value,
            "file_key": file_key,
            "title": title,
            "status": status_enum.value,
            "sensitivity": sensitivity_enum.value,
            "comments": comments
        }),
    )
    db.session.add(audit)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error committing transaction for new document: {e}", exc_info=True)
        return jsonify(error="Database commit failed."), 500

    return jsonify(
        message="Document registered successfully.",
        master_id=str(master.id),
        revision_id=str(rev.id),
        file_key=file_key
    ), 201

# ... other routes (list_documents, list_revisions, upload_revision, checkout, checkin, etc.) ...
# These will also need review:
# - upload_revision: Will it still handle file uploads, or will it also expect a pre-uploaded file_key?
#                    If it handles uploads, how does it determine the storage path now?
# - list_documents / list_revisions: Ensure they correctly reflect the new storage reality.
#                                     download_url construction will be simpler if file_key is the direct path.

# Placeholder for list_documents - review its output based on new requirements
@bp.route("", methods=["GET"])
@login_required
def list_documents():
    # This function needs to be reviewed.
    # The `latest_revision` and associated checkout info logic might be complex
    # if revisions can have arbitrary file_keys.
    # For now, returning a simplified list.
    docs = DocumentMaster.query.order_by(
        DocumentMaster.created_at.desc()
    ).all()
    result = []
    for d in docs:
        latest_rev_obj = d.revisions[0] if d.revisions else None # Assumes revisions are ordered by created_at desc in model
        result.append({
            "id": str(d.id),
            "document_number": d.document_number,
            "title": d.title,
            "unit": d.unit,
            "status": d.status.value,
            "sensitivity": d.sensitivity.value,
            "created_at": d.created_at.isoformat(),
            "latest_revision_code": latest_rev_obj.revision_code.value if latest_rev_obj else None,
            "latest_revision_id": str(latest_rev_obj.id) if latest_rev_obj else None,
            # Add checkout status if needed, requires querying CheckoutLog for latest_rev_obj.id
        })
    return jsonify(documents=result)

# --- upload_revision needs significant rework ---
# Option 1: Frontend uploads new file via /files/upload, then calls this with new file_key.
# Option 2: This endpoint still takes a file, but how does it determine the path?
#           Does it overwrite the old file_key's file? Or store new file in same "folder" as old file_key?
# For now, let's assume Option 1: expects a new file_key.
@bp.route("/<uuid:doc_id>/revisions", methods=["POST"])
@login_required
def upload_revision(doc_id):
    """
    Registers an already uploaded file as a new revision for an existing document.
    Expects JSON payload:
      file_key (mandatory - relative path of the pre-uploaded file in MEDIA_ROOT)
      comments (optional)
    Requires the document to be checked in.
    """
    master = DocumentMaster.query.get_or_404(doc_id)
    data = request.get_json()
    if not data:
        return jsonify(error="Invalid JSON payload"), 400

    new_file_key = data.get("file_key", "").strip()
    if not new_file_key:
        return jsonify(error="Missing required field: file_key"), 400

    # --- Check if latest revision is checked out ---
    latest_revision = None
    # Ensure revisions are loaded and sorted correctly to find the true latest
    sorted_revisions = sorted(master.revisions, key=lambda r: r.created_at, reverse=True)
    if sorted_revisions:
        latest_revision = sorted_revisions[0]
        active_checkout = CheckoutLog.query.filter_by(
            revision_id=latest_revision.id,
            returned_at=None
        ).first()
        if active_checkout:
            checked_out_user = User.query.get(active_checkout.user_id)
            username = checked_out_user.username if checked_out_user else "Unknown User"
            return jsonify(error=f"Cannot upload new revision. Latest revision (Rev {latest_revision.revision_code.value}) is checked out by {username}."), 409

    # --- Determine Next revision code ---
    all_possible_codes = list(RevisionCode)
    next_code = RevisionCode.A
    if latest_revision:
        try:
            last_code_index = all_possible_codes.index(latest_revision.revision_code)
            if last_code_index >= len(all_possible_codes) - 1:
                return jsonify(error="Maximum revision code reached"), 400
            next_code = all_possible_codes[last_code_index + 1]
        except ValueError:
             current_app.logger.error(f"Revision code {latest_revision.revision_code} not found in RevisionCode enum for doc {doc_id}")
             return jsonify(error="Inconsistent revision sequence detected"), 500

    # --- Verify new file exists and get its properties ---
    adapter = LocalFSAdapter()
    try:
        physical_file_path = adapter._resolve(new_file_key)
        if not physical_file_path.is_file():
            return jsonify(error=f"Specified new file_key '{new_file_key}' does not point to a valid file."), 404
        checksum = _compute_checksum(physical_file_path)
        size = physical_file_path.stat().st_size
    except ValueError as e:
        current_app.logger.warning(f"Invalid new_file_key '{new_file_key}' provided: {e}")
        return jsonify(error=f"Invalid new_file_key: {e}"), 400
    except FileNotFoundError:
        return jsonify(error=f"File not found for new_file_key '{new_file_key}'. Ensure it was uploaded correctly."), 404
    except Exception as e:
        current_app.logger.error(f"Error accessing file or calculating checksum for '{new_file_key}': {e}", exc_info=True)
        return jsonify(error="Failed to process the specified new file."), 500

    # --- Create New Revision Record ---
    rev = DocumentRevision(
        master_id=master.id,
        revision_code=next_code,
        file_key=new_file_key, # Store the new path
        checksum=checksum,
        file_size=size,
        uploaded_by_id=current_user.id,
        comments=data.get("comments", "").strip(),
    )
    db.session.add(rev)
    try:
        db.session.flush()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error flushing session for new revision: {e}", exc_info=True)
        return jsonify(error="Database error during revision creation."), 500

    # --- Audit Log ---
    audit = AuditLog(
        user_id=current_user.id,
        action="upload_revision",
        entity_type="DocumentRevision",
        entity_id=str(rev.id),
        details=json.dumps({
            "master_id": str(master.id),
            "revision_code": next_code.value,
            "file_key": new_file_key,
            "comments": rev.comments
        }),
    )
    db.session.add(audit)

    # --- Commit ---
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error committing new revision: {e}", exc_info=True)
        return jsonify(error="Database commit failed."), 500

    return jsonify(
        message="New revision registered successfully.",
        revision_id=str(rev.id),
        revision_code=next_code.value,
        file_key=new_file_key
    ), 201


# --- list_revisions, download_revision, checkout, checkin, revision_status ---
# These routes should still largely work, but download_revision's URL construction
# will be simpler as file_key is now the direct relative path.
# The logic for checkout/checkin (preventing double checkout, etc.) remains valid.

@bp.route("/<uuid:doc_id>/revisions/<uuid:rev_id>/download", methods=["GET"])
@login_required
def download_revision(doc_id, rev_id):
    """Return the public URL for downloading a revision file."""
    rev = DocumentRevision.query.filter_by(id=rev_id, master_id=doc_id).first_or_404()
    media_url = current_app.config.get("MEDIA_URL", "/static/") # Default if not set
    if not rev.file_key:
         current_app.logger.error(f"Revision {rev_id} has no associated file key.")
         return jsonify(error="File key missing for this revision"), 500
    # file_key is now the direct relative path from MEDIA_ROOT
    download_url = f"{media_url.rstrip('/')}/{rev.file_key.lstrip('/')}"
    # Log audit for download
    # ... (audit log code as before) ...
    return jsonify(url=download_url), 200 # 200 OK, frontend handles redirect/download

# Checkout and Checkin logic would remain largely the same,
# as they operate on revision IDs, not directly on file paths for their core logic.
# Make sure they are included and tested.

@bp.route("/<uuid:doc_id>/revisions/<uuid:rev_id>/checkout", methods=["POST"])
@login_required
def checkout_revision(doc_id, rev_id):
    master = DocumentMaster.query.get_or_404(doc_id)
    rev = DocumentRevision.query.filter_by(id=rev_id, master_id=doc_id).first_or_404()
    active_checkout = CheckoutLog.query.filter_by(revision_id=rev.id, returned_at=None).first()
    if active_checkout:
        checked_out_user = User.query.get(active_checkout.user_id)
        username = checked_out_user.username if checked_out_user else "Unknown User"
        return jsonify(error=f"Revision already checked out by {username}"), 409
    data = request.get_json(force=True) or {}
    purpose = data.get("purpose", "").strip()
    if not purpose: return jsonify(error="Purpose for checkout is required"), 400
    chk = CheckoutLog(revision_id=rev.id, user_id=current_user.id, purpose=purpose, checked_out_at=datetime.now(timezone.utc))
    db.session.add(chk)
    audit = AuditLog(user_id=current_user.id, action="checkout", entity_type="DocumentRevision", entity_id=str(rev.id), details=json.dumps({"purpose": purpose}))
    db.session.add(audit)
    try: db.session.commit()
    except Exception as e: db.session.rollback(); current_app.logger.error(f"Error committing checkout: {e}", exc_info=True); return jsonify(error="Database error during checkout"), 500
    return jsonify(checkout_id=str(chk.id), checked_out_at=chk.checked_out_at.isoformat()), 200

@bp.route("/<uuid:doc_id>/revisions/<uuid:rev_id>/checkin", methods=["POST"])
@login_required
def checkin_revision(doc_id, rev_id):
    master = DocumentMaster.query.get_or_404(doc_id)
    rev = DocumentRevision.query.filter_by(id=rev_id, master_id=doc_id).first_or_404()
    chk = CheckoutLog.query.filter_by(revision_id=rev.id, user_id=current_user.id, returned_at=None).first()
    if not chk:
        any_checkout = CheckoutLog.query.filter_by(revision_id=rev.id, returned_at=None).first()
        if any_checkout:
             checked_out_user = User.query.get(any_checkout.user_id)
             username = checked_out_user.username if checked_out_user else "Unknown User"
             return jsonify(error=f"Cannot check in. Revision is checked out by {username}."), 403
        else: return jsonify(error="Revision is not currently checked out by you."), 404
    chk.returned_at = datetime.now(timezone.utc)
    db.session.add(chk)
    audit = AuditLog(user_id=current_user.id, action="checkin", entity_type="DocumentRevision", entity_id=str(rev.id), details=json.dumps({"checkout_id": str(chk.id)}))
    db.session.add(audit)
    try: db.session.commit()
    except Exception as e: db.session.rollback(); current_app.logger.error(f"Error committing checkin: {e}", exc_info=True); return jsonify(error="Database error during checkin"), 500
    return jsonify(message="Check-in successful", returned_at=chk.returned_at.isoformat()), 200

@bp.route("/revisions/status", methods=["GET"])
@login_required
def revision_status():
    path = request.args.get("path", "").strip()
    if not path: return jsonify(error="Missing 'path' query parameter"), 400
    rev = DocumentRevision.query.filter_by(file_key=path).first_or_404()
    active_checkouts = CheckoutLog.query.options(db.joinedload(CheckoutLog.user)).filter_by(revision_id=rev.id, returned_at=None).all()
    checkout_details = [{"username": co.user.username if co.user else "System", "purpose": co.purpose, "checked_out_at": co.checked_out_at.isoformat()} for co in active_checkouts]
    return jsonify({"revision_id": str(rev.id), "master_id": str(rev.master_id), "is_checked_out": len(active_checkouts) > 0, "checkout_count": len(active_checkouts), "checkouts": checkout_details})

