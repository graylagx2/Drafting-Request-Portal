// static/js/file_management/app.js
import { getCurrentView, setCurrentView, getCurrentStoragePath, setCurrentStoragePath, setAllDocuments, getAllDocuments, setCurrentStorageItems, getCurrentStorageItems, setStateFromDom } from './state.js';
import { renderTableHeaders, renderTableContents, renderStorageBreadcrumbs, showTableLoadingState, showTableEmptyState, showTableErrorState, clearStorageBreadcrumbs } from './ui.js';
import { fetchDcsDocuments, fetchStorageContents, uploadFilesApi } from './api.js';
import { initializeSidebar, updateSidebarActiveState } from './sidebar.js';
import { handleDcsAction } from './dcs_actions.js';
import { handleStorageAction } from './storage_actions.js';
import { debounce, generateErrorFromResponse, showError, showSuccess, showLoading, hideLoading, escapeHtml } from './utils.js';

// --- DOM Elements ---
const mainContentTitle = document.getElementById('main-content-title');
const dcsControls = document.getElementById('dcs-controls');
const storageBreadcrumbElement = document.getElementById('archive-breadcrumbs');
const fileListTableBody = document.getElementById('dcs-file-list-body');
const fileListTableHead = document.getElementById('dcs-file-list-head');
const searchInput = document.getElementById('dcs-search');
const mainNavDcsView = document.getElementById('main-nav-dcs-view');
const fileUploadInput = document.getElementById('file-upload-input');
const mainUploadButton = document.getElementById('action-upload-btn');
const uploadButtonTextElement = document.getElementById('upload-button-text');
const uploadConfirmationModal = document.getElementById('upload-confirmation-modal');
const modalUploadDestination = document.getElementById('modal-upload-destination');
const modalConfirmUploadBtn = document.getElementById('modal-confirm-upload-btn');
const modalCancelUploadBtn = document.getElementById('modal-cancel-upload-btn');

// --- Global variable for context menu closing ---
let activeContextMenu = null;
let closeMenuListener = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("App Init: DOMContentLoaded");
    setStateFromDom();
    setTimeout(() => {
        console.log("App Init: Deferred execution started.");
        if (!document.getElementById('storage-folder-list') || !fileListTableBody || !mainUploadButton || !uploadButtonTextElement || !uploadConfirmationModal) {
            console.error("App Init Error: Core UI elements not found. Initialization aborted.");
            return;
        }
        initializeSidebar();
        setupEventListeners();
        console.log("App Init: Setting initial view to Storage Root");
        switchToStorageView('');
        console.log("App Init: Deferred Initialization complete.");
    }, 0);
});

// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("App Setup: Setting up event listeners");

    // Main navigation links
    if (mainNavDcsView) {
        mainNavDcsView.addEventListener('click', (e) => {
            e.preventDefault();
            switchToStorageView('');
        });
    } else { console.warn("Main DCS navigation link not found."); }

    // Upload button
    if (mainUploadButton) {
        mainUploadButton.addEventListener('click', () => openUploadConfirmationModal());
    } else { console.warn("Upload button (#action-upload-btn) not found."); }

    // Modal buttons
    if (modalConfirmUploadBtn && fileUploadInput) {
        modalConfirmUploadBtn.addEventListener('click', () => {
            closeUploadConfirmationModal();
            fileUploadInput.click();
        });
    }
    if (modalCancelUploadBtn) {
        modalCancelUploadBtn.addEventListener('click', () => closeUploadConfirmationModal());
    }

    // File input
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', handleFileUpload);
    }

    // Search, Sort, Breadcrumbs
    if (searchInput) { searchInput.addEventListener('input', debounce(handleSearch, 300)); }
    if (fileListTableHead) { fileListTableHead.addEventListener('click', handleSortClick); }
    if (storageBreadcrumbElement) { storageBreadcrumbElement.addEventListener('click', handleBreadcrumbClick); }

    // ACTION EVENT DELEGATION (for table rows and context menu ITEMS)
    // Listen on a common ancestor that contains both the table and the (eventually shown) context menus.
    // document.body is a safe bet if context menus are appended to body or are direct children of a main container.
    document.body.addEventListener('click', (event) => {
        // Handle "choose files" link in empty state separately
        if (event.target.id === 'empty-state-choose-files-link') {
            event.preventDefault();
            openUploadConfirmationModal();
            return;
        }

        // Try to find an action trigger (could be in a row, or a context menu item)
        const actionElement = event.target.closest('[data-action], [data-context-action]');
        if (actionElement) {
            console.log("Body listener detected click on actionElement:", actionElement);
            handleActionClick(event, actionElement); // Pass the event and the found actionElement
        }
    });
}

// --- Context Menu Handling ---
function showContextMenu(event, menuId, itemDataForMenuPopulation) {
    // event.preventDefault(); // Already done by caller usually
    // event.stopPropagation(); // Already done by caller usually

    const contextMenu = document.getElementById(menuId);
    if (!contextMenu) {
        console.error(`Context menu with ID '${menuId}' not found.`);
        return;
    }

    // Close any other open menus and remove old listener
    if (activeContextMenu && activeContextMenu !== contextMenu) {
        activeContextMenu.style.display = 'none';
    }
    if (closeMenuListener) {
        document.removeEventListener('click', closeMenuListener);
        closeMenuListener = null;
    }
    activeContextMenu = contextMenu; // Set current active menu

    // Populate menu items with data from itemDataForMenuPopulation
    console.log(`Populating context menu '${menuId}' for item:`, itemDataForMenuPopulation);
    if (menuId === 'storage-item-context-menu') {
        ['rename', 'delete', 'download_file'].forEach(actionName => {
            const actionLink = contextMenu.querySelector(`[data-context-action="${actionName}"]`);
            if (actionLink) {
                actionLink.dataset.path = itemDataForMenuPopulation.path;
                actionLink.dataset.name = itemDataForMenuPopulation.name;
                actionLink.dataset.type = itemDataForMenuPopulation.type;
                console.log(`Set data for '${actionName}': path=${actionLink.dataset.path}, name=${actionLink.dataset.name}, type=${actionLink.dataset.type}`);

                if (actionName === 'download_file') { // Special handling for download
                    if (itemDataForMenuPopulation.type === 'directory') {
                        actionLink.classList.add('opacity-50', 'pointer-events-none');
                        actionLink.setAttribute('aria-disabled', 'true');
                    } else {
                        actionLink.classList.remove('opacity-50', 'pointer-events-none');
                        actionLink.removeAttribute('aria-disabled');
                    }
                }
            } else { console.warn(`Action link for '${actionName}' not found in menu '${menuId}'`); }
        });
    } else if (menuId === 'dcs-item-context-menu') {
        // ... DCS population logic ...
    }

    // Positioning logic (same as before)
    contextMenu.style.display = 'block';
    contextMenu.style.visibility = 'hidden';
    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let topPos = event.pageY; // Use pageY for already scroll-compensated position
    let leftPos = event.pageX; // Use pageX

    if (event.clientX + menuWidth > viewportWidth) { // clientX for viewport relative check
        leftPos = event.pageX - menuWidth;
    }
    if (event.clientY + menuHeight > viewportHeight) { // clientY for viewport relative check
        topPos = event.pageY - menuHeight;
    }
    // Ensure menu doesn't go off screen top/left after adjustment
    if (leftPos < scrollX) leftPos = scrollX + 5;
    if (topPos < scrollY) topPos = scrollY + 5;

    contextMenu.style.left = `${leftPos}px`;
    contextMenu.style.top = `${topPos}px`;
    contextMenu.style.visibility = 'visible';
    console.log(`Showing context menu '${menuId}' at (left: ${leftPos}, top: ${topPos})`);

    // Add listener to close this specific menu on outside click
    // Use setTimeout to ensure this listener is added after the current click event cycle
    setTimeout(() => {
        closeMenuListener = (e) => {
            if (activeContextMenu && !activeContextMenu.contains(e.target)) {
                activeContextMenu.style.display = 'none';
                document.removeEventListener('click', closeMenuListener);
                closeMenuListener = null;
                activeContextMenu = null;
                console.log(`Clicked outside menu '${menuId}', closing it.`);
            }
        };
        document.addEventListener('click', closeMenuListener);
    }, 0);
}

// --- Main Action Click Handler ---
function handleActionClick(event, actionElement) {
    // actionElement is already identified by the body listener: event.target.closest('[data-action], [data-context-action]')
    const action = actionElement.dataset.action || actionElement.dataset.contextAction;
    const view = getCurrentView();

    // Get itemData primarily from the actionElement itself.
    // For three-dot buttons, this data comes from createStorageRowHtml.
    // For context menu items (like "Delete" link), this data was set by showContextMenu.
    let itemData = { ...actionElement.dataset };

    console.log(`handleActionClick: Action='${action}', View='${view}'. Initial itemData from element:`, JSON.parse(JSON.stringify(itemData)));

    // If it's a click on a three-dot button to OPEN a context menu
    if (action.endsWith('-context-menu')) {
        event.preventDefault(); // Prevent <a> tag behavior if it's a link
        event.stopPropagation(); // Prevent this click from being caught by the 'closeMenuListener'
        const menuIdToOpen = action === 'storage-context-menu' ? 'storage-item-context-menu' : 'dcs-item-context-menu';

        // itemData for populating the menu comes from the three-dot button itself.
        // This data should have been set in createStorageRowHtml/createDcsRowHtml.
        if (itemData.path || itemData.docId) {
            showContextMenu(event, menuIdToOpen, itemData);
        } else {
            console.warn("Context menu button clicked, but no essential data (path/docId) found on the button:", actionElement);
        }
        return; // Stop further processing for menu-opening actions
    }

    // If it's a click on an ACTION ITEM within an ALREADY OPEN context menu
    if (actionElement.dataset.contextAction) {
        event.preventDefault(); // Prevent <a> tag behavior
        console.log(`handleActionClick: Context menu ITEM '${action}' clicked. Data from link:`, JSON.parse(JSON.stringify(itemData)));

        // Close the active context menu
        if (activeContextMenu) {
            activeContextMenu.style.display = 'none';
        }
        if (closeMenuListener) { // Clean up the specific "outside click" listener
            document.removeEventListener('click', closeMenuListener);
            closeMenuListener = null;
            activeContextMenu = null;
        }
    } else {
        // This is a direct action not from a context menu (e.g., clicking folder name)
        // We might need to get data from the parent row if the actionElement itself doesn't have all of it.
        const targetRow = actionElement.closest('tr[data-path], tr[data-doc-id]');
        if (targetRow) {
            itemData = { ...targetRow.dataset, ...itemData }; // Merge, element's data takes precedence
        }
        if (actionElement.tagName === 'A' && actionElement.getAttribute('href') === '#') {
            event.preventDefault();
        }
        console.log(`handleActionClick: Direct action '${action}' (not from context menu item). Combined Data:`, JSON.parse(JSON.stringify(itemData)));
    }

    // --- Action Delegation ---
    if (!itemData.path && view === 'storage' && (action === 'rename' || action === 'delete' || action === 'download_file')) {
        console.error(`Cannot perform storage action '${action}' - path is missing from itemData:`, itemData);
        showError(`Cannot ${action}: item path not found.`);
        return;
    }
    if (!itemData.docId && view === 'dcs' && (action === 'checkout' || action === 'history')) { // Add other DCS actions
        console.error(`Cannot perform DCS action '${action}' - docId is missing from itemData:`, itemData);
        showError(`Cannot ${action}: document ID not found.`);
        return;
    }


    if (view === 'storage') {
        if (action === 'open_folder') {
            if (itemData.path !== undefined) { switchToStorageView(itemData.path); }
            else { console.error("Open folder: Path missing.", itemData); showError("Could not open folder: Path missing."); }
        } else if (action === 'download_file') {
            if (itemData.path && itemData.type !== 'directory') {
                 console.log("Download action for file path:", itemData.path);
                 window.location.href = `/files/download?path=${encodeURIComponent(itemData.path)}`;
            } else if (itemData.type === 'directory') {
                showError("Cannot download a folder.");
            } else { console.error("Download: Path missing.", itemData); showError("Cannot download: Path missing.");}
        } else if (['rename', 'delete'].includes(action)) {
            handleStorageAction(action, itemData); // itemData should be complete from the context menu link
        } else {
            console.warn(`Unhandled storage action in handleActionClick: '${action}'`);
        }
    } else if (view === 'dcs') {
        handleDcsAction(action, itemData); // Assumes handleDcsAction can use the itemData object
    } else {
        console.warn(`Action '${action}' clicked with no specific view handler. ItemData:`, itemData);
    }
}


// --- View Switching & Data Fetching/Rendering ---
export function switchToDcsView() {
    if (getCurrentView() === 'dcs') return;
    setCurrentView('dcs');
    setCurrentStoragePath(null);
    if (mainContentTitle) mainContentTitle.textContent = 'Documents (DCS)';
    if (dcsControls) dcsControls.style.display = 'flex';
    if (storageBreadcrumbElement) storageBreadcrumbElement.style.display = 'none';
    if (uploadButtonTextElement) uploadButtonTextElement.textContent = 'Upload';
    if (mainUploadButton) mainUploadButton.setAttribute('title', 'Upload files');
    clearStorageBreadcrumbs();
    renderTableHeaders('dcs');
    updateSidebarActiveState();
    fetchAndRenderDcsDocuments();
}

export function switchToStorageView(path) {
    const targetPath = (path === null || path === undefined) ? '' : path;
    setCurrentView('storage');
    setCurrentStoragePath(targetPath);
    const currentFolderName = getPathDisplayName(targetPath);
    if (mainContentTitle) mainContentTitle.textContent = `Storage: ${escapeHtml(currentFolderName)}`;
    if (dcsControls) dcsControls.style.display = 'none';
    if (storageBreadcrumbElement) storageBreadcrumbElement.style.display = 'flex';
    updateUploadButton(targetPath);
    renderStorageBreadcrumbs(targetPath);
    renderTableHeaders('storage');
    updateSidebarActiveState(targetPath);
    fetchAndRenderStorageContents(targetPath);
}

async function fetchAndRenderDcsDocuments() {
    showTableLoadingState('dcs');
    try {
        const apiResponse = await fetchDcsDocuments();
        if (!apiResponse || !Array.isArray(apiResponse.documents)) throw new Error("Invalid data format for DCS documents.");
        setAllDocuments(apiResponse.documents);
        renderTableContents(apiResponse.documents, 'dcs');
    } catch (error) {
        const errorMsg = await generateErrorFromResponse(error);
        showTableErrorState(errorMsg, 'dcs');
    }
}

async function fetchAndRenderStorageContents(path) {
    showTableLoadingState('storage');
    try {
        const apiResponse = await fetchStorageContents(path);
        if (!apiResponse || !Array.isArray(apiResponse.entries)) throw new Error(apiResponse?.error || "Invalid data structure for storage contents.");
        setCurrentStorageItems(apiResponse.entries);
        renderTableContents(apiResponse.entries, 'storage');
    } catch (error) {
        const errorMsg = await generateErrorFromResponse(error);
        showTableErrorState(errorMsg, 'storage');
    }
}

export function refreshCurrentView() {
    console.log("Refreshing current view...");
    if (activeContextMenu) activeContextMenu.style.display = 'none'; // Close menu
    if (closeMenuListener) { document.removeEventListener('click', closeMenuListener); closeMenuListener = null; activeContextMenu = null; }

    const view = getCurrentView();
    if (view === 'dcs') fetchAndRenderDcsDocuments();
    else if (view === 'storage') fetchAndRenderStorageContents(getCurrentStoragePath());
    else console.warn("refreshCurrentView called with unknown view:", view);
}

// --- UI Helpers & Other Event Handlers ---
function openUploadConfirmationModal() {
    if (!uploadConfirmationModal || !modalUploadDestination) {
        showError("Could not prepare upload confirmation."); return;
    }
    const destinationName = getPathDisplayName(getCurrentStoragePath());
    modalUploadDestination.textContent = escapeHtml(destinationName);
    uploadConfirmationModal.classList.remove('hidden');
    uploadConfirmationModal.classList.add('flex');
}

function closeUploadConfirmationModal() {
    if (!uploadConfirmationModal) return;
    uploadConfirmationModal.classList.add('hidden');
    uploadConfirmationModal.classList.remove('flex');
}

function getPathDisplayName(path) {
    if (!path) return "Storage Root";
    const segments = path.split('/').filter(s => s);
    return segments.length > 0 ? segments[segments.length - 1] : "Storage Root";
}

function updateUploadButton(path) {
    if (!uploadButtonTextElement || !mainUploadButton) return;
    const destName = getPathDisplayName(path);
    uploadButtonTextElement.textContent = `Upload to ${escapeHtml(destName)}`;
    mainUploadButton.setAttribute('title', `Upload files to ${escapeHtml(destName)}`);
}

function handleSearch(event) {
    console.log(`Search term: ${event.target.value.toLowerCase().trim()}`);
    showError("Search filtering not fully implemented yet.");
}

function handleSortClick(event) {
    const headerCell = event.target.closest('th[data-sort-key]');
    if (!headerCell) return;
    console.log(`Sort requested by: ${headerCell.dataset.sortKey}`);
    showError("Sorting not fully implemented yet.");
}

function handleBreadcrumbClick(event) {
    const breadcrumbLink = event.target.closest('a.breadcrumb-link');
    if (!breadcrumbLink || breadcrumbLink.dataset.path === undefined) return;
    event.preventDefault();
    switchToStorageView(breadcrumbLink.dataset.path);
}

async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const currentPath = getCurrentStoragePath();
    const formData = new FormData();
    formData.append('path', currentPath || '');
    for (let i = 0; i < files.length; i++) formData.append('files', files[i]);

    const fileCount = files.length;
    const destName = getPathDisplayName(currentPath);
    showLoading(`Uploading ${fileCount} file(s) to ${escapeHtml(destName)}...`);
    try {
        const result = await uploadFilesApi(formData);
        if (result && Array.isArray(result.errors) && result.errors.length > 0) {
            showError(`Upload partially failed: ${result.errors.join('; ')}`);
        } else {
            showSuccess(`${fileCount} file(s) uploaded successfully to ${escapeHtml(destName)}.`);
        }
        refreshCurrentView();
    } catch (error) {
        const errorMsg = await generateErrorFromResponse(error);
        showError(`Upload failed: ${errorMsg}`);
    } finally {
        hideLoading();
        event.target.value = null; // Reset file input
    }
}