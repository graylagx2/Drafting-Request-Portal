# app/routes/engineering.py
"""
Engineering routes for project overview, review queue, PDF annotation, comments, and revision loop.
"""

import logging
from pathlib import Path
from flask import (
    Blueprint, render_template, request, url_for,
    flash, jsonify, abort, current_app
)
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app.extensions import db
from app.models.ticket import DraftingTicket
from app.models.revision_history import RevisionHistory
from app.models.review_comment import ReviewComment
from app.models.ticket_attachment import TicketAttachment
from app.models.user import User

engineering_bp = Blueprint("engineering", __name__)
logger = logging.getLogger(__name__)

@engineering_bp.route("/overview")
@login_required
def project_overview():
    return render_template("pages/engineering/project_overview.html")

@engineering_bp.route("/review")
@login_required
def review_queue():
    review_tickets = (
        DraftingTicket.query
        .filter_by(status="In-Review", review_engineer_id=current_user.id)
        .order_by(DraftingTicket.created_at.desc())
        .all()
    )
    return render_template("pages/engineering/review_queue.html", review_tickets=review_tickets)

@engineering_bp.route("/performance")
@login_required
def performance_dashboard():
    return render_template("pages/engineering/performance_dashboard.html")

@engineering_bp.route("/ticket/<ticket_number>/preview-file/<filename>")
@login_required
def preview_pdf_file(ticket_number, filename):
    ticket = DraftingTicket.query.filter_by(
        ticket_number=ticket_number
    ).first_or_404()

    if ticket.review_engineer_id != current_user.id:
        flash("Unauthorized access.", "danger")
        return "", 403

    matching_attachment = next(
        (
            a for a in ticket.attachments
            if a.file_path.lower().endswith(filename.lower())
            and 'review/' in a.file_path.lower()
        ),
        None
    )
    if not matching_attachment:
        flash("File not found.", "danger")
        return "", 404

    pdf_url = url_for("static", filename=Path(matching_attachment.file_path).as_posix())
    return render_template(
        "pages/engineering/pdf_annotation_snippet.html",
        pdf_url=pdf_url
    )

@engineering_bp.route("/tickets/modal", methods=["GET"])
@login_required
def engineer_tickets_modal():
    in_review = (
        DraftingTicket.query
        .filter_by(status="In-Review", review_engineer_id=current_user.id)
        .order_by(DraftingTicket.created_at.desc())
        .all()
    )
    completed = (
        DraftingTicket.query
        .filter_by(status="Completed", review_engineer_id=current_user.id)
        .order_by(DraftingTicket.created_at.desc())
        .all()
    )
    return render_template(
        "pages/engineering/engineer_ticket_modal.html",
        in_review_tickets=in_review,
        completed_tickets=completed
    )

@engineering_bp.route("/ticket/<ticket_number>/approve", methods=["POST"])
@login_required
def approve_ticket(ticket_number):
    ticket = DraftingTicket.query.filter_by(
        ticket_number=ticket_number
    ).first_or_404()
    if ticket.review_engineer_id != current_user.id:
        return jsonify(success=False, error="Unauthorized"), 403

    ticket.status = "Completed"

    last_rev = (
        RevisionHistory.query
        .filter_by(ticket_id=ticket.id)
        .order_by(RevisionHistory.revision_number.desc())
        .first()
    )
    next_rev = last_rev.revision_number + 1 if last_rev else 1

    rev = RevisionHistory(
        ticket_id=ticket.id,
        revision_number=next_rev,
        status="approved",
        message="Approved by engineer",
        reviewed_by_id=current_user.id
    )
    db.session.add(rev)

    try:
        db.session.commit()
        return jsonify(success=True)
    except Exception as e:
        db.session.rollback()
        logger.exception("Approval failed")
        return jsonify(success=False, error=str(e)), 500

@engineering_bp.route("/ticket/<ticket_number>/request-revision", methods=["POST"])
@login_required
def request_revision(ticket_number):
    """
    Requests a revision: sets ticket to 'Revise' and records a revision entry.
    """
    ticket = DraftingTicket.query.filter_by(
        ticket_number=ticket_number
    ).first_or_404()
    if ticket.review_engineer_id != current_user.id:
        return jsonify(success=False, error="Unauthorized"), 403

    ticket.status = "Revise"

    last_rev = (
        RevisionHistory.query
        .filter_by(ticket_id=ticket.id)
        .order_by(RevisionHistory.revision_number.desc())
        .first()
    )
    next_rev = last_rev.revision_number + 1 if last_rev else 1

    rev = RevisionHistory(
        ticket_id=ticket.id,
        revision_number=next_rev,
        status="revise",
        message="Revision requested by engineer",
        reviewed_by_id=current_user.id
    )
    db.session.add(rev)

    try:
        db.session.commit()
        return jsonify(success=True)
    except Exception as e:
        db.session.rollback()
        logger.exception("Revision request failed")
        return jsonify(success=False, error=str(e)), 500

@engineering_bp.route("/ticket/<ticket_number>/upload-annotated", methods=["POST"])
@login_required
def upload_annotated_pdf(ticket_number):
    """
    Accepts an annotated PDF from the engineer and saves it as <file>_ENGINEER_REVISIONS.pdf in the review folder.
    """
    ticket = DraftingTicket.query.filter_by(
        ticket_number=ticket_number
    ).first_or_404()
    if ticket.review_engineer_id != current_user.id:
        return jsonify(success=False, error="Unauthorized"), 403

    file = request.files.get("file")
    orig_filename = request.form.get("original_filename", "annotated.pdf")
    if not file or not file.filename:
        return jsonify(success=False, error="No file provided"), 400

    # Save as <originalfilename>_ENGINEER_REVISIONS.pdf
    base_name = Path(orig_filename).stem
    revision_filename = f"{base_name}_ENGINEER_REVISIONS.pdf"
    review_dir = Path(current_app.root_path) / "static" / "drafting_tickets" / ticket_number / "review"
    review_dir.mkdir(parents=True, exist_ok=True)
    file_path = review_dir / revision_filename
    file.save(str(file_path))

    # Record in DB
    rel_path = f"drafting_tickets/{ticket_number}/review/{revision_filename}"
    attachment = TicketAttachment(
        ticket_id=ticket.id,
        uploaded_by_id=current_user.id,
        file_path=rel_path,
        filename=revision_filename,
        category="review",
        version=1,
        is_latest=True
    )
    db.session.add(attachment)
    try:
        db.session.commit()
        return jsonify(success=True, filename=revision_filename)
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to record annotated review attachment")
        return jsonify(success=False, error=str(e)), 500

@engineering_bp.route("/ticket/<ticket_number>/comment", methods=["POST"])
@login_required
def post_review_comment(ticket_number):
    ticket = DraftingTicket.query.filter_by(
        ticket_number=ticket_number
    ).first_or_404()
    if ticket.review_engineer_id != current_user.id:
        return jsonify(success=False, error="Unauthorized"), 403

    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    page_number = data.get("page_number")

    if not message:
        return jsonify(success=False, error="Message is required"), 400

    comment = ReviewComment(
        ticket_id=ticket.id,
        user_id=current_user.id,
        message=message,
        page_number=page_number
    )
    db.session.add(comment)

    try:
        db.session.commit()
        return jsonify(success=True, comment=comment.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to post review comment")
        return jsonify(success=False, error=str(e)), 500

@engineering_bp.route("/ticket/<ticket_number>/comments", methods=["GET"])
@login_required
def get_review_comments(ticket_number):
    ticket = DraftingTicket.query.filter_by(
        ticket_number=ticket_number
    ).first_or_404()
    if ticket.review_engineer_id != current_user.id and ticket.assigned_to_id != current_user.id:
        return jsonify(success=False, error="Unauthorized"), 403

    comments = (
        ticket.review_comments
        .order_by(ReviewComment.created_at.asc())
        .all()
    )
    result = []
    for c in comments:
        author = User.query.get(c.user_id)
        result.append({
            **c.to_dict(),
            "author_name": author.actual_name if author else "User"
        })
    return jsonify(result)
