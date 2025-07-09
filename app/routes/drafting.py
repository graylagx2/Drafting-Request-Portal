# app/routes/drafting.py

"""
Routes for submitting and managing drafting tickets.
"""

import uuid
import logging
from pathlib import Path
from flask import (
    Blueprint, render_template, request, redirect,
    url_for, flash, jsonify, current_app, session
)
from flask_login import login_required, current_user
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from app.extensions import db
from app.data.unit_list import UNIT_LIST
from app.models.ticket import DraftingTicket
from app.models.user import User
from app.models.ticket_attachment import TicketAttachment
from app.services.ticket_manager import generate_ticket_number
from app.services.file_manager import save_uploaded_file
from app.services.email_service import send_email

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

drafting_bp = Blueprint("drafting", __name__)


@drafting_bp.route("/submit", methods=["GET", "POST"])
@login_required
def submit_request():
    """
    GET: Returns modal HTML with engineer list and submission token.
    POST: Creates ticket with unique ticket_number, ensures directory structure,
          saves uploads, sends notification, returns JSON or redirect.
    """
    if request.method == "POST":
        form_token = request.form.get("submission_token")
        session_token = session.pop("submission_token", None)
        if not form_token or form_token != session_token:
            flash("This form has already been submitted.", "warning")
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify(success=False, error="Duplicate submission"), 400
            return redirect(url_for("drafting.view_tickets"))

        try:
            logger.info("Processing new drafting request submission.")

            # Define expected fields and optional defaults
            field_defaults = {
                "priority": 3,
                "paint_spec": "N/A",
                "pwht_temp": "N/A",
                "pwht_hold": "N/A",
                "insulation_spec": "N/A",
            }

            # Collect all fields from the form into a dictionary
            form_data = {
                field: request.form.get(field, default)
                for field, default in field_defaults.items()
            }

            # Add remaining fields not needing defaults
            additional_fields = [
                "unit", "work_order", "moc", "description", "request_type",
                "review_engineer", "service", "pipe_spec", "operating_psig",
                "operating_temp", "design_psig", "design_temp",
                "nde_rt", "nde_pt", "pressure_test"
            ]
            for field in additional_fields:
                form_data[field] = request.form.get(field)

            # Special case: override service if request_type is RFI
            if form_data["request_type"] == "rfi":
                form_data["service"] = request.form.get("equipment_number")

            # **FIX:** remove raw 'review_engineer' key so we don't assign a string
            form_data.pop("review_engineer", None)

            # Typecast critical fields
            form_data["priority"] = int(form_data["priority"])
            review_engineer = request.form.get("review_engineer")
            if not review_engineer or not review_engineer.isdigit():
                raise ValueError("Review engineer is required.")
            form_data["review_engineer_id"] = int(review_engineer)

            # Validate required fields
            required_fields = ["unit", "description", "request_type"]
            for field in required_fields:
                if not form_data.get(field):
                    raise ValueError(f"Missing required field: {field}")

            # Generate unique ticket_number
            ticket_number = generate_ticket_number()
            while DraftingTicket.query.filter_by(ticket_number=ticket_number).first():
                ticket_number = generate_ticket_number()

            # Construct ticket
            new_ticket = DraftingTicket(
                ticket_number=ticket_number,
                status="Pending",
                submitted_by_id=current_user.id,
                **form_data
            )

            db.session.add(new_ticket)
            db.session.flush()

            # Ensure directory structure
            ticket_base = Path(current_app.root_path) / "static" / \
                "drafting_tickets" / new_ticket.ticket_number
            for subdir in ("drafting", "revisions", "completed", "requesters_submissions", "review"):
                (ticket_base / subdir).mkdir(parents=True, exist_ok=True)

            # Save initial uploads
            for f in request.files.getlist("attachments"):
                if f and f.filename:
                    rel = save_uploaded_file(f, new_ticket.ticket_number)
                    db.session.add(TicketAttachment(
                        ticket_id=new_ticket.id,
                        file_path=rel,
                        filename=f.filename,
                        uploaded_by_id=current_user.id,
                        category="request"
                    ))

            db.session.commit()
            flash("Drafting request submitted successfully.", "success")

            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify(success=True)
            return redirect(url_for("drafting.view_tickets"))

        except IntegrityError:
            db.session.rollback()
            logger.error("Ticket number collision, please retry.")
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify(success=False, error="Ticket number collision. Please try again."), 400
            flash("System error generating ticket number. Please try again.", "danger")
            return redirect(url_for("drafting.submit_request"))

        except Exception as e:
            logger.exception("Drafting submission failed")
            db.session.rollback()
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify(success=False, error=str(e)), 500
            flash("Error submitting request: " + str(e), "danger")
            return redirect(url_for("drafting.view_tickets"))

    # GET
    token = str(uuid.uuid4())
    session["submission_token"] = token
    engineers = User.query.filter_by(role="engineer").all()
    return render_template(
        "pages/requests/submit_modal.html",
        unit_list=UNIT_LIST,
        engineer_list=engineers,
        submission_token=token
    )


@drafting_bp.route("/tickets")
@login_required
def view_tickets():
    return render_template("pages/drafting/ticket_view.html")


@drafting_bp.route("/my-requests-modal")
@login_required
def my_requests_modal():
    user_requests = (
        DraftingTicket.query.filter_by(submitted_by_id=current_user.id)
        .order_by(DraftingTicket.created_at.desc())
        .options(
            db.joinedload(DraftingTicket.review_engineer),
            db.joinedload(DraftingTicket.attachments)
        )
        .all()
    )
    return render_template("pages/requests/my_requests_modal.html", requests=user_requests)


@drafting_bp.route("/admin/tickets/modal")
@login_required
def admin_tickets_modal():
    if not current_user.has_role("admin"):
        flash("Unauthorized access.", "danger")
        return redirect(url_for("dashboard.index"))

    new_tickets = DraftingTicket.query.filter_by(status="Pending") \
        .order_by(DraftingTicket.created_at.desc()).all()
    assigned_tickets = DraftingTicket.query.filter(
        DraftingTicket.status.notin_(["Pending", "Completed"])
    ).order_by(DraftingTicket.created_at.desc()).all()
    completed_tickets = DraftingTicket.query.filter_by(status="Completed") \
        .order_by(DraftingTicket.created_at.desc()).all()
    analytics_data = {}

    return render_template(
        "pages/drafting/admin_ticket_modal.html",
        new_tickets=new_tickets,
        assigned_tickets=assigned_tickets,
        completed_tickets=completed_tickets,
        analytics_data=analytics_data
    )


@drafting_bp.route("/assign_modal")
@login_required
def assign_modal():
    if not current_user.has_role("admin"):
        flash("Unauthorized access.", "danger")
        return "", 403

    ticket_id = request.args.get("ticket_id")
    if not ticket_id:
        return "Missing ticket ID", 400

    ticket = DraftingTicket.query.get(ticket_id)
    if not ticket:
        return "Ticket not found", 404

    drafters = User.query.filter_by(role="drafter").all()
    return render_template("pages/drafting/assign_modal.html", ticket=ticket, drafters=drafters)


@drafting_bp.route("/assign", methods=["POST"])
@login_required
def assign_ticket():
    if not current_user.has_role("admin"):
        return jsonify(success=False, error="Unauthorized"), 403

    ticket_id = request.form.get("ticket_id")
    drafter_id = request.form.get("drafter_id")
    if not ticket_id or not drafter_id:
        return jsonify(success=False, error="Missing data"), 400

    ticket = DraftingTicket.query.get(ticket_id)
    if not ticket:
        return jsonify(success=False, error="Ticket not found"), 404

    ticket.assigned_to_id = drafter_id
    ticket.status = "In Progress"
    try:
        db.session.commit()
        return jsonify(success=True)
    except Exception as e:
        db.session.rollback()
        return jsonify(success=False, error=str(e)), 500


@drafting_bp.route("/drafter/tickets/modal")
@login_required
def drafter_tickets_modal():
    if not current_user.has_role("drafter"):
        flash("Unauthorized access.", "danger")
        return redirect(url_for("dashboard.index"))

    assigned_tickets = (
        DraftingTicket.query.filter_by(assigned_to_id=current_user.id)
        .order_by(DraftingTicket.created_at.desc())
        .all()
    )
    return render_template("pages/drafting/drafter_ticket_modal.html", tickets=assigned_tickets)


@drafting_bp.route("/ticket/<ticket_number>/upload-review", methods=["POST"])
@login_required
def upload_review_document(ticket_number):
    """
    Upload a single PDF into the ticket's review folder and record it in DB.
    """
    ticket = DraftingTicket.query.filter_by(
        ticket_number=ticket_number).first()
    if not ticket or ticket.assigned_to_id != current_user.id:
        return jsonify(success=False, error="Unauthorized"), 403

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify(success=False, error="No file provided"), 400

    filename = secure_filename(file.filename)
    if not filename.lower().endswith(".pdf"):
        return jsonify(success=False, error="Only PDF allowed"), 400

    review_dir = Path(current_app.root_path) / "static" / \
        "drafting_tickets" / ticket_number / "review"
    review_dir.mkdir(parents=True, exist_ok=True)

    # Save to filesystem
    file_path = review_dir / filename
    file.save(str(file_path))

    # Record in DB so engineer sees it
    rel_path = f"drafting_tickets/{ticket_number}/review/{filename}"
    attachment = TicketAttachment(
        ticket_id=ticket.id,
        uploaded_by_id=current_user.id,
        file_path=rel_path,
        filename=filename,
        category="review",
        version=1,
        is_latest=True
    )
    db.session.add(attachment)
    try:
        db.session.commit()
        return jsonify(success=True)
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to record review attachment")
        return jsonify(success=False, error=str(e)), 500


@drafting_bp.route("/ticket/<ticket_number>/submit-review", methods=["POST"])
@login_required
def submit_ticket_review(ticket_number):
    """
    Change ticket status to In-Review once PDF is present.
    """
    ticket = DraftingTicket.query.filter_by(
        ticket_number=ticket_number).first()
    if not ticket or ticket.assigned_to_id != current_user.id:
        return jsonify(success=False, error="Unauthorized"), 403

    ticket.status = "In-Review"
    try:
        db.session.commit()
        return jsonify(success=True)
    except Exception as e:
        db.session.rollback()
        return jsonify(success=False, error=str(e)), 500


@drafting_bp.route("/archive/<ticket>/<path:subpath>", methods=["GET"])
@drafting_bp.route("/archive/<ticket>", defaults={"subpath": ""}, methods=["GET"])
@login_required
def archive_browser(ticket, subpath):
    """
    Returns JSON listing of directories and files under
    static/drafting_tickets/<ticket>/<subpath>.
    """
    base = Path(current_app.root_path) / "static" / "drafting_tickets" / ticket
    target = (base / subpath).resolve()

    if not str(target).startswith(str(base)) or not target.exists():
        return jsonify(error="Invalid path"), 400
    if not target.is_dir():
        return jsonify(error="Not a directory"), 400

    entries = []
    for child in sorted(target.iterdir()):
        entries.append({
            "name": child.name,
            "type": "directory" if child.is_dir() else "file",
            "path": (subpath + "/" + child.name).lstrip("/")
        })
    return jsonify(entries)
