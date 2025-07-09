// static/js/file_management/api.js

// Assuming utils.js is in the same directory or path is adjusted
import { showLoading, hideLoading, generateErrorFromResponse } from './utils.js';

/**
 * Performs a fetch request with standardized options and error handling.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options (method, headers, body, etc.).
 * @param {boolean} [showGenericLoading=false] - Show generic loading indicator.
 * @returns {Promise<any>} - Resolves with JSON response or rejects with error object {status, message, data}.
 */
async function fetchApi(url, options = {}, showGenericLoading = false) {
    if (showGenericLoading) showLoading();

    const defaultHeaders = {
        'Accept': 'application/json',
        // Add CSRF token header if needed (ensure getCsrfToken exists)
        // 'X-CSRFToken': getCsrfToken(),
    };

    // IMPORTANT: Do NOT set Content-Type for FormData requests.
    // The browser needs to set it automatically with the correct boundary.
    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    options.headers = { ...defaultHeaders, ...options.headers };
    // Ensure credentials (like session cookies) are sent
    options.credentials = 'include';

    console.log(`API Fetch Start: ${options.method || 'GET'} ${url}`, options); // Log options before fetch

    try {
        const response = await fetch(url, options);
        console.log(`API Fetch Response: ${response.status} ${response.statusText} for ${url}`); // Log response status

        // Prepare error object structure for consistency
        let errorPayload = {
            status: response.status,
            message: `HTTP error! Status: ${response.status}`,
            data: null,
            response: response // Include original response for potential further inspection
        };

        if (!response.ok) {
            try {
                // Try to parse error JSON from backend
                const errorData = await response.json();
                errorPayload.message = errorData?.error || errorPayload.message; // Use backend error message if available
                errorPayload.data = errorData;
                console.error(`API Error (${response.status}) JSON Parsed for ${url}:`, errorPayload.message, errorData);
            } catch (jsonError) {
                // If parsing JSON fails, use the plain text response body if available
                try {
                     const textError = await response.text();
                     if (textError) {
                         errorPayload.message = textError.substring(0, 200); // Limit length
                     }
                     console.error(`API Error (${response.status}) for ${url}. Could not parse JSON response. Body: ${textError.substring(0, 200)}...`);
                } catch (textErrorErr) {
                     console.error(`API Error (${response.status}) for ${url}. Could not parse JSON or text response.`);
                }
            }
            throw errorPayload; // Throw the structured error object
        }

        // Handle responses with no content (e.g., 204 No Content for DELETE)
        if (response.status === 204) {
            console.log(`API Success (204 No Content) for ${url}`);
            return null; // Indicate success with no body
        }

        // Attempt to parse JSON for successful responses
        try {
            const data = await response.json();
            console.log(`API Success (${response.status}) JSON Parsed for ${url}:`, data);
            return data;
        } catch (jsonError) {
             console.error(`API Success (${response.status}) for ${url}, but failed to parse JSON response:`, jsonError);
             // Throw a structured error even on success if JSON is expected but fails
             throw { status: response.status, message: 'Failed to parse successful response JSON.', data: null, originalError: jsonError };
        }

    } catch (error) {
        // Check if it's the structured error we threw from !response.ok or JSON parsing failure
        if (error && typeof error === 'object' && error.hasOwnProperty('status')) {
             console.error(`Fetch API (${options.method || 'GET'} ${url}) failed with HTTP Status ${error.status || 'N/A'}:`, error.message, error.data);
             // Re-throw the structured error object
             throw error;
        } else {
            // Likely a network error, CORS error, DNS error etc.
             const originalErrorMessage = error instanceof Error ? error.message : String(error);
             console.error(`Fetch API (${options.method || 'GET'} ${url}) failed: Network error or other issue.`, originalErrorMessage, error);
             // Throw a new standardized error object
             throw { status: undefined, message: originalErrorMessage || 'Network error or failed fetch', data: null, originalError: error };
        }
    } finally {
        if (showGenericLoading) hideLoading();
        console.log(`API Fetch End: ${options.method || 'GET'} ${url}`);
    }
}


// --- File/Folder Operations ---

/** Fetches root storage folders specifically for the sidebar */
export function fetchRootStorageFolders() {
    return fetchApi('/files/root/folders');
}

/** Fetches files and folders for a given storage path */
export function fetchStorageContents(path = '') {
    const encodedPath = encodeURIComponent(path);
    return fetchApi(`/files?path=${encodedPath}`);
}

// --- *** CORRECTED uploadFilesApi Signature *** ---
/**
 * Uploads files using FormData. Path should be included within the FormData object.
 * @param {FormData} formData - The FormData object containing 'path' and 'files'.
 */
export function uploadFilesApi(formData) {
    // Path is now expected to be *inside* the formData object
    // Do NOT pass path as a separate argument here.
    console.log("uploadFilesApi: Sending FormData to /files/upload", formData); // Log FormData before sending
    // You can also iterate through formData entries for detailed logging if needed:
    // for (let [key, value] of formData.entries()) {
    //     console.log(`  FormData Entry: ${key}`, value);
    // }
    return fetchApi('/files/upload', {
        method: 'POST',
        body: formData,
        // Content-Type is set automatically by the browser for FormData
    });
}
// --- *** END CORRECTION *** ---

/** Creates a new folder */
export function createFolderApi(parentPath, folderName) {
    return fetchApi('/files/folder', {
        method: 'POST',
        body: JSON.stringify({ path: parentPath, name: folderName }),
    });
}

/** Renames a file or folder */
export function renameItemApi(currentPath, newName) {
    return fetchApi('/files/rename', {
        method: 'PATCH',
        body: JSON.stringify({ path: currentPath, new_name: newName }),
    });
}

/** Moves a file or folder */
export function moveItemApi(sourcePath, destinationPath) {
     return fetchApi('/files/move', {
        method: 'PATCH',
        body: JSON.stringify({ path: sourcePath, dest: destinationPath }),
    });
}

/** Deletes a file or folder */
export function deleteItemApi(path) {
     return fetchApi('/files', { // DELETE request to the base /files endpoint
        method: 'DELETE',
        body: JSON.stringify({ path: path }),
    });
}

// --- Document Control System (DCS) Operations ---

/** Fetches all DCS document masters */
export function fetchDcsDocuments() {
    return fetchApi('/api/documents');
}

/** Fetches revision history for a specific DCS document */
export function getRevisionHistoryApi(docId) {
    return fetchApi(`/api/documents/${docId}/revisions`);
}

/** Checks out a specific DCS document revision */
export function checkoutDocumentApi(docId, revisionId, purpose) {
    if (!purpose) {
        console.warn("Checkout attempted without purpose for doc:", docId, "rev:", revisionId);
        // Return a rejected promise matching the fetchApi error structure
        return Promise.reject({ status: 400, message: 'Purpose is required for checkout', data: null });
    }
    return fetchApi(`/api/documents/${docId}/revisions/${revisionId}/checkout`, {
        method: 'POST',
        body: JSON.stringify({ purpose: purpose }),
    });
}

/** Checks in a specific DCS document revision */
export function checkinDocumentApi(docId, revisionId) {
    return fetchApi(`/api/documents/${docId}/revisions/${revisionId}/checkin`, {
        method: 'POST',
    });
}

/** Uploads a new DCS document revision */
export function uploadDcsRevisionApi(docId, formData) {
    if (!formData.has('file')) {
         console.error("Attempted DCS revision upload without 'file' in FormData for doc:", docId);
         return Promise.reject({ status: 400, message: 'File data missing in revision upload', data: null });
    }
    return fetchApi(`/api/documents/${docId}/revisions`, {
        method: 'POST',
        body: formData,
    });
}

/** Creates a new DCS document master with an initial revision */
export function createDcsDocumentApi(formData) {
    // Basic check for essential fields - adapt if backend requirements change
     if (!formData.has('file') || !formData.has('document_number') || !formData.has('title')) {
         console.error("Attempted DCS document creation with missing required fields.");
         return Promise.reject({ status: 400, message: 'Required fields missing for new document creation', data: null });
     }
     return fetchApi('/api/documents', {
        method: 'POST',
        body: formData,
    });
}

// --- Add other API calls as needed ---
