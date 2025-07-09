import { bindTableSorting } from "/static/js/table_sort.js";
import { openAssignModal } from "/static/js/assign_modal.js";

// Function to bind event listeners to the admin modal elements.
export function bindAdminModalEvents() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContentIds = {
    "tab-new-tickets": "content-new-tickets",
    "tab-assigned-tickets": "content-assigned-tickets",
    "tab-completed-tickets": "content-completed-tickets",
    "tab-analytics": "content-analytics"
  };

  function setActiveTab(activeId) {
    tabButtons.forEach(btn => {
      btn.classList.toggle("active-tab", btn.id === activeId);
    });
    for (const [tabId, contentId] of Object.entries(tabContentIds)) {
      const contentDiv = document.getElementById(contentId);
      if (contentDiv) {
        contentDiv.classList.toggle("hidden", tabId !== activeId);
      }
    }
    // Bind sorting for the visible table if it exists.
    if (activeId === "tab-new-tickets") {
      bindTableSorting("admin-new-tickets-table");
    } else if (activeId === "tab-assigned-tickets") {
      bindTableSorting("admin-assigned-tickets-table");
    } else if (activeId === "tab-completed-tickets") {
      bindTableSorting("admin-completed-tickets-table");
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.id));
  });

  // Initialize with "New Tickets" tab active.
  setActiveTab("tab-new-tickets");

  // Bind close button to clear the modal content.
  const closeButton = document.getElementById("close-modal");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      document.getElementById("modal-root").innerHTML = "";
    });
  }

  // Bind assign button events: when an "Assign" button is clicked, open the assign modal.
  const assignButtons = document.querySelectorAll(".assign-btn");
  assignButtons.forEach(btn => {
    btn.addEventListener("click", function() {
      const ticketId = this.getAttribute("data-ticket-id");
      openAssignModal(ticketId);
    });
  });

  // Bind table sorting on the active table.
  bindTableSorting("admin-new-tickets-table");
}

// Function to open the admin drafting modal via AJAX.
export function openAdminDraftingModal(url) {
  fetch(url)
    .then(response => response.text())
    .then(html => {
      document.getElementById('modal-root').innerHTML = html;
      bindAdminModalEvents();
    })
    .catch(err => {
      console.error("Error loading admin drafting modal:", err);
    });
}
