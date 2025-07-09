// static/js/file_management/state.js

// --- Private State Variables ---
let _currentView = 'dcs'; // 'dcs' or 'storage'
let _currentStoragePath = null; // e.g., 'FolderA/SubfolderB' or '' for root, null if not in storage view
let _currentUser = '';
let _userRoles = []; // Store user roles as an array
let _currentSort = { key: 'name', direction: 'asc' }; // Default sort
let _currentSearchTerm = '';

// Cached data
let _allDcsDocuments = []; // Full list of fetched DCS documents
let _currentStorageItems = []; // Items in the currently viewed storage path

// --- Initialization ---

/**
 * Initialize state from data attributes on the body element, if present.
 */
export function setStateFromDom() {
    const body = document.body;
    if (body.dataset.currentUser) {
        _currentUser = body.dataset.currentUser;
    }
    // Read and parse roles
    if (body.dataset.userRoles) {
        _userRoles = body.dataset.userRoles
            .split(',')
            .map(role => role.trim())
            .filter(role => role);
    } else {
        _userRoles = []; // Default to empty array if attribute not found
    }
    // Log both user and their roles
    console.log(`State initialized. User: ${_currentUser}, Roles: ${_userRoles.join(', ')}`);
    // **NEW**: Explicitly print the current role(s)
    console.log(`Current Role(s): ${_userRoles.join(', ')}`);
}


// --- Getters ---

export function getCurrentView() { return _currentView; }
export function getCurrentStoragePath() { return _currentStoragePath; }
export function getCurrentUser() { return _currentUser; }
export function getCurrentSort() { return _currentSort; }
export function getCurrentSearchTerm() { return _currentSearchTerm; }
export function getAllDocuments() { return _allDcsDocuments; }
export function getCurrentStorageItems() { return _currentStorageItems; }
export function getUserRoles() { return _userRoles; }


// --- Setters ---

export function setCurrentView(view) {
    if (view === 'dcs' || view === 'storage') {
        _currentView = view;
    } else {
        console.error(`Invalid view set: ${view}`);
    }
}

export function setCurrentStoragePath(path) {
    if (_currentView !== 'storage') {
        _currentStoragePath = null;
    } else if (path === '' || path === null || path === undefined) {
        _currentStoragePath = '';
    } else {
        _currentStoragePath = path.replace(/\/$/, '');
    }
}

export function setCurrentUser(username) {
    _currentUser = username;
}

export function setCurrentSort(key, direction) {
    _currentSort = { key, direction };
}

export function setCurrentSearchTerm(term) {
    _currentSearchTerm = term;
}

export function setAllDocuments(documents) {
    if (Array.isArray(documents)) {
        _allDcsDocuments = documents;
    } else {
        console.error("setAllDocuments expects an array.");
        _allDcsDocuments = [];
    }
}

export function setCurrentStorageItems(items) {
    if (Array.isArray(items)) {
        _currentStorageItems = items;
    } else {
        console.error("setCurrentStorageItems expects an array.");
        _currentStorageItems = [];
    }
}

// Setter for roles in case they’re updated dynamically
export function setUserRoles(rolesArray) {
    if (Array.isArray(rolesArray)) {
        _userRoles = rolesArray.map(role => String(role).trim()).filter(role => role);
    } else {
        console.error("setUserRoles expects an array.");
        _userRoles = [];
    }
}


// --- *** Permission Helper *** ---

/**
 * Checks if the current user has permission for a specific action,
 * mirroring backend logic.
 * @param {'read'|'write'|'create'|'create_root'|'delete'} permissionType
 * @param {string|null} [contextPath=null] - The path relevant to the action (for 'create').
 * @returns {boolean}
 */
export function hasPermission(permissionType, contextPath = null) {
    // Define roles required for each action
    const rolesMap = {
        read:        ['viewer', 'engineer', 'drafter', 'admin'],
        write:       ['engineer', 'drafter', 'admin'],
        create_root: ['drafter', 'admin'],
        delete:      ['drafter', 'admin']
    };

    let requiredRoles;
    switch (permissionType) {
        case 'read':
            requiredRoles = rolesMap.read;
            break;
        case 'write':
            requiredRoles = rolesMap.write;
            break;
        case 'create':
            const isRoot = (contextPath === null || contextPath === '');
            requiredRoles = isRoot ? rolesMap.create_root : rolesMap.write;
            break;
        case 'create_root':
            requiredRoles = rolesMap.create_root;
            break;
        case 'delete':
            requiredRoles = rolesMap.delete;
            break;
        default:
            console.warn(`Unknown permission type requested: ${permissionType}`);
            return false;
    }

    return Array.isArray(_userRoles) && _userRoles.some(role => requiredRoles.includes(role));
}
// --- End Permission Helper ---
