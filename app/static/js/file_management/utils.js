// static/js/file_management/utils.js

/**
 * Debounces a function to limit the rate at which it's called.
 * @param {function} func - The function to debounce.
 * @param {number} wait - The delay in milliseconds.
 * @returns {function} - The debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str - The string to escape.
 * @returns {string} - The escaped string.
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;'; // Use numerical entity for single quotes
            default: return match;
        }
    });
}


/**
 * Formats file size in bytes to a human-readable string (KB, MB, GB).
 * @param {number} bytes - The file size in bytes.
 * @returns {string} - The formatted file size string.
 */
export function formatFileSize(bytes) {
    if (bytes === 0 || typeof bytes !== 'number') return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Gets the parent path from a full path string.
 * Returns empty string ('') if the path is already root or has no slashes.
 * @param {string} path - The full path string (e.g., 'folder/subfolder/item').
 * @returns {string} - The parent path (e.g., 'folder/subfolder').
 */
export function getParentPath(path) {
    if (!path || typeof path !== 'string') return '';
    const lastSlashIndex = path.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        return ''; // No parent path, already at root level
    }
    return path.substring(0, lastSlashIndex);
}


// --- User Feedback Functions ---
// These are basic implementations. Consider using a dedicated notification library.

/** Shows a generic loading overlay or indicator */
export function showLoading(message = 'Loading...') {
    // TODO: Implement a proper loading indicator UI
    console.log(`Loading Indicator ON: ${message}`);
    // Example: document.getElementById('loading-overlay').style.display = 'flex';
}

/** Hides the generic loading overlay or indicator */
export function hideLoading() {
    // TODO: Implement hiding the loading indicator UI
    console.log('Loading Indicator OFF');
     // Example: document.getElementById('loading-overlay').style.display = 'none';
}

/**
 * Attempts to generate a user-friendly error message from various error types.
 * Handles custom error objects from fetchApi {status, message, data}
 * and standard Error objects.
 * @param {any} error - The error object caught.
 * @returns {Promise<string>} - A promise that resolves with the error message string.
 */
export async function generateErrorFromResponse(error) {
    let errorMessage = 'An unknown error occurred.';

    if (error && typeof error === 'object') {
        // Check if it's the custom object from fetchApi (has status and message)
        if (error.hasOwnProperty('status') && error.hasOwnProperty('message')) {
            // Use the message directly, as it's already processed in fetchApi
            errorMessage = error.message || `HTTP error! status: ${error.status}`;
             // Optionally include details from error.data if useful
             // if (error.data && error.data.details) errorMessage += ` Details: ${error.data.details}`;
        }
        // Check if it's a standard Error object
        else if (error instanceof Error && error.message) {
            errorMessage = error.message;
        }
        // Fallback if it's an object but not recognized format
        else {
            try {
                 // Attempt to stringify if it's an unknown object structure
                 errorMessage = JSON.stringify(error);
            } catch (e) {
                 // Ignore stringify errors
            }
        }
    } else if (error) {
        // If error is not an object (e.g., just a string thrown)
        errorMessage = String(error);
    }

    // Log the processed/original error for debugging
    console.warn("generateErrorFromResponse processed:", errorMessage, "Original error:", error);

    // This function previously tried response.clone(), which was incorrect here.
    // The logic now directly uses the message from the passed error object.

    // Return the extracted/generated message
    return errorMessage;
}


/**
 * Shows an error message to the user (e.g., using an alert or a toast notification).
 * @param {string} message - The error message to display.
 */
export function showError(message) {
    // TODO: Replace alert with a non-blocking notification UI (toast)
    console.error(`Showing Error: ${message}`);
    alert(`Error: ${message}`);
    // Example: toastLibrary.error(message);
}

/**
 * Shows a success message to the user.
 * @param {string} message - The success message to display.
 */
export function showSuccess(message) {
     // TODO: Replace alert with a non-blocking notification UI (toast)
    console.log(`Showing Success: ${message}`);
    alert(`Success: ${message}`);
    // Example: toastLibrary.success(message);
}