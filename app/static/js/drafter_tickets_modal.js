// static/js/drafter_tickets_modal.js

/**
 * Opens the drafter tickets modal via AJAX.
 * Expects the server to return HTML for the modal.
 */
export async function openDrafterTicketsModal(url) {
  try {
    const response = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    if (!response.ok) throw new Error(`Network error: ${response.status}`);
    const html = await response.text();
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) {
      modalRoot.innerHTML = html;
      bindDrafterModalEvents();
      setupSubmitReviewButtons();
    }
  } catch (err) {
    console.error('Error loading drafter tickets modal:', err);
  }
}

/**
 * Binds events for closing the drafter tickets modal.
 */
function bindDrafterModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('close-modal');
  const container = document.getElementById('modal-container');

  const closeModal = () => {
    document.body.classList.remove('overflow-hidden');
    if (container) container.classList.add('animate-fadeOut');
    setTimeout(() => {
      const modalRoot = document.getElementById('modal-root');
      if (modalRoot) modalRoot.innerHTML = '';
    }, 250);
  };

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  overlay?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);
}

/**
 * Initialize the drafter tickets modal functionality.
 */
export function initDrafterTicketsModal() {
  const drafterTile = document.getElementById('open-drafter-tickets-modal');
  if (drafterTile) {
    drafterTile.addEventListener('click', e => {
      e.preventDefault();
      openDrafterTicketsModal('/drafting/drafter/tickets/modal');
    });
  }
}

/**
 * Set up all "Submit for Review" buttons inside the modal.
 */
function setupSubmitReviewButtons() {
  document.querySelectorAll('.submit-review-btn').forEach(btn => {
    btn.addEventListener('click', onSubmitReviewClick);
  });
}

let currentTicket = null;
let currentEngineer = null;

/**
 * Handler for the "Submit for Review" button.
 * Checks for an existing PDF in the review folder.
 */
async function onSubmitReviewClick(e) {
  currentTicket = e.currentTarget.dataset.ticketNumber;
  currentEngineer = e.currentTarget.dataset.engineerName;

  try {
    const resp = await fetch(`/drafting/archive/${currentTicket}/review`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const entries = await resp.json();
    if (!Array.isArray(entries)) {
      // Possibly an error object
      console.error('Invalid response from archive API:', entries);
      return;
    }
    const pdfs = entries.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 1) {
      showConfirmModal(pdfs[0].name);
    } else {
      showUploadModal();
    }
  } catch (err) {
    console.error('Error checking review folder:', err);
  }
}

/**
 * Show the confirmation modal with filename and engineer.
 */
function showConfirmModal(fileName) {
  document.getElementById('confirm-file-name').textContent = fileName;
  document.getElementById('confirm-engineer-name').textContent = currentEngineer;
  document.getElementById('confirm-review-overlay').classList.remove('hidden');
  document.getElementById('confirm-review-container').classList.remove('hidden');

  document.getElementById('cancel-confirm-btn').onclick = hideConfirmModal;
  document.getElementById('confirm-submit-btn').onclick = submitReview;
}

/**
 * Hide the confirmation modal.
 */
function hideConfirmModal() {
  document.getElementById('confirm-review-overlay').classList.add('hidden');
  document.getElementById('confirm-review-container').classList.add('hidden');
}

/**
 * Show the upload modal for missing PDF.
 */
function showUploadModal() {
  document.getElementById('upload-review-overlay').classList.remove('hidden');
  document.getElementById('upload-review-container').classList.remove('hidden');

  const zone = document.getElementById('upload-drop-zone');
  const input = document.getElementById('upload-review-file');
  const fileList = document.getElementById('review-file-list');

  // Clear any prior state
  input.value = '';
  fileList.innerHTML = '';
  document.getElementById('upload-error').classList.add('hidden');

  // Click to browse
  zone.onclick = () => input.click();

  // Drag & drop
  zone.ondragover = e => {
    e.preventDefault();
    zone.classList.add('border-[var(--nexus-blue)]');
  };
  zone.ondragleave = () => zone.classList.remove('border-[var(--nexus-blue)]');
  zone.ondrop = e => {
    e.preventDefault();
    zone.classList.remove('border-[var(--nexus-blue)]');

    // If there's a dropped file, assign it to the <input> so it can be uploaded later
    const droppedFile = e.dataTransfer.files && e.dataTransfer.files[0];
    if (droppedFile) {
      const inputElem = document.getElementById('upload-review-file');
      inputElem.files = e.dataTransfer.files; // <-- The fix: ensure final 'upload' sees this file
      handleFileSelection(droppedFile);
    }
  };

  // Input change
  input.onchange = e => {
    if (!e.target.files || !e.target.files[0]) return;
    handleFileSelection(e.target.files[0]);
  };

  document.getElementById('cancel-upload-btn').onclick = hideUploadModal;
  document.getElementById('upload-review-btn').onclick = uploadReviewFile;
}

/**
 * Hide the upload modal.
 */
function hideUploadModal() {
  document.getElementById('upload-review-overlay').classList.add('hidden');
  document.getElementById('upload-review-container').classList.add('hidden');
  document.getElementById('upload-error').classList.add('hidden');

  const input = document.getElementById('upload-review-file');
  const fileList = document.getElementById('review-file-list');
  if (input) input.value = '';
  if (fileList) fileList.innerHTML = '';
}

/**
 * Handle user picking a file or dropping it.
 */
function handleFileSelection(file) {
  if (!file || file.type !== 'application/pdf') {
    document.getElementById('upload-error').classList.remove('hidden');
    return;
  }
  document.getElementById('upload-error').classList.add('hidden');

  // Show a pill with the filename and a remove button
  renderSelectedFile(file);
}

/**
 * Create a 'pill' preview of the file.
 */
function renderSelectedFile(file) {
  // Clear any prior file pill if you only allow one
  const fileList = document.getElementById('review-file-list');
  fileList.innerHTML = '';

  const pill = document.createElement('div');
  pill.className = 'inline-flex items-center bg-gray-200 text-gray-700 rounded-full px-3 py-1 text-sm gap-2';

  // Icon or label
  const label = document.createElement('span');
  label.textContent = file.name;
  pill.appendChild(label);

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'text-gray-500 hover:text-red-500 focus:outline-none';
  removeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
    </svg>
  `;
  removeBtn.title = 'Remove file';
  removeBtn.onclick = () => {
    // Clear the pill + input
    fileList.innerHTML = '';
    const inputElem = document.getElementById('upload-review-file');
    if (inputElem) inputElem.value = '';
  };
  pill.appendChild(removeBtn);

  fileList.appendChild(pill);
}

/**
 * Upload the PDF to the review folder, then show confirm.
 */
async function uploadReviewFile() {
  const input = document.getElementById('upload-review-file');
  const file = input.files ? input.files[0] : null;
  if (!file || file.type !== 'application/pdf') {
    document.getElementById('upload-error').classList.remove('hidden');
    return;
  }

  const form = new FormData();
  form.append('file', file);

  try {
    const resp = await fetch(`/drafting/ticket/${currentTicket}/upload-review`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: form
    });
    const result = await resp.json();
    if (resp.ok && result.success) {
      hideUploadModal();
      showConfirmModal(file.name);
    } else {
      throw new Error(result.error || 'Upload failed');
    }
  } catch (err) {
    console.error('Upload error:', err);
  }
}

/**
 * POST to update ticket status to In-Review.
 */
async function submitReview() {
  try {
    const resp = await fetch(`/drafting/ticket/${currentTicket}/submit-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({})
    });
    const result = await resp.json();
    if (resp.ok && result.success) {
      hideConfirmModal();
      // Refresh the modal to show updated status
      openDrafterTicketsModal('/drafting/drafter/tickets/modal');
    } else {
      throw new Error(result.error || 'Submit failed');
    }
  } catch (err) {
    console.error('Submit error:', err);
  }
}

// Automatically initialize when the DOM is loaded.
document.addEventListener('DOMContentLoaded', () => {
  initDrafterTicketsModal();
});
