# app/services/file_manager.py

"""
Handles file saving, versioning, and cleanup for drafting tickets.
"""

from werkzeug.utils import secure_filename
from flask import current_app
from app.services.storage_adapter import LocalFSAdapter


def save_uploaded_file(file, ticket_number):
    """
    Save an uploaded file into the 
    'drafting_tickets/<ticket_number>/requesters_submissions' folder.

    Parameters:
        file (FileStorage): the uploaded file object
        ticket_number (str): used to build the directory path

    Returns:
        str: POSIX-style relative path for DB storage or url_for('static', ...)
    """
    # Build logical prefix
    prefix = f"drafting_tickets/{ticket_number}/requesters_submissions"

    # Instantiate adapter (will use MEDIA_ROOT if set, 
    # otherwise fall back to static/)
    adapter = LocalFSAdapter()

    # Optionally secure the filename (adapter also secures internally)
    file.filename = secure_filename(file.filename)

    # Save via adapter; returns relative key like
    # "drafting_tickets/25DDDC080/requesters_submissions/foo.pdf"
    key = adapter.save(prefix, file)

    return key
