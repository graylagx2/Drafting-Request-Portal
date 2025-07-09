// static/js/assign_modal.js

/**
 * Opens the assign modal for a given ticket.
 * Expects the server route to return assign_modal HTML with a drafter dropdown.
 * The ticket ID is passed as a query parameter.
 */
export function openAssignModal(ticketId) {
    fetch(`/drafting/assign_modal?ticket_id=${ticketId}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    })
      .then(response => response.text())
      .then(html => {
        const assignModalRoot = getOrCreateAssignModalRoot();
        assignModalRoot.innerHTML = html;
        bindAssignModalEvents();
      })
      .catch(err => {
        console.error("Error loading assign modal:", err);
      });
  }
  
  /**
   * Closes the assign modal.
   */
  export function closeAssignModal() {
    const assignModalRoot = document.getElementById("assign-modal-root");
    if (assignModalRoot) {
      assignModalRoot.innerHTML = "";
    }
  }
  
  function getOrCreateAssignModalRoot() {
    let root = document.getElementById("assign-modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "assign-modal-root";
      document.body.appendChild(root);
    }
    return root;
  }
  
  /**
   * Binds events for the assign modal.
   * - Closes the modal when "Cancel" is clicked.
   * - Submits the form via AJAX.
   */
  export function bindAssignModalEvents() {
    const cancelBtn = document.getElementById("assign-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        closeAssignModal();
      });
    }
    
    const assignForm = document.getElementById("assign-form");
    if (assignForm) {
      assignForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(assignForm);
        try {
          const res = await fetch(assignForm.action, {
            method: "POST",
            body: formData,
            headers: { "X-Requested-With": "XMLHttpRequest" }
          });
          if (!res.ok) throw new Error("Assignment failed");
          // After successful assignment, refresh the admin modal.
          closeAssignModal();
          // Refresh the admin tickets modal by calling openAdminDraftingModal again.
          // This assumes the admin modal URL is '/drafting/admin/tickets/modal'
          import("/static/js/admin_drafting_modal.js").then(module => {
            module.openAdminDraftingModal('/drafting/admin/tickets/modal');
          });
          alert("Ticket assigned successfully.");
        } catch (err) {
          console.error(err);
          alert("Error assigning ticket.");
        }
      });
    }
  }
  