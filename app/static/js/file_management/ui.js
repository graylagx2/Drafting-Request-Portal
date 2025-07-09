// static/js/file_management/ui.js
import { escapeHtml, formatFileSize, getParentPath } from './utils.js';
import { getCurrentView, getCurrentStoragePath } from './state.js';

// --- DOM Element References ---
// Ensure these IDs match your actual HTML structure
const elements = {
    mainContentTitle: document.getElementById('main-content-title'),
    dcsControls: document.getElementById('dcs-controls'),
    storageBreadcrumbElement: document.getElementById('archive-breadcrumbs'),
    fileListTableBody: document.getElementById('dcs-file-list-body'),
    fileListTableHead: document.getElementById('dcs-file-list-head'),
    fileListContainer: document.getElementById('file-list-container'),
    dcsFileListTable: document.getElementById('dcs-file-list'),
    dcsEmptyState: document.getElementById('dcs-empty-state'),
    dcsLoadingState: document.getElementById('dcs-loading-state'),
    dcsErrorState: document.getElementById('dcs-error-state'),
    dcsErrorMessage: document.getElementById('dcs-error-message'),
    sidebarFolderListElement: document.getElementById('storage-folder-list'),
};

// --- Utility to manage visibility of table vs states ---
// Hides/shows the table, loading, empty, and error states appropriately.
function showState(stateToShow) {
    const states = ['table', 'loading', 'empty', 'error'];
    const elementsMap = {
        table: elements.dcsFileListTable,
        loading: elements.dcsLoadingState,
        empty: elements.dcsEmptyState,
        error: elements.dcsErrorState,
    };
    if (!elements.fileListContainer) { console.error("UI: showState - fileListContainer not found!"); return; }
    elements.fileListContainer.style.display = 'block'; // Ensure container is visible

    // Hide all states/table first
    states.forEach(state => {
        const el = elementsMap[state];
        if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
        else { console.warn(`UI: showState - Element for state '${state}' not found.`); }
    });

    // Show the requested state
    const elementToShow = elementsMap[stateToShow];
    if (elementToShow) {
        elementToShow.classList.remove('hidden');
        // Use appropriate display type (table for table, flex for centered states)
        elementToShow.style.display = (stateToShow === 'table') ? '' : 'flex'; // Use '' for table default display (table/table-row-group etc)
        console.log(`>>> UI: showState - Showing '${stateToShow}' state.`);
    } else { console.error(`>>> UI: showState - Invalid state to show: '${stateToShow}'`); }
}


// --- Table Rendering ---

/**
 * Renders the table headers based on the current view (DCS or Storage).
 * @param {'dcs' | 'storage'} view - The current view type.
 */
export function renderTableHeaders(view) {
    console.log(`UI: renderTableHeaders called for view '${view}'`);
    if (!elements.fileListTableHead) { console.error("UI: renderTableHeaders - fileListTableHead not found!"); return; }
    let headersHtml = '';
    const headerBaseClass = "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"; // Common header style

    if (view === 'dcs') {
        // DCS Headers - Added standard table header classes
        headersHtml = `
            <tr>
                <th class="${headerBaseClass}" data-sort-key="title">Title <i class="fas fa-sort sort-icon"></i></th>
                <th class="${headerBaseClass}" data-sort-key="document_number">Document No. <i class="fas fa-sort sort-icon"></i></th>
                <th class="${headerBaseClass}" data-sort-key="latest_revision_code">Rev <i class="fas fa-sort sort-icon"></i></th>
                <th class="${headerBaseClass}" data-sort-key="status">Status <i class="fas fa-sort sort-icon"></i></th>
                <th class="${headerBaseClass}" data-sort-key="checked_out_by">Checked Out By <i class="fas fa-sort sort-icon"></i></th>
                <th class="${headerBaseClass}" data-sort-key="last_modified">Last Modified <i class="fas fa-sort sort-icon"></i></th>
                <th class="px-4 py-2"><span class="sr-only">Actions</span></th>
            </tr>
        `;
    } else { // storage view
        // --- MODIFIED: Added "Details" column header for storage view ---
        headersHtml = `
            <tr>
                <th class="${headerBaseClass} w-2/5" data-sort-key="name">Name <i class="fas fa-sort sort-icon"></i></th>
                <th class="${headerBaseClass} w-2/5">Details</th>
                <th class="${headerBaseClass}" data-sort-key="size">Size <i class="fas fa-sort sort-icon"></i></th>
                <th class="${headerBaseClass}" data-sort-key="last_modified">Last Modified <i class="fas fa-sort sort-icon"></i></th>
                <th class="px-4 py-2"><span class="sr-only">Actions</span></th>
            </tr>
        `;
        // --- END MODIFIED ---
    }
    elements.fileListTableHead.innerHTML = headersHtml;
}

/**
 * Renders the table body content based on the items and view.
 * Manages showing the table, empty state, or error state.
 * @param {Array<object>} items - Array of item data (DCS docs or storage entries).
 * @param {'dcs' | 'storage'} view - The current view type.
 */
export function renderTableContents(items, view) {
    console.log(`>>> UI: renderTableContents called for view '${view}' with items count: ${items?.length}`, items);
    if (!elements.fileListTableBody) { console.error(">>> UI: renderTableContents - fileListTableBody element not found!"); return; }

    if (!items || !Array.isArray(items)) {
        console.error(">>> UI: renderTableContents received invalid items:", items);
        showTableErrorState("Invalid data received from server.", view);
        return;
    }

    if (items.length > 0) {
        // Items exist, render them and show the table
        try {
            console.log(`>>> UI: renderTableContents - Generating HTML for ${items.length} items...`);
            // Generate HTML rows based on the view type
            const rowsHtml = items.map(item => (view === 'dcs' ? createDcsRowHtml(item) : createStorageRowHtml(item))).join('');
            // console.log(`>>> UI: renderTableContents - Generated rowsHtml (first 300 chars):`, rowsHtml.substring(0, 300)); // Keep short for logs

            elements.fileListTableBody.innerHTML = rowsHtml; // Populate the hidden table body
            console.log(`>>> UI: renderTableContents - Successfully set innerHTML of table body.`);

            // Re-initialize icons (like Lucide) if necessary after updating DOM
            if (typeof lucide !== 'undefined' && elements.fileListTableBody) {
                // Ensure icons within the newly added rows are created
                lucide.createIcons({ nodes: elements.fileListTableBody.querySelectorAll('[data-lucide]') });
                console.log(">>> UI: renderTableContents - Re-initialized Lucide icons.");
            }

            showState('table'); // Show the table now that it's populated

        } catch (error) {
            console.error(">>> UI: renderTableContents - Error during row generation or setting innerHTML:", error);
            showTableErrorState("Failed to render table content due to an internal error.", view);
        }
    } else {
         // Items array is empty, show the empty state.
         console.log(`>>> UI: renderTableContents - Received empty items array for view '${view}'.`);
         showTableEmptyState(view);
    }
}


// --- Row HTML Generation ---

/**
 * Creates HTML for a single row in the DCS table view.
 * @param {object} doc - The document master data object.
 * @returns {string} - The HTML string for the table row.
 */
function createDcsRowHtml(doc) {
    const statusClass = `status-${doc.status?.replace(/\s+/g, '-') || 'Unknown'}`.toLowerCase(); // Ensure lowercase class
    const checkoutInfo = doc.is_checked_out ? `<span class="checkout-indicator inline-flex items-center text-xs" title="${escapeHtml(doc.checkout_purpose || '')}"><i class="fas fa-lock icon-xs mr-1 text-gray-500"></i> ${escapeHtml(doc.checked_out_by || 'Unknown')}</span>` : '';
    const title = doc.title || '';
    const docNum = doc.document_number || '';
    const revCode = doc.latest_revision_code || '-';
    const status = doc.status || '';
    // Use last_modified which should be the latest revision date or master creation date
    const lastModDate = doc.last_modified ? new Date(doc.last_modified) : null; // Assuming ISO string
    const lastMod = lastModDate ? lastModDate.toLocaleDateString() : '—';
    const docId = doc.id || '';
    const revId = doc.latest_revision_id || '';
    // Using Lucide icon for consistency
    const actionsHtml = `<button class="action-menu-btn hover:bg-gray-200 rounded p-1" data-action="dcs-context-menu" title="More actions" data-doc-id="${docId}" data-rev-id="${revId}" data-name="${escapeHtml(title)}" data-checked-out="${doc.is_checked_out}"><i data-lucide="more-vertical" class="w-4 h-4 text-gray-600"></i></button>`;
    const cellBaseClass = "px-4 py-2 whitespace-nowrap"; // Common cell style

    return `<tr data-doc-id="${docId}" data-rev-id="${revId}" data-name="${escapeHtml(title)}" class="hover:bg-gray-50 group border-b border-gray-200">
                <td class="${cellBaseClass}"><span class="item-title inline-flex items-center gap-2"><i class="fas fa-file-alt item-icon icon-file-alt"></i>${escapeHtml(title)}</span></td>
                <td class="${cellBaseClass} text-sm text-gray-600">${escapeHtml(docNum)}</td>
                <td class="${cellBaseClass} text-sm text-gray-600">${escapeHtml(revCode)}</td>
                <td class="${cellBaseClass} text-sm"><span class="status-pill ${statusClass}">${escapeHtml(status)}</span></td>
                <td class="${cellBaseClass} text-sm text-gray-600">${checkoutInfo}</td>
                <td class="${cellBaseClass} text-sm text-gray-600">${lastMod}</td>
                <td class="${cellBaseClass} text-right text-sm font-medium"><div class="opacity-0 group-hover:opacity-100 transition-opacity">${actionsHtml}</div></td>
            </tr>`;
}

/**
 * Creates HTML for a single row in the Storage table view.
 * Includes metadata pills if the item corresponds to a DCS revision.
 * @param {object} item - The file or folder entry data object.
 * @returns {string} - The HTML string for the table row.
 */
function createStorageRowHtml(item) {
     const itemType = item.type || 'file';
     const isDir = itemType === 'directory';
     const itemName = item.name || 'Unknown';
     const itemPath = item.path || '';
     const sizeDisplay = isDir ? '—' : formatFileSize(item.size || 0);
     // Default to filesystem modified date
     let lastModDate = item.modified ? new Date(item.modified * 1000) : null; // Filesystem mtime is usually seconds
     let lastMod = lastModDate ? lastModDate.toLocaleDateString() : '—';

     // --- Metadata Pill Generation ---
     let detailsHtml = ''; // Default to empty cell content
     // Check if DCS metadata exists (uploaded_by is a good indicator from backend)
     if (!isDir && item.uploaded_by) {
         const uploadedBy = escapeHtml(item.uploaded_by);
         // Use the DCS creation date if available, format it more precisely
         const uploadDate = item.created_at_iso ? new Date(item.created_at_iso) : null;
         const uploadDateStr = uploadDate ? uploadDate.toLocaleString() : 'N/A'; // Use locale string (date+time)
         if (uploadDate) {
             lastMod = uploadDateStr; // Override lastMod with DCS date/time for display
         }

         const status = escapeHtml(item.status || ''); // e.g., "Draft", "For Construction"
         const sensitivity = escapeHtml(item.sensitivity || ''); // e.g., "Internal", "Confidential"
         const isMaster = item.is_master === true; // Check explicitly for true

         // Define styles for pills (Tailwind classes) - Adjust colors as needed
         // Added flex-wrap to allow pills to wrap on smaller screens within the cell
         detailsHtml = '<div class="flex flex-wrap items-center gap-1 py-1">'; // Wrapper for pills, added py-1 for vertical padding

         const basePillClass = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"; // Adjusted padding/alignment
         const iconClass = "w-3 h-3 mr-1"; // Class for icons within pills

         // Define color maps based on expected backend enum values
         const statusColor = { // Based on StatusCode enum values from enums.py
             "Draft": "bg-gray-100 text-gray-700",
             "For Review": "bg-yellow-100 text-yellow-700",
             "For Construction": "bg-blue-100 text-blue-700",
             "As-Built": "bg-green-100 text-green-700",
             "Superseded": "bg-red-100 text-red-700",
             // Add others if necessary
         };
         const sensitivityColor = { // Based on SensitivityClass enum values from enums.py
             "Public": "bg-lime-100 text-lime-700",
             "Internal": "bg-sky-100 text-sky-700",
             "Confidential": "bg-purple-100 text-purple-700",
         };
         const masterColor = "bg-indigo-100 text-indigo-700";
         const uploaderColor = "bg-teal-100 text-teal-700";

         // Build the pills HTML string
         // Uploader Pill (with formatted date in title)
         detailsHtml += `<span class="${basePillClass} ${uploaderColor}" title="Uploaded ${uploadDateStr}"><i class="fas fa-user ${iconClass}"></i>${uploadedBy}</span>`;

         // Status Pill
         if (status) {
             detailsHtml += `<span class="${basePillClass} ${statusColor[status] || 'bg-gray-100 text-gray-700'}">${status}</span>`;
         }
         // Sensitivity Pill
         if (sensitivity) {
             detailsHtml += `<span class="${basePillClass} ${sensitivityColor[sensitivity] || 'bg-gray-100 text-gray-700'}">${sensitivity}</span>`;
         }
         // Master Pill
         if (isMaster) {
             detailsHtml += `<span class="${basePillClass} ${masterColor}">Master</span>`;
         }
         // Add more pills here if needed (e.g., compliance tags) based on data from backend

         detailsHtml += '</div>'; // Close the flex wrapper
     }
     // --- End Metadata Pill Generation ---


     // --- Icon Generation (same as before) ---
     let iconBaseClass = 'fas'; // Font Awesome solid
     let iconIdentifier = 'fa-file-alt'; // Default: generic file
     let specificIconClass = 'icon-file-alt'; // Default specific class
     if (isDir) { iconIdentifier = 'fa-folder'; specificIconClass = 'icon-folder'; }
     else if (itemName.includes('.')) {
         const extension = itemName.split('.').pop().toLowerCase();
         switch (extension) {
             case 'pdf': iconIdentifier = 'fa-file-pdf'; specificIconClass = 'icon-pdf'; break;
             case 'doc': case 'docx': iconIdentifier = 'fa-file-word'; specificIconClass = 'icon-word'; break;
             case 'xls': case 'xlsx': iconIdentifier = 'fa-file-excel'; specificIconClass = 'icon-excel'; break;
             case 'ppt': case 'pptx': iconIdentifier = 'fa-file-powerpoint'; specificIconClass = 'icon-powerpoint'; break;
             case 'png': case 'jpg': case 'jpeg': case 'gif': case 'bmp': case 'svg': case 'webp': iconIdentifier = 'fa-file-image'; specificIconClass = 'icon-image'; break;
             case 'zip': case 'rar': case '7z': case 'tar': case 'gz': iconIdentifier = 'fa-file-archive'; specificIconClass = 'icon-archive'; break;
             case 'txt': iconIdentifier = 'fa-file-alt'; specificIconClass = 'icon-txt'; break;
             // Add more cases as needed
         }
     }
     // --- End Icon Generation ---

     // Link for name - opens folder or triggers download (download needs backend endpoint)
     const nameDisplay = `
        <a href="#" class="item-title-link inline-flex items-center gap-2 group" data-action="${isDir ? 'open_folder' : 'download_file'}" data-path="${escapeHtml(itemPath)}" title="${escapeHtml(itemName)}">
            <i class="${iconBaseClass} ${iconIdentifier} item-icon ${specificIconClass} text-lg"></i>
            <span class="item-name-text group-hover:text-[var(--nexus-blue)] group-hover:underline">${escapeHtml(itemName)}</span>
        </a>`;

     // Action button (for context menu trigger) - Using Lucide icon
     const actionsHtml = `
        <button class="action-menu-btn hover:bg-gray-200 rounded p-1" data-action="storage-context-menu" title="More actions"
                data-path="${escapeHtml(itemPath)}" data-name="${escapeHtml(itemName)}" data-type="${itemType}">
            <i data-lucide="more-vertical" class="w-4 h-4 text-gray-600"></i>
        </button>
     `;

     const cellBaseClass = "px-4 py-2 whitespace-nowrap"; // Base class for cells
     const detailsCellClass = "px-4 py-2 text-sm text-gray-600 align-top"; // Class for details cell

     // --- MODIFIED: Added the detailsHtml cell ---
     return `<tr data-path="${escapeHtml(itemPath)}" data-name="${escapeHtml(itemName)}" data-type="${itemType}" class="hover:bg-gray-50 group border-b border-gray-200">
                <td class="${cellBaseClass} w-2/5">${nameDisplay}</td>
                <td class="${detailsCellClass} w-2/5">${detailsHtml}</td>
                <td class="${cellBaseClass} text-sm text-gray-600 text-right">${sizeDisplay}</td>
                <td class="${cellBaseClass} text-sm text-gray-600">${lastMod}</td>
                <td class="${cellBaseClass} text-right text-sm font-medium">
                     <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                          ${actionsHtml}
                     </div>
                 </td>
            </tr>`;
     // --- END MODIFIED ---
}
// --- End Row HTML Generation ---


// --- Table Status Messages ---
export function showTableLoadingState(view) {
    console.log(`>>> UI: showTableLoadingState called for view '${view}'.`);
    showState('loading');
}
export function showTableEmptyState(view) {
    console.log(`>>> UI: showTableEmptyState called for view '${view}'.`);
    // Optional: Customize empty message based on view or current path
    // const emptyMsgElement = document.getElementById('empty-state-message');
    // if(emptyMsgElement) emptyMsgElement.textContent = `This folder is empty.`;
    showState('empty');
}
export function showTableErrorState(message, view) {
    console.log(`>>> UI: showTableErrorState called for view '${view}' with message: ${message}`);
    if (elements.dcsErrorMessage) { elements.dcsErrorMessage.textContent = escapeHtml(message); }
    else { console.error("UI: showTableErrorState - dcsErrorMessage element not found!"); }
    showState('error');
}

// --- Breadcrumbs --- (Unchanged)
export function renderStorageBreadcrumbs(path) {
    if (!elements.storageBreadcrumbElement) return;
    const pathSegments = path ? path.split('/') : [];
    let breadcrumbsHtml = `<a href="#" class="breadcrumb-link inline-flex items-center text-gray-600 hover:text-[var(--nexus-blue)]" data-path=""><i class="fas fa-hdd me-1"></i> Storage Root</a>`; // Added inline-flex
    let currentBuiltPath = '';
    pathSegments.forEach((segment, index) => {
        currentBuiltPath += (index > 0 ? '/' : '') + segment;
        breadcrumbsHtml += `<span class="mx-1 text-gray-400">/</span>`;
        if (index === pathSegments.length - 1) {
            breadcrumbsHtml += `<span class="font-medium text-gray-800">${escapeHtml(segment)}</span>`;
        } else {
             breadcrumbsHtml += `<a href="#" class="breadcrumb-link text-gray-600 hover:text-[var(--nexus-blue)]" data-path="${escapeHtml(currentBuiltPath)}">${escapeHtml(segment)}</a>`;
        }
    });
    elements.storageBreadcrumbElement.innerHTML = breadcrumbsHtml;
    elements.storageBreadcrumbElement.style.display = 'flex';
}
export function clearStorageBreadcrumbs() {
    if (elements.storageBreadcrumbElement) {
        elements.storageBreadcrumbElement.innerHTML = '';
         elements.storageBreadcrumbElement.style.display = 'none';
    }
}

// --- Sidebar Tree Rendering --- (Unchanged)
export function renderSidebarNode(item, level = 0) {
    const isDir = item.type === 'directory';
    if (!item || typeof item.name !== 'string' || typeof item.path !== 'string') { console.error("renderSidebarNode: Invalid item received:", item); return '<li>Error: Invalid item data</li>'; }
    const escapedPath = escapeHtml(item.path); const escapedName = escapeHtml(item.name); const itemType = escapeHtml(item.type);
    // Added padding based on level for visual indentation
    const paddingLeft = 1 + (level * 1.25); // 1rem base + 1.25rem per level
    return `
        <li data-path="${escapedPath}" data-type="${itemType}" data-level="${level}" data-loaded="false">
            <div class="sidebar-tree-node flex items-center" role="button" aria-expanded="false" style="padding-left: ${paddingLeft}rem;">
                 ${isDir ? '<span class="tree-toggle p-1 -ml-1"><i class="fas fa-chevron-right icon-xs"></i></span>' : '<span class="tree-toggle invisible w-4 h-4 mr-1"></span>'}
                 <i class="node-icon ${isDir ? 'fas fa-folder folder-icon' : 'fas fa-file file-icon'} mr-2"></i>
                 <span class="node-name flex-grow truncate" title="${escapedName}">${escapedName}</span>
            </div>
            ${isDir ? '<ul class="nested-list pl-4" style="display: none;"></ul>' : ''}
        </li>`;
}
export function toggleSidebarNodeExpansion(toggleElement) {
    const listItem = toggleElement.closest('li'); if (!listItem) return false;
    const nestedList = listItem.querySelector('.nested-list'); if (!nestedList) return false;
    const isExpanded = nestedList.style.display === 'block';
    nestedList.style.display = isExpanded ? 'none' : 'block';
    toggleElement.classList.toggle('expanded', !isExpanded);
    const icon = toggleElement.querySelector('i');
    if (icon) {
        icon.classList.toggle('fa-chevron-right', isExpanded);
        icon.classList.toggle('fa-chevron-down', !isExpanded);
    }
    listItem.querySelector('.sidebar-tree-node')?.setAttribute('aria-expanded', !isExpanded);
    return !isExpanded;
}

// --- Inline Folder Input --- (Unchanged)
export function createInlineFolderInput(targetUlElement, level, onSubmit) {
    const li = document.createElement('li'); li.className = 'inline-new-folder-item'; li.style.setProperty('--level', level);
    // Use flex and padding consistent with renderSidebarNode
    const paddingLeft = 1 + (level * 1.25);
    li.style.paddingLeft = `${paddingLeft}rem`;

    const container = document.createElement('div'); container.className = 'inline-new-folder-container flex items-center gap-2'; // Use flex

    const icon = document.createElement('i'); icon.className = 'node-icon fas fa-folder folder-icon'; // Removed mr-2, using gap now
    container.appendChild(icon);

    const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'New folder name...'; input.required = true;
    input.className = 'flex-grow p-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500'; // Basic input styling
    container.appendChild(input);

    li.appendChild(container); targetUlElement.prepend(li); input.focus(); let submitted = false;
    const cleanup = () => { input.removeEventListener('blur', handleBlur); input.removeEventListener('keydown', handleKeyDown); li.remove(); };
    const submit = () => { if (submitted) return; const name = input.value.trim(); if (name) { submitted = true; onSubmit(name); cleanup(); } else { cancel(); } };
    const cancel = () => { if (submitted) return; submitted = true; onSubmit(null); cleanup(); };
    // Delay blur handling slightly to allow click on potential save button if added later
    const handleBlur = () => { setTimeout(() => { if (!submitted && document.activeElement !== input) { input.value.trim() ? submit() : cancel(); } }, 150); };
    const handleKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'Escape') { cancel(); } };
    input.addEventListener('blur', handleBlur); input.addEventListener('keydown', handleKeyDown);
}
