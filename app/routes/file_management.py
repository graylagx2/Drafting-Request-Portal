# app/routes/file_management.py
"""
API blueprint for robust file and folder management within MEDIA_ROOT.
Includes fetching document metadata for listed files.
"""

import logging
import os
import errno
import shutil
from pathlib import Path
from flask import Blueprint, request, jsonify, current_app, Response
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from sqlalchemy.orm import joinedload, selectinload # For efficient querying

# Assuming LocalFSAdapter is correctly located
from app.services.storage_adapter import LocalFSAdapter
# Import necessary models (adjust paths if needed)
# Assuming db is imported via extensions
from app.extensions import db
# Assuming models are in these locations based on previous context
# Make sure these imports point to the correct model definitions
from app.document_control.models import DocumentRevision, DocumentMaster
from app.models import User # Assuming User model is in app/models.py

# Ensure the blueprint name matches how it's registered in your app factory
file_mgmt_bp = Blueprint('file_management', __name__, url_prefix='/files')
logger = logging.getLogger(__name__)

# --- Configuration Constants ---
IGNORED_TOP_LEVEL_DIRS = {'js', 'css', 'img', 'lib'}
PROTECTED_ROOT_FOLDERS = {'archive', 'documents'} # Add other essential folders

# --- Helper Functions (Defined locally) ---

def make_error_response(message: str, status_code: int) -> Response:
    """Creates a standardized JSON error response."""
    return jsonify(error=message), status_code

def sanitize_relative_path(user_path: str) -> str:
    """
    Cleans and validates a user-provided relative path.
    Prevents directory traversal and leading/trailing slashes.
    Returns a clean, relative POSIX-style path string (or '' for root).
    Raises ValueError if the path is invalid or potentially unsafe.
    """
    if user_path is None:
        raise ValueError("Path cannot be null.")
    # Normalize slashes for consistency (POSIX style)
    normalized_path = user_path.strip().replace('\\', '/')
    # Collapse separators, remove '.', '..', and leading/trailing slashes
    # Use os.path.normpath carefully, ensure it doesn't resolve outside intended root implicitly
    normalized_path = os.path.normpath(normalized_path)
    # Remove leading/trailing slashes AFTER normalization
    normalized_path = normalized_path.strip('/')
    # Prevent directory traversal attempts explicitly after normalization
    # Check path components individually
    if '..' in normalized_path.split('/'):
        raise ValueError("Invalid path: Directory traversal detected.")
    # Disallow absolute paths (should be relative to MEDIA_ROOT)
    # Check after normalization as normpath might resolve differently
    if os.path.isabs(normalized_path) or normalized_path.startswith('/'):
         raise ValueError("Invalid path: Absolute paths are not allowed.")
    # Return empty string for root, otherwise the cleaned path
    # Handle the case where normpath results in '.' for empty or '/' input
    return normalized_path if normalized_path != '.' else ''

def sanitize_filename(user_filename: str) -> str:
    """
    Cleans and validates a user-provided filename using Werkzeug's secure_filename.
    Raises ValueError if the filename is empty or becomes empty after sanitization.
    """
    if not user_filename:
        raise ValueError("Filename cannot be empty.")
    safe_name = secure_filename(user_filename.strip())
    if not safe_name:
        raise ValueError("Invalid filename provided (disallowed characters or empty after sanitization).")
    return safe_name

# --- Permission Helpers ---

def _check_role_permission(required_roles: list[str]) -> bool:
    """Checks if the current user's single role is in the required list."""
    if not current_user.is_authenticated:
        return False
    user_role = getattr(current_user, 'role', None)
    if not user_role:
        logger.error("Permission check failed: User %s has no role attribute.", current_user.get_id())
        return False
    return user_role in required_roles

def check_permission(permission_type: str, context_path: str = None) -> tuple[bool, str]:
    """
    Checks permission for a given type and context.
    Returns: tuple[bool, str]: (permission_granted, error_message_if_denied)
    """
    permission_granted = False
    error_message = "Permission denied."
    required_roles = []
    user_role = getattr(current_user, 'role', 'N/A') # Get role for logging

    if permission_type == 'read':
        permission_granted = current_user.is_authenticated
        error_message = "Read access requires authentication."
        required_roles = ['Any Authenticated']
    elif permission_type == 'write':
        required_roles = ['engineer', 'drafter', 'admin']
        permission_granted = _check_role_permission(required_roles)
        error_message = "Write permission required (Engineer, Drafter, or Admin)."
    elif permission_type == 'create':
        is_root_creation = (context_path is None or context_path == '')
        if is_root_creation:
            required_roles = ['drafter', 'admin'] # Stricter for root
            permission_granted = _check_role_permission(required_roles)
            error_message = "Permission denied to create folders at the root level (Drafter or Admin required)."
        else:
            required_roles = ['engineer', 'drafter', 'admin'] # Same as write for subdirs
            permission_granted = _check_role_permission(required_roles)
            error_message = "Permission denied to create subfolders (Engineer, Drafter, or Admin required)."
    elif permission_type == 'delete':
        required_roles = ['drafter', 'admin']
        permission_granted = _check_role_permission(required_roles)
        error_message = "Delete permission required (Drafter or Admin)."
    else:
        logger.warning("Unknown permission type requested: %s", permission_type)
        error_message = f"Unknown permission type '{permission_type}'."

    if not permission_granted:
         logger.warning(
             "Permission denied for user %s (ID: %s, Role: %s) for action '%s' on path '%s'. Required: %s",
             getattr(current_user, 'username', 'N/A'), current_user.get_id(), user_role,
             permission_type, context_path or '<root>', required_roles
         )
    return permission_granted, error_message

# --- API Routes ---

@file_mgmt_bp.route('', methods=['GET'])
@login_required
def list_entries():
    """
    List files and folders under a given relative path within MEDIA_ROOT.
    Includes document metadata (uploader, date, status, sensitivity) for files
    that correspond to DocumentRevisions.
    """
    granted, error_msg = check_permission('read')
    if not granted:
        return make_error_response(f'Unauthorized: {error_msg}', 403)

    relative_path_str = request.args.get('path', '')
    try:
        relative_path = sanitize_relative_path(relative_path_str)
        adapter = LocalFSAdapter()
        logger.debug("Listing entries for sanitized path: '%s'", relative_path)

        # 1. List basic file/folder info from the adapter
        filesystem_entries = adapter.list(relative_path)
        logger.debug("Found %d entries in filesystem for path '%s'", len(filesystem_entries), relative_path)

        # 2. Identify potential document file keys from the listed files
        potential_file_keys = [
            entry['path'] for entry in filesystem_entries if entry.get('type') == 'file' and entry.get('path')
        ]
        logger.debug("Potential file keys for DB lookup: %s", potential_file_keys)

        document_metadata = {} # Dictionary to store metadata keyed by file_key/path
        if potential_file_keys:
            logger.debug("Querying database for metadata...")
            # 3. Query the database efficiently for matching DocumentRevisions
            # Fetch revision, its uploader, and its master document in one query
            try:
                revisions = db.session.query(DocumentRevision).options(
                    joinedload(DocumentRevision.uploaded_by.of_type(User)), # Eager load User
                    selectinload(DocumentRevision.master)      # Eager load DocumentMaster
                ).filter(
                    DocumentRevision.file_key.in_(potential_file_keys)
                ).all()
                logger.debug("Database query returned %d matching revisions.", len(revisions))
            except Exception as db_err:
                 logger.error("Database query failed during metadata lookup: %s", db_err, exc_info=True)
                 # Decide how to handle DB errors - maybe proceed without metadata?
                 # For now, we'll log and continue, pills won't show.
                 revisions = [] # Ensure revisions is an empty list if query fails

            # 4. Process the query results into the metadata dictionary
            for rev in revisions:
                # Ensure file_key exists and is not None before using as key
                if rev.file_key:
                    # Safely access related objects and their attributes
                    uploader_username = getattr(rev.uploaded_by, 'username', 'Unknown') if rev.uploaded_by else 'Unknown'
                    created_iso = rev.created_at.isoformat() if rev.created_at else None
                    is_master_flag = getattr(rev.master, 'is_master', None) if rev.master else None
                    status_val = getattr(rev.master.status, 'value', None) if rev.master and rev.master.status else None
                    sensitivity_val = getattr(rev.master.sensitivity, 'value', None) if rev.master and rev.master.sensitivity else None
                    doc_id_str = str(rev.master_id) if rev.master_id else None
                    rev_id_str = str(rev.id) if rev.id else None

                    metadata = {
                        'uploaded_by': uploader_username,
                        'created_at_iso': created_iso,
                        'is_master': is_master_flag,
                        'status': status_val,
                        'sensitivity': sensitivity_val,
                        'doc_id': doc_id_str,
                        'rev_id': rev_id_str
                    }
                    document_metadata[rev.file_key] = metadata
                    logger.debug("Metadata found for key '%s': %s", rev.file_key, metadata)

        # 5. Merge filesystem info with document metadata
        merged_entries = []
        for entry in filesystem_entries:
            entry_path = entry.get('path')
            # Check if it's a file and if we found metadata for its path
            if entry.get('type') == 'file' and entry_path and entry_path in document_metadata:
                logger.debug("Merging metadata for path: %s", entry_path)
                # Merge the found metadata into the entry dictionary
                entry.update(document_metadata[entry_path])
            else:
                 logger.debug("No metadata found or not a file for path: %s", entry_path)
            merged_entries.append(entry) # Add entry (original or updated) to the final list

        # Optional: Filter ignored folders (only if listing root and MEDIA_ROOT is static/)
        static_path = Path(current_app.root_path) / 'static'
        if not relative_path and static_path.is_dir() and adapter.base_path == static_path:
            merged_entries = [item for item in merged_entries if item.get('name') not in IGNORED_TOP_LEVEL_DIRS]

        # Sort entries: folders first, then files, alphabetically by name
        merged_entries.sort(key=lambda x: (x.get('type', 'file') != 'directory', x.get('name', '').lower()))

        logger.debug("User %s listed entries for path: '%s'", current_user.get_id(), relative_path)
        return jsonify(entries=merged_entries) # Return the merged list

    except ValueError as e:
        logger.warning("list_entries invalid path '%s' by user %s: %s", relative_path_str, current_user.get_id(), e)
        return make_error_response(f'Invalid path specified: {e}', 400)
    except FileNotFoundError:
         logger.debug("list_entries path not found: '%s' for user %s", relative_path, current_user.get_id())
         return jsonify(entries=[]) # OK if path doesn't exist
    except PermissionError as e:
        logger.error("Permission error listing entries for path '%s' by user %s: %s", relative_path, current_user.get_id(), e, exc_info=True)
        return make_error_response(f'Permission denied accessing path.', 403)
    except Exception as e:
        # Log the full exception details for server-side debugging
        logger.exception("Unexpected error listing entries for path '%s' by user %s: %s", relative_path, current_user.get_id(), e)
        return make_error_response('Failed to list directory contents due to a server error.', 500)


# --- Upload Route (Includes permission checks) ---
@file_mgmt_bp.route('/upload', methods=['POST'])
@login_required
def upload():
    """Upload files, checking root vs subdir permissions."""
    relative_path_str = request.form.get('path', '')
    try:
        relative_path = sanitize_relative_path(relative_path_str)
    except ValueError as e:
        logger.warning("Upload rejected: Invalid target path '%s' by user %s (ID: %s). Error: %s", relative_path_str, getattr(current_user, 'username', 'N/A'), current_user.get_id(), e)
        return make_error_response('Invalid target path specified.', 400)

    is_root_upload = (relative_path == '')
    # Check permission based on whether it's a root upload or not
    if is_root_upload:
        # Use 'create' permission check with root context
        granted, error_msg = check_permission('create', context_path='')
    else:
        # Use standard 'write' permission check for subdirectories
        granted, error_msg = check_permission('write')

    if not granted:
        # Logging is handled within check_permission
        return make_error_response(f'Unauthorized: {error_msg}', 403)

    files = request.files.getlist('files')
    if not files or all(not f.filename for f in files):
         logger.warning("Upload rejected: No files provided by user %s (ID: %s) for path '%s'.", getattr(current_user, 'username', 'N/A'), current_user.get_id(), relative_path)
         return make_error_response('No files selected for upload.', 400)

    # Initialize storage adapter
    try:
        adapter = LocalFSAdapter()
    except Exception as e:
        logger.exception("Failed to initialize storage adapter for user %s: %s", current_user.get_id(), e)
        return make_error_response("Storage configuration error.", 500)

    saved_keys = []
    errors = []
    # Process each file
    for f in files:
        if not (f and f.filename): continue # Skip empty file parts

        original_filename = f.filename
        safe_filename = "unknown_file" # Default for logging if sanitization fails
        try:
            # Sanitize filename
            safe_filename = sanitize_filename(original_filename)
            f.filename = safe_filename # Use sanitized name for saving

            # --- Add File Type/Size Checks Here (Recommended) ---
            # Example:
            # allowed_extensions = current_app.config.get('ALLOWED_EXTENSIONS', set())
            # if '.' not in safe_filename or safe_filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
            #     raise ValueError("File type not allowed.")
            # max_size = current_app.config.get('MAX_UPLOAD_SIZE', 100 * 1024 * 1024) # Example: 100MB
            # if f.content_length > max_size:
            #     raise ValueError(f"File size exceeds limit ({max_size // 1024 // 1024}MB).")

            # Save the file
            key = adapter.save(relative_path, f)
            saved_keys.append(key)
            logger.info("User %s (ID: %s) successfully uploaded file '%s' to %s", getattr(current_user, 'username', 'N/A'), current_user.get_id(), original_filename, key)

        except ValueError as e: # Catches sanitization, type, size errors
             error_msg = f"Invalid file '{original_filename}': {e}"
             errors.append(error_msg)
             logger.warning("Upload issue for user %s (ID: %s): %s", getattr(current_user, 'username', 'N/A'), current_user.get_id(), error_msg)
        except PermissionError as e: # Filesystem permission errors
            logger.error("Server permission error saving file '%s' (as '%s') to path '%s' by user %s (ID: %s): %s", original_filename, safe_filename, relative_path, getattr(current_user, 'username', 'N/A'), current_user.get_id(), e, exc_info=True)
            errors.append(f"Server error saving '{original_filename}': Permission denied.")
        except FileExistsError: # If adapter.save might raise this
             logger.warning("Upload issue for user %s (ID: %s): File '%s' (as '%s') already exists at '%s'.", getattr(current_user, 'username', 'N/A'), current_user.get_id(), original_filename, safe_filename, relative_path)
             errors.append(f"File '{original_filename}' already exists.")
        except Exception as e: # Catch-all for other unexpected errors
            logger.error("Unexpected error saving file '%s' (as '%s') to path '%s' by user %s (ID: %s): %s", original_filename, safe_filename, relative_path, getattr(current_user, 'username', 'N/A'), current_user.get_id(), e, exc_info=True)
            errors.append(f"Failed to save '{original_filename}' due to an unexpected server error.")

    # --- Response Handling ---
    if errors:
         status_code = 207 if saved_keys else 400 # Multi-Status or Bad Request
         logger.warning("Upload for user %s (ID: %s) to path '%s' completed with %d errors and %d successes. Errors: %s", getattr(current_user, 'username', 'N/A'), current_user.get_id(), relative_path, len(errors), len(saved_keys), "; ".join(errors))
         return jsonify(saved=saved_keys, errors=errors), status_code
    else:
         logger.info("User %s (ID: %s) successfully uploaded %d file(s) to '%s'", getattr(current_user, 'username', 'N/A'), current_user.get_id(), len(saved_keys), relative_path)
         return jsonify(saved=saved_keys), 201 # 201 Created


# --- Other Routes (create_folder, rename, move, delete, list_root_folders) ---
# These remain unchanged from the previous cleaned-up version.

@file_mgmt_bp.route('/folder', methods=['POST'])
@login_required
def create_folder():
    """Create a new folder."""
    data = request.get_json(force=True) or {}
    parent_relative_path = ''
    new_folder_name = ''
    try:
        parent_relative_path = sanitize_relative_path(data.get('path', ''))
        new_folder_name = sanitize_filename(data.get('name', ''))
    except ValueError as e:
         logger.warning("create_folder invalid input by user %s: %s", current_user.get_id(), e)
         return make_error_response(f'Invalid path or folder name: {e}', 400)

    granted, error_msg = check_permission('create', context_path=parent_relative_path)
    if not granted:
        return make_error_response(f'Unauthorized: {error_msg}', 403)

    try:
        adapter = LocalFSAdapter()
        new_key = adapter.make_directory(parent_relative_path, new_folder_name)
        logger.info("User %s created folder '%s' in '%s' (Result path: %s)", current_user.get_id(), new_folder_name, parent_relative_path or '<root>', new_key)
        return jsonify(path=new_key, name=new_folder_name), 201
    except FileExistsError:
        logger.warning("Attempt by user %s to create existing folder '%s' in '%s'", current_user.get_id(), new_folder_name, parent_relative_path or '<root>')
        return make_error_response(f"Folder '{new_folder_name}' already exists.", 409)
    except ValueError as e:
        logger.warning("create_folder adapter/path error for user %s, path '%s', name '%s': %s", current_user.get_id(), parent_relative_path, new_folder_name, e)
        return make_error_response(f'Invalid path or name specified: {e}', 400)
    except FileNotFoundError:
         logger.warning("create_folder parent path not found '%s' for user %s", parent_relative_path, current_user.get_id())
         return make_error_response('Parent directory does not exist.', 404)
    except PermissionError as e:
        logger.error("Permission error creating folder '%s' in '%s' by user %s: %s", new_folder_name, parent_relative_path, current_user.get_id(), e, exc_info=True)
        return make_error_response('Permission denied during folder creation.', 403)
    except Exception as e:
        logger.exception("Error creating folder '%s' in '%s' by user %s: %s", new_folder_name, parent_relative_path, current_user.get_id(), e)
        return make_error_response('Cannot create folder due to server error.', 500)

@file_mgmt_bp.route('/rename', methods=['PATCH'])
@login_required
def rename():
    """Rename a file or folder."""
    granted, error_msg = check_permission('write')
    if not granted: return make_error_response(f'Unauthorized: {error_msg}', 403)
    data = request.get_json(force=True) or {}
    old_rel_path, new_name = '', ''
    try:
        old_rel_path = sanitize_relative_path(data.get('path', ''))
        new_name = sanitize_filename(data.get('new_name', ''))
    except ValueError as e:
        logger.warning("rename invalid input by user %s: %s", current_user.get_id(), e)
        return make_error_response(f'Invalid path or new name: {e}', 400)
    if not old_rel_path: return make_error_response('Original path cannot be empty.', 400)
    if old_rel_path in PROTECTED_ROOT_FOLDERS:
        logger.warning("User %s attempted to rename protected folder '%s'", current_user.get_id(), old_rel_path)
        return make_error_response(f"Cannot rename protected system folder '{old_rel_path}'.", 403)
    try:
        adapter = LocalFSAdapter(); new_key = adapter.rename(old_rel_path, new_name)
        logger.info("User %s renamed '%s' to '%s' (Result path: %s)", current_user.get_id(), old_rel_path, new_name, new_key)
        return jsonify(success=True, path=new_key, name=new_name)
    except ValueError as e: logger.warning("rename adapter/path error for user %s, path '%s', name '%s': %s", current_user.get_id(), old_rel_path, new_name, e); return make_error_response(f'Invalid path specified: {e}', 400)
    except FileNotFoundError: logger.warning("rename path not found '%s' for user %s", old_rel_path, current_user.get_id()); return make_error_response('Original file or folder not found.', 404)
    except FileExistsError: logger.warning("rename conflict by user %s: Item named '%s' already exists", current_user.get_id(), new_name); return make_error_response(f"An item named '{new_name}' already exists.", 409)
    except PermissionError as e: logger.error("Permission error renaming '%s' to '%s' by user %s: %s", old_rel_path, new_name, current_user.get_id(), e, exc_info=True); return make_error_response('Permission denied during rename.', 403)
    except Exception as e: logger.exception("Error renaming '%s' to '%s' by user %s: %s", old_rel_path, new_name, current_user.get_id(), e); return make_error_response('Cannot rename item due to server error.', 500)

@file_mgmt_bp.route('/move', methods=['PATCH'])
@login_required
def move():
    """Move a file or folder."""
    granted, error_msg = check_permission('write')
    if not granted: return make_error_response(f'Unauthorized: {error_msg}', 403)
    data = request.get_json(force=True) or {}
    source_rel_path, dest_folder_rel_path = '', ''
    try:
        source_rel_path = sanitize_relative_path(data.get('path', ''))
        dest_folder_rel_path = sanitize_relative_path(data.get('dest', ''))
    except ValueError as e: logger.warning("move invalid input by user %s: %s", current_user.get_id(), e); return make_error_response(f'Invalid source or destination path: {e}', 400)
    if not source_rel_path: return make_error_response('Source path cannot be empty.', 400)
    if source_rel_path in PROTECTED_ROOT_FOLDERS: logger.warning("User %s attempted to move protected folder '%s'", current_user.get_id(), source_rel_path); return make_error_response(f"Cannot move protected system folder '{source_rel_path}'.", 403)
    if dest_folder_rel_path.startswith(source_rel_path + '/') or dest_folder_rel_path == source_rel_path: logger.warning("User %s attempted invalid move: '%s' into '%s'", current_user.get_id(), source_rel_path, dest_folder_rel_path); return make_error_response("Cannot move a folder into itself or one of its subdirectories.", 400)
    try:
        adapter = LocalFSAdapter(); new_key = adapter.move(source_rel_path, dest_folder_rel_path)
        item_name = source_rel_path.split('/')[-1]
        logger.info("User %s moved '%s' from '%s' to '%s' (Result path: %s)", current_user.get_id(), item_name, source_rel_path, dest_folder_rel_path or '<root>', new_key)
        return jsonify(success=True, path=new_key, name=item_name)
    except ValueError as e: logger.warning("move adapter/path error for user %s, source '%s', dest '%s': %s", current_user.get_id(), source_rel_path, dest_folder_rel_path, e); return make_error_response(f'Invalid source or destination path: {e}', 400)
    except FileNotFoundError: logger.warning("move source path not found '%s' for user %s", source_rel_path, current_user.get_id()); return make_error_response('Source file or folder not found.', 404)
    except NotADirectoryError: logger.warning("move destination not a directory '%s' for user %s", dest_folder_rel_path, current_user.get_id()); return make_error_response('Destination path is not a valid folder.', 400)
    except FileExistsError: item_name = source_rel_path.split('/')[-1]; logger.warning("move conflict by user %s: Item named '%s' already exists in destination '%s'", current_user.get_id(), item_name, dest_folder_rel_path or '<root>'); return make_error_response(f"An item named '{item_name}' already exists in the destination.", 409)
    except PermissionError as e: logger.error("Permission error moving '%s' to '%s' by user %s: %s", source_rel_path, dest_folder_rel_path, current_user.get_id(), e, exc_info=True); return make_error_response('Permission denied during move.', 403)
    except Exception as e: logger.exception("Error moving '%s' to '%s' by user %s: %s", source_rel_path, dest_folder_rel_path, current_user.get_id(), e); return make_error_response('Cannot move item due to server error.', 500)

@file_mgmt_bp.route('', methods=['DELETE'])
@login_required
def delete():
    """Delete a file or folder."""
    granted, error_msg = check_permission('delete')
    if not granted: return make_error_response(f'Unauthorized: {error_msg}', 403)
    data = request.get_json(force=True) or {}
    rel_path_to_delete = ''
    try: rel_path_to_delete = sanitize_relative_path(data.get('path', ''))
    except ValueError as e: logger.warning("delete invalid input by user %s: %s", current_user.get_id(), e); return make_error_response(f'Invalid path specified: {e}', 400)
    if not rel_path_to_delete: return make_error_response('Path is required for deletion.', 400)
    if rel_path_to_delete in PROTECTED_ROOT_FOLDERS: logger.warning("User %s attempted to delete protected folder '%s'", current_user.get_id(), rel_path_to_delete); return make_error_response(f"Cannot delete protected system folder '{rel_path_to_delete}'.", 403)
    try:
        adapter = LocalFSAdapter(); adapter.delete(rel_path_to_delete)
        logger.info("User %s deleted '%s'", current_user.get_id(), rel_path_to_delete)
        return jsonify(success=True)
    except ValueError as e: logger.warning("delete adapter/path error for user %s, path '%s': %s", current_user.get_id(), rel_path_to_delete, e); return make_error_response(f'Invalid path specified: {e}', 400)
    except FileNotFoundError: logger.warning("delete path not found '%s' for user %s", rel_path_to_delete, current_user.get_id()); return make_error_response('File or folder not found.', 404)
    except OSError as e:
         if e.errno == errno.ENOTEMPTY: logger.warning("User %s attempted to delete non-empty directory '%s'", current_user.get_id(), rel_path_to_delete); return make_error_response('Cannot delete folder: Directory is not empty.', 400)
         else: logger.error("OS error deleting '%s' by user %s: %s", rel_path_to_delete, current_user.get_id(), e, exc_info=True); error_message = f'Cannot delete item: {e.strerror}' if hasattr(e, 'strerror') else 'OS error during deletion'; return make_error_response(error_message, 500)
    except PermissionError as e: logger.error("Permission error deleting '%s' by user %s: %s", rel_path_to_delete, current_user.get_id(), e, exc_info=True); return make_error_response('Permission denied during deletion.', 403)
    except Exception as e: logger.exception("Error deleting '%s' by user %s: %s", rel_path_to_delete, current_user.get_id(), e); return make_error_response('Cannot delete item due to server error.', 500)

@file_mgmt_bp.route('/root/folders', methods=['GET'])
@login_required
def list_root_folders():
    """List top-level directories within MEDIA_ROOT for sidebar."""
    granted, error_msg = check_permission('read')
    if not granted: return make_error_response(f'Unauthorized: {error_msg}', 403)
    try:
        adapter = LocalFSAdapter(); all_entries = adapter.list('')
        folders = [entry for entry in all_entries if entry and entry.get('type') == 'directory']
        static_path = Path(current_app.root_path) / 'static'
        if static_path.is_dir() and adapter.base_path == static_path: folders = [f for f in folders if f.get('name') not in IGNORED_TOP_LEVEL_DIRS]
        folder_data = [{'name': f['name'], 'path': f['path'], 'type': 'directory'} for f in folders]
        folder_data.sort(key=lambda x: x['name'].lower())
        logger.debug("User %s listed root folders.", current_user.get_id())
        return jsonify(folders=folder_data)
    except ValueError as e: logger.error("list_root_folders path/adapter error for user %s: %s", current_user.get_id(), e); return make_error_response('Invalid storage path configuration.', 500)
    except PermissionError as e: logger.error("list_root_folders PermissionError for user %s: %s", current_user.get_id(), e, exc_info=True); return make_error_response('Permission denied accessing storage root.', 403)
    except Exception as e: logger.exception("list_root_folders unexpected error for user %s: %s", current_user.get_id(), e); return make_error_response('Server error listing root folders.', 500)

