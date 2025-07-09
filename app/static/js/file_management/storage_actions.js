// static/js/file_management/storage_actions.js
import { renameItemApi, deleteItemApi } from './api.js';
import { getCurrentStoragePath, hasPermission } from './state.js'; // Added hasPermission
import { showLoading, hideLoading, showError, showSuccess, generateErrorFromResponse, escapeHtml } from './utils.js';
// --- MODIFIED: Import refreshCurrentView from app.js ---
import { refreshCurrentView } from './app.js';
// --- END MODIFIED ---

/**
 * Handles context menu or button actions for storage items.
 * @param {string} action - The action to perform (e.g., 'rename', 'delete').
 * @param {object} itemData - An object containing data attributes from the item (e.g., path, name, type).
 * @param {HTMLElement} [targetElement] - The HTML element (e.g., table row), can be null if action comes from context menu item with all data.
 */
export function handleStorageAction(action, itemData, targetElement) {
    // itemData should contain path, name, type directly from the dataset of the context menu item or row
    const itemName = itemData.name;
    const itemType = itemData.type;
    // Construct fullPath from itemData.path. If itemData.path is the full path of the item itself.
    // If itemData.path is the parent folder and itemName is the item, adjust accordingly.
    // Based on createStorageRowHtml, item.path IS the full path of the item.
    const fullPath = itemData.path;


    if (!fullPath || !itemName || !itemType) {
        showError("Could not perform action: Item details missing.");
        console.error("handleStorageAction error: Missing fullPath, itemName, or itemType in itemData", itemData);
        return;
    }

    console.log(`Action '${action}' requested for ${itemType}: ${fullPath}`);

    switch (action) {
        case 'rename':
            // Permission check should ideally happen before showing the option in UI,
            // but can be double-checked here.
            if (!hasPermission('write', getCurrentStoragePath())) { // 'write' implies rename in current context
                showError(`Permission denied to rename items in this location.`);
                return;
            }
            renameStorageItem(fullPath, itemName, itemType);
            break;
        case 'delete':
            if (!hasPermission('delete', getCurrentStoragePath())) {
                showError(`Permission denied to delete items in this location.`);
                return;
            }
            deleteStorageItem(fullPath, itemName, itemType);
            break;
        default:
            console.warn(`Unknown storage action: ${action}`);
            // showError(`Action not implemented: ${action}`); // Avoid showing error for every unhandled case unless critical
    }
}

/**
 * Initiates the rename process for a storage item.
 * @param {string} fullPath - The full path of the item relative to storage root.
 * @param {string} currentName - The current name of the item.
 * @param {string} itemType - 'file' or 'folder'.
 */
async function renameStorageItem(fullPath, currentName, itemType) {
    const newNamePrompt = prompt(`Enter new name for ${itemType} "${escapeHtml(currentName)}":`, currentName);

    if (newNamePrompt === null) {
        console.log('Rename cancelled by user.');
        return;
    }
    const newName = newNamePrompt.trim();

    if (newName === '' || newName === currentName) {
        console.log('Rename cancelled or name unchanged.');
        if(newName === '') showError("New name cannot be empty.");
        return;
    }

    // Basic validation: check for invalid characters like '/'
    if (newName.includes('/')) {
        showError("New name cannot contain slashes ('/'). Please enter a valid name.");
        return;
    }


    showLoading(`Renaming ${itemType} to "${escapeHtml(newName)}"...`);
    try {
        await renameItemApi(fullPath, newName);
        showSuccess(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} "${escapeHtml(currentName)}" renamed successfully to "${escapeHtml(newName)}".`);
        // --- MODIFIED: Call refreshCurrentView ---
        refreshCurrentView();
        // --- END MODIFIED ---
    } catch (error) {
        console.error('Rename failed:', error);
        const errorMsg = await generateErrorFromResponse(error);
        showError(`Failed to rename ${itemType}: ${errorMsg}`);
    } finally {
        hideLoading();
    }
}

/**
 * Initiates the delete process for a storage item.
 * @param {string} fullPath - The full path of the item relative to storage root.
 * @param {string} itemName - The name of the item.
 * @param {string} itemType - 'file' or 'folder'.
 */
async function deleteStorageItem(fullPath, itemName, itemType) {
    const confirmation = confirm(`Are you sure you want to delete the ${itemType} "${escapeHtml(itemName)}"? This action cannot be undone.`);

    if (!confirmation) {
        console.log('Delete cancelled by user.');
        return;
    }

    showLoading(`Deleting ${itemType} "${escapeHtml(itemName)}"...`);
    try {
        await deleteItemApi(fullPath);
        showSuccess(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} "${escapeHtml(itemName)}" deleted successfully.`);
        // --- MODIFIED: Call refreshCurrentView ---
        refreshCurrentView();
        // --- END MODIFIED ---
    } catch (error) {
        console.error('Delete failed:', error);
        const errorMsg = await generateErrorFromResponse(error);
        showError(`Failed to delete ${itemType}: ${errorMsg}`);
    } finally {
        hideLoading();
    }
}