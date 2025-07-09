// static/js/file_management/sidebar.js

import { fetchRootStorageFolders, createFolderApi, fetchStorageContents } from './api.js';
import { getCurrentView, getCurrentStoragePath, hasPermission } from './state.js';
import { showLoading, hideLoading, showError, showSuccess, generateErrorFromResponse, escapeHtml } from './utils.js'; // Added escapeHtml import
import { renderSidebarNode, toggleSidebarNodeExpansion, createInlineFolderInput } from './ui.js';
import { switchToStorageView, refreshCurrentView } from './app.js';

// --- Module-Level Variables for DOM Elements (initially null) ---
// We will find these elements within initializeSidebar
let sidebarContainer = null;
let sidebarFolderListElement = null;
let newFolderButtonElement = null;
let mainDcsNavElement = null;
let mainStorageNavElement = null;

// --- State ---
let isCreatingFolder = false; // Keep original state variable

// --- Initialization ---
export async function initializeSidebar() {
    // --- MOVED Element Selection Inside Init ---
    sidebarContainer = document.querySelector('.sidebar-nav');
    sidebarFolderListElement = document.getElementById('storage-folder-list');
    newFolderButtonElement = document.getElementById('sidebar-new-folder-btn');
    mainDcsNavElement = document.getElementById('main-nav-dcs-view');
    mainStorageNavElement = document.getElementById('main-nav-storage-view');
    // --- END MOVED Selection ---

    // Check if essential elements were found *after* attempting selection
    if (!sidebarContainer) {
        console.error("Sidebar Init Error: '.sidebar-nav' container not found in the DOM.");
        return; // Stop initialization if container is missing
    }
    // Folder list is only essential for the top storage browser part
    if (!sidebarFolderListElement) {
        console.warn("Sidebar Init Warning: '#storage-folder-list' element not found. Top storage browser may not function.");
    }
    // Button is optional depending on permissions
    if (!newFolderButtonElement) {
        console.warn("Sidebar Init Warning: '#sidebar-new-folder-btn' not found.");
    }
    // Main nav elements are needed for highlighting
     if (!mainDcsNavElement) {
        console.warn("Sidebar Init Warning: '#main-nav-dcs-view' not found.");
     }
     // mainStorageNavElement might legitimately not exist
     if (!mainStorageNavElement) {
        console.log("Sidebar Init Info: '#main-nav-storage-view' not found (this might be expected).");
     }
    // --- End Check ---

    // --- Keep original event listener attachment and permission check ---
    sidebarContainer.addEventListener('click', handleSidebarClick); // Add listener to the found container

    if (newFolderButtonElement) { // Check if button exists before adding listener/checking perms
        const canCreateRoot = hasPermission('create_root');
        const canWriteSubfolder = hasPermission('write');
        if (canCreateRoot || canWriteSubfolder) {
            newFolderButtonElement.addEventListener('click', handleNewStorageFolder);
            newFolderButtonElement.style.display = ''; // Show button
            console.log("Sidebar Init: User has permission to create folders, showing button.");
        } else {
            newFolderButtonElement.style.display = 'none'; // Hide button
            console.log("Sidebar Init: User lacks permission to create folders, hiding button.");
        }
    }
    // --- End Keep original ---

    console.log("Sidebar Init: Fetching root folders..."); // Log before fetch

    // --- Keep original fetch call ---
    // Only proceed if sidebarFolderListElement was actually found
    if (sidebarFolderListElement) {
        await fetchAndRenderRootFolders();
    }
    // --- End Keep original ---

    console.log("Sidebar Init: Root folder fetch/render step finished (after await or skipped).");
}


// --- Data Fetching & Rendering --- (Keep original logic)
async function fetchAndRenderRootFolders() {
    console.log("@@@ fetchAndRenderRootFolders: Function Entered @@@");
    // Add null check again here, although initializeSidebar should prevent call if null
    if (!sidebarFolderListElement) {
        console.error("fetchAndRenderRootFolders: sidebarFolderListElement is null! Cannot render.");
        return;
    }
    sidebarFolderListElement.innerHTML = '<li class="loading-placeholder">Loading folders...</li>';
    try {
        const apiResponse = await fetchRootStorageFolders();
        if (!apiResponse || !Array.isArray(apiResponse.folders)) { throw new Error("Received invalid data structure for root folders."); }
        const foldersArray = apiResponse.folders;
        renderFolderNodes(foldersArray, sidebarFolderListElement, 0);
        updateSidebarActiveState(); // Update active state after rendering
        console.log("@@@ fetchAndRenderRootFolders: Try block finished successfully @@@");
    } catch (error) {
        console.log("!!! fetchAndRenderRootFolders: CATCH BLOCK ENTERED !!!", error);
        console.error("fetchAndRenderRootFolders: Failed -", error);
        let errorMessage = "Could not load storage folders.";
        if (error?.message) errorMessage += `: ${error.message}`;
        else if (error?.status !== undefined) errorMessage += `: API Error (${error.status}) - ${error.message || 'Unknown'}`;
        // showError(errorMessage); // utils.js function - uncomment if error utility is robust
        if (sidebarFolderListElement) sidebarFolderListElement.innerHTML = `<li class="nav-item"><span class="nav-link text-danger">${escapeHtml(errorMessage)}</span></li>`;
    }
}

// --- renderFolderNodes (Keep original logic) ---
function renderFolderNodes(items, targetUlElement, level) {
     console.log(`renderFolderNodes: Called for level ${level} with target`, targetUlElement);
     console.log(`renderFolderNodes: Received items (level ${level}):`, items);

     if (!targetUlElement) { console.error("renderFolderNodes: targetUlElement is null or undefined."); return; };
     if (!Array.isArray(items)) { console.error("renderFolderNodes: items is not an array:", items); return; }

    const directories = items.filter(item => item && item.type === 'directory');
    console.log(`renderFolderNodes: Filtered directories (level ${level}):`, directories);

    if (directories.length === 0 && level === 0) {
        console.log("renderFolderNodes: No root directories found, setting empty message.");
        targetUlElement.innerHTML = '<li class="nav-item"><span class="nav-link text-muted">No storage folders found.</span></li>';
        return;
    } else if (directories.length === 0) {
         console.log(`renderFolderNodes: No subdirectories found for level ${level}, setting empty message.`);
         targetUlElement.innerHTML = '<li class="nav-item"><span class="nav-link text-muted fst-italic text-sm ps-2">No subfolders</span></li>';
         return;
    } else {
        console.log(`>>> renderFolderNodes: ENTERING 'else' block to render ${directories.length} director(y/ies) for level ${level}.`);
        const nodesHtml = directories.map(dir => renderSidebarNode(dir, level)).join('');
        console.log(`>>> renderFolderNodes: Generated HTML for level ${level}:`, nodesHtml ? nodesHtml.substring(0, 300) + '...' : '(Empty HTML string)');
        console.log(`>>> renderFolderNodes: Attempting to set innerHTML for target element:`, targetUlElement);
        targetUlElement.innerHTML = nodesHtml;
        console.log(`>>> renderFolderNodes: Successfully set innerHTML for level ${level}.`);
    }
}
// --- End Data Fetching & Rendering ---

// --- Event Handling --- (Keep original logic, ensure module-level vars are used if needed)
function handleSidebarClick(event) {
    // No changes needed here as it uses event.target and DOM traversal
    if (isCreatingFolder) return;
    const target = event.target;
    const toggle = target.closest('.tree-toggle');
    if (toggle) {
        event.preventDefault();
        event.stopPropagation();
        handleToggleClick(toggle);
        return;
    }
    const listItem = target.closest('li[data-path]');
    if (listItem?.dataset.type === 'directory') {
        const nodeElement = listItem.querySelector('.sidebar-tree-node');
        if (nodeElement?.contains(target) && !toggle) {
            event.preventDefault();
            handleFolderNodeClick(nodeElement, listItem);
            return;
        }
    }
}

async function handleToggleClick(toggleElement) {
    // No changes needed here as it uses the passed element and DOM traversal
    const listItem = toggleElement.closest('li');
    if (!listItem) return;
    const path = listItem.dataset.path;
    const isLoaded = listItem.dataset.loaded === 'true';
    const nestedList = listItem.querySelector('.nested-list');
    const isNowExpanded = toggleSidebarNodeExpansion(toggleElement); // From ui.js

    if (isNowExpanded && !isLoaded && nestedList) {
        nestedList.innerHTML = '<li class="loading-placeholder ps-2">Loading...</li>';
        try {
            const contents = await fetchStorageContents(path);
            if (!contents || !Array.isArray(contents.entries)) { throw new Error("Invalid structure for subfolders."); }
            renderFolderNodes(contents.entries || [], nestedList, parseInt(listItem.dataset.level || 0) + 1);
            listItem.dataset.loaded = 'true';
        } catch (error) {
            console.error(`Failed to load subfolders for ${path}:`, error);
            let msg = "Error loading subfolders.";
            if (error?.message) msg += `: ${error.message}`;
            else if (error?.status !== undefined) msg += `: API Error (${error.status})`;
            nestedList.innerHTML = `<li class="text-danger text-sm ps-2">${escapeHtml(msg)}</li>`;
        }
    }
}

function handleFolderNodeClick(nodeElement, listItemElement) {
    // --- ADDED: Null check for sidebarContainer ---
    if (!sidebarContainer) {
        console.error("handleFolderNodeClick Error: sidebarContainer not initialized.");
        return;
    }
    // --- END ADDED ---
    // Rest of function uses DOM traversal and imports, no changes needed
    const path = listItemElement.dataset.path;
    if (path === undefined || path === null) return;
    console.log(`Sidebar folder node clicked: ${path}`);
    sidebarContainer.querySelectorAll('.sidebar-tree-node.selected').forEach(el => el.classList.remove('selected'));
    nodeElement.classList.add('selected');
    switchToStorageView(path);
}


function handleNewStorageFolder() {
    // --- ADDED: Null checks for required elements ---
    if (isCreatingFolder) return;
    if (!sidebarContainer || !sidebarFolderListElement) {
         console.error("handleNewStorageFolder Error: Sidebar container or folder list element not initialized.");
         showError("Cannot create folder: Sidebar not ready.");
         return;
    }
    // --- END ADDED ---

    // --- Keep original function logic ---
    const selectedNode = sidebarContainer.querySelector('.sidebar-tree-node.selected');
    const parentLi = selectedNode ? selectedNode.closest('li[data-path]') : null;
    const parentPath = parentLi ? parentLi.dataset.path : '';
    const parentLevel = parentLi ? parseInt(parentLi.dataset.level || 0) : -1;
    let targetUlElement = parentLi ? parentLi.querySelector('.nested-list') : sidebarFolderListElement;

    if (!hasPermission('create', parentPath)) {
        showError(`Permission denied to create folders ${parentPath === '' ? 'at root' : 'here'}.`);
        return;
    }

    if (parentLi) {
        if (!targetUlElement) {
            targetUlElement = document.createElement('ul');
            targetUlElement.className = 'nested-list visible';
            targetUlElement.style.display = 'block';
            parentLi.appendChild(targetUlElement);
        }
        const toggle = parentLi.querySelector('.tree-toggle');
        if (toggle && !toggle.classList.contains('expanded')) {
            toggleSidebarNodeExpansion(toggle);
        }
         targetUlElement.style.display = 'block';
    }

    if (!targetUlElement) {
         showError("Could not determine where to create the new folder.");
         return;
     }

    isCreatingFolder = true;
    createInlineFolderInput(targetUlElement, parentLevel + 1, async (folderName) => {
        if (folderName === null) {
            console.log("Inline folder creation cancelled.");
            isCreatingFolder = false;
            return;
        }

        showLoading(`Creating folder "${folderName}"...`);
        try {
            await createFolderApi(parentPath, folderName);
            showSuccess(`Folder "${folderName}" created.`);

            if (parentLi) {
                parentLi.dataset.loaded = 'false';
                const toggle = parentLi.querySelector('.tree-toggle');
                const nestedList = parentLi.querySelector('.nested-list');
                if (nestedList) nestedList.innerHTML = '';
                 if (toggle) {
                     // Ensure it triggers reload if it was already expanded
                     const needsToggle = toggle.classList.contains('expanded');
                     if(needsToggle) await handleToggleClick(toggle); // Collapse
                     await handleToggleClick(toggle); // Expand (or re-expand)
                 }
            } else {
                await fetchAndRenderRootFolders();
            }

        } catch (error) {
            const errorMsg = await generateErrorFromResponse(error);
            showError(`Failed to create folder: ${errorMsg}`);
        } finally {
            hideLoading();
            isCreatingFolder = false;
        }
    });
}
// --- End Event Handling ---

// --- updateSidebarActiveState ---
export function updateSidebarActiveState(currentPath = null) {
    // --- ADDED: Null check for sidebarContainer ---
    // If sidebarContainer wasn't found during init, we can't update state
    if (!sidebarContainer) {
        console.warn("updateSidebarActiveState: Cannot update, sidebarContainer not initialized.");
        return;
    }
    // --- END ADDED ---

    // --- Keep original logic, now safe to use sidebarContainer ---
    const view = getCurrentView();
    const path = currentPath !== null ? currentPath : getCurrentStoragePath();

    console.log(`Sidebar Update: View=${view}, Path=${path}`);

    sidebarContainer.querySelectorAll('.sidebar-tree-node.active').forEach(link => link.classList.remove('active'));
    if (mainDcsNavElement) mainDcsNavElement.classList.remove('active');
    if (mainStorageNavElement) mainStorageNavElement.classList.remove('active');

    if (view === 'storage') {
        if (path === '') {
            console.log("Sidebar Update: Activating DCS link for storage root.");
            if (mainDcsNavElement) mainDcsNavElement.classList.add('active');
        } else {
            console.log(`Sidebar Update: Attempting to activate tree node for path: ${path}`);
            const selector = `li[data-path="${CSS.escape(path)}"] > .sidebar-tree-node`;
            const activeNode = sidebarContainer.querySelector(selector);
            if (activeNode) {
                activeNode.classList.add('active');
                console.log("Sidebar Update: Activated tree node:", activeNode);
                if (mainStorageNavElement) mainStorageNavElement.classList.add('active');
            } else {
                 console.log("Sidebar Update: Tree node not found for path:", path);
                 if (mainStorageNavElement) mainStorageNavElement.classList.add('active');
            }
            // Ensure DCS link is not active when in a subfolder
            if (mainDcsNavElement) mainDcsNavElement.classList.remove('active');
        }
    } else if (view === 'dcs') {
        console.log("Sidebar Update: Activating DCS link for DCS view.");
        if (mainDcsNavElement) mainDcsNavElement.classList.add('active');
        if (mainStorageNavElement) mainStorageNavElement.classList.remove('active');
    }
    // --- End Keep original logic ---
}