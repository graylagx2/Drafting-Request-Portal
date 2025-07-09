import { bindTableSorting } from "/static/js/table_sort.js";

export const initViewRequestsModal = () => {
  const viewRequestsTrigger = document.getElementById("open-view-requests-modal");
  const modalRoot = document.getElementById("modal-root");

  if (!viewRequestsTrigger || !modalRoot) return;

  viewRequestsTrigger.addEventListener("click", async (e) => {
    e.preventDefault();

    // Close any existing modal
    if (document.querySelector("#modal-container")) {
      const currentModal = document.querySelector("#modal-container");
      currentModal.classList.add("animate-fadeOut");
      setTimeout(() => {
        modalRoot.innerHTML = "";
      }, 250);
    }

    try {
      const res = await fetch("/drafting/my-requests-modal", {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) throw new Error("Failed to load view requests modal");

      modalRoot.innerHTML = await res.text();
      document.body.classList.add("overflow-hidden");

      bindViewModalEvents();
      bindTableEvents();
      bindWorkOrderSearch();
      bindFilePreview();
      bindTabSwitching();
    } catch (err) {
      console.error("View Requests Modal Error:", err);
      alert("Error loading your drafting requests.");
    }
  });
};

const bindViewModalEvents = () => {
  const overlay = document.querySelector("#modal-overlay");
  const closeBtn = document.querySelector("#close-modal");
  const container = document.querySelector("#modal-container");

  const closeModal = () => {
    document.body.classList.remove("overflow-hidden");
    container?.classList.add("animate-fadeOut");
    setTimeout(() => {
      const modalRoot = document.getElementById("modal-root");
      if (modalRoot) modalRoot.innerHTML = "";
    }, 250);
  };

  document.addEventListener("keydown", (e) => e.key === "Escape" && closeModal());
  overlay?.addEventListener("click", closeModal);
  closeBtn?.addEventListener("click", closeModal);
};

export const openRequestsModal = async () => {
  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return;

  // Close any existing modal
  const currentModal = document.querySelector("#modal-container");
  if (currentModal) {
    currentModal.classList.add("animate-fadeOut");
    setTimeout(() => {
      modalRoot.innerHTML = "";
    }, 250);
  }

  try {
    const res = await fetch("/drafting/my-requests-modal", {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!res.ok) throw new Error("Failed to load view requests modal");

    modalRoot.innerHTML = await res.text();
    document.body.classList.add("overflow-hidden");

    bindViewModalEvents();
    bindTableEvents();
    bindWorkOrderSearch();
    bindFilePreview();
    bindTabSwitching();
  } catch (err) {
    console.error("View Requests Modal Error:", err);
    alert("Error loading your drafting requests.");
  }
};

// Remove inline sortTable; instead, use bindTableSorting from table_sort.js.
function bindTableEvents() {
  // For active tickets table
  bindTableSorting("requests-table-active");
  // For completed tickets table
  bindTableSorting("requests-table-completed");
}

// Bind work order search to filter table rows by WO / AFE (assumed to be column index 1)
function bindWorkOrderSearch() {
  const searchInput = document.getElementById("workorder-search");
  if (!searchInput) return;
  searchInput.addEventListener("keyup", () => {
    const query = searchInput.value.toLowerCase().trim();
    // Filter active tickets
    const activeTable = document.getElementById("requests-table-active");
    if (activeTable) {
      const tbody = activeTable.querySelector("tbody");
      const rows = tbody.querySelectorAll("tr");
      rows.forEach((row) => {
        const workOrderText = row.children[1].textContent.toLowerCase();
        row.style.display = workOrderText.includes(query) ? "" : "none";
      });
    }
    // Filter completed tickets
    const completedTable = document.getElementById("requests-table-completed");
    if (completedTable) {
      const tbody = completedTable.querySelector("tbody");
      const rows = tbody.querySelectorAll("tr");
      rows.forEach((row) => {
        const workOrderText = row.children[1].textContent.toLowerCase();
        row.style.display = workOrderText.includes(query) ? "" : "none";
      });
    }
  });
}

// Bind file preview events for file links
function bindFilePreview() {
  const fileLinks = document.querySelectorAll("a.file-preview-link");
  fileLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const fileUrl = link.getAttribute("data-file-url");
      openFilePreview(fileUrl);
    });
  });
}

// Open a file preview modal based on file type
function openFilePreview(fileUrl) {
  const ext = fileUrl.split(".").pop().toLowerCase();
  let contentHtml = "";
  if (["jpg", "jpeg", "png", "gif", "bmp"].includes(ext)) {
    contentHtml = `<img src="${fileUrl}" alt="File preview" class="max-w-full max-h-full">`;
  } else if (ext === "pdf") {
    contentHtml = `<iframe src="${fileUrl}" class="w-full h-full" frameborder="0"></iframe>`;
  } else {
    contentHtml = `<p class="text-gray-700">Preview not available for this file type.</p>
                   <a href="${fileUrl}" download class="mt-4 inline-block bg-[var(--nexus-blue)] text-[var(--nexus-white)] px-4 py-2 rounded">Download File</a>`;
  }

  let previewModal = document.getElementById("file-preview-modal");
  if (!previewModal) {
    previewModal = document.createElement("div");
    previewModal.id = "file-preview-modal";
    previewModal.className = "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70";
    previewModal.innerHTML = `
      <div class="bg-[var(--nexus-white)] rounded-lg shadow-xl w-11/12 max-w-3xl p-4 relative">
        <button id="file-preview-close" class="absolute top-2 right-2 text-gray-600 hover:text-gray-800">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <div id="file-preview-content" class="mt-8"></div>
      </div>`;
    document.body.appendChild(previewModal);
    document.getElementById("file-preview-close").addEventListener("click", () => {
      previewModal.remove();
    });
    previewModal.addEventListener("click", (e) => {
      if (e.target === previewModal) {
        previewModal.remove();
      }
    });
  }
  document.getElementById("file-preview-content").innerHTML = contentHtml;
}

// Bind tab switching between "My Tickets" and "Completed Tickets"
function bindTabSwitching() {
  const tabMyTickets = document.getElementById("tab-my-tickets");
  const tabCompleted = document.getElementById("tab-completed-tickets");
  const myTicketsContainer = document.getElementById("my-tickets");
  const completedContainer = document.getElementById("completed-tickets");

  if (!tabMyTickets || !tabCompleted || !myTicketsContainer || !completedContainer) return;

  tabMyTickets.addEventListener("click", () => {
    tabMyTickets.classList.remove("text-gray-500");
    tabMyTickets.classList.add("text-[var(--nexus-blue)]", "border-[var(--nexus-blue)]");
    tabCompleted.classList.remove("text-[var(--nexus-blue)]", "border-[var(--nexus-blue)]");
    tabCompleted.classList.add("text-gray-500", "border-transparent");
    myTicketsContainer.classList.remove("hidden");
    completedContainer.classList.add("hidden");
    document.getElementById("modal-title").textContent = "My Tickets";
  });

  tabCompleted.addEventListener("click", () => {
    tabCompleted.classList.remove("text-gray-500");
    tabCompleted.classList.add("text-[var(--nexus-blue)]", "border-[var(--nexus-blue)]");
    tabMyTickets.classList.remove("text-[var(--nexus-blue)]", "border-[var(--nexus-blue)]");
    tabMyTickets.classList.add("text-gray-500", "border-transparent");
    completedContainer.classList.remove("hidden");
    myTicketsContainer.classList.add("hidden");
    document.getElementById("modal-title").textContent = "Completed Tickets";
  });
}

function bindAllModalEvents() {
  bindViewModalEvents();
  bindTableEvents();
  bindWorkOrderSearch();
  bindFilePreview();
  bindTabSwitching();
}

export { bindAllModalEvents };
