// static/js/engineer_ticket_modal.js

console.log("🔧 engineer_ticket_modal.js loaded");

/**
 * Fetches and renders the engineer tickets modal.
 */
export function openEngineerTicketModal(url) {
  fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest" } })
    .then((res) => {
      if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
      return res.text();
    })
    .then((html) => {
      document.getElementById("modal-root").innerHTML = html;
      bindEngineerModalEvents();
    })
    .catch((err) => console.error("Error loading engineer tickets modal:", err));
}

/**
 * Binds tab switching, main-modal close, Review‐PDF buttons, and inline approvals.
 */
function bindEngineerModalEvents() {
  // Tab switching
  const tabIn = document.getElementById("tab-in-review");
  const tabComp = document.getElementById("tab-completed");
  const contentIn = document.getElementById("content-in-review");
  const contentComp = document.getElementById("content-completed");
  if (tabIn && tabComp && contentIn && contentComp) {
    tabIn.onclick = () => {
      tabIn.classList.add("active-tab");
      tabComp.classList.remove("active-tab");
      contentIn.classList.remove("hidden");
      contentComp.classList.add("hidden");
    };
    tabComp.onclick = () => {
      tabComp.classList.add("active-tab");
      tabIn.classList.remove("active-tab");
      contentComp.classList.remove("hidden");
      contentIn.classList.add("hidden");
    };
  }

  // Close the main tickets modal
  const closeMain = document.getElementById("close-modal");
  if (closeMain) {
    closeMain.onclick = () => {
      document.getElementById("modal-root").innerHTML = "";
    };
  }

  // “Review” buttons → show static PDF overlay
  document.querySelectorAll(".view-pdf-btn").forEach((btn) => {
    btn.onclick = () =>
      openPdfAnnotationModal(btn.dataset.ticket, btn.dataset.filename);
  });

  // Inline approvals (no PDF)
  document.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.onclick = () => approveTicket(btn.dataset.ticket);
  });
}

/**
 * Shows the static PDF overlay, injects the snippet HTML, and wires up close logic.
 */
function openPdfAnnotationModal(ticketNumber, filename) {
  // Static overlay + container
  const overlay = document.getElementById("pdf-annotation-overlay");
  const container = document.getElementById("pdf-annotation-container");

  if (!overlay || !container) {
    console.error("PDF overlay or container not found in DOM.");
    return;
  }

  overlay.classList.remove("hidden");
  container.innerHTML = "";

  // Fetch and inject the snippet
  fetch(`/engineering/ticket/${ticketNumber}/preview-file/${filename}`, {
    headers: { "X-Requested-With": "XMLHttpRequest" },
  })
    .then((resp) => {
      if (!resp.ok) throw new Error(`Fetch error: ${resp.status}`);
      return resp.text();
    })
    .then((html) => {
      container.innerHTML = html;

      // Initialize the PDF editor
      const previewDiv = document.getElementById("modal-pdf-container");
      const pdfUrl = previewDiv?.getAttribute("data-pdf-url");
      if (pdfUrl && window.initPdfEditor) window.initPdfEditor(pdfUrl);

      // *** NEW: Bind the snippet’s own close button ***
      const snippetClose = document.getElementById("close-pdf-modal");
      if (snippetClose) {
        snippetClose.addEventListener("click", () => {
          overlay.classList.add("hidden");
          container.innerHTML = "";
        });
      }

      // Bind the Approve button inside the PDF snippet
      bindPdfActionControls(ticketNumber);
    })
    .catch((err) => console.error("Error loading PDF snippet:", err));
}

/**
 * Bind the Approve button inside the PDF overlay.
 */
function bindPdfActionControls(ticketNumber) {
  const approveBtn = document.getElementById("btn-approve");
  if (!approveBtn) return;

  approveBtn.onclick = async () => {
    try {
      const resp = await fetch(`/engineering/ticket/${ticketNumber}/approve`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      const result = await resp.json();
      if (resp.ok && result.success) {
        // Hide PDF overlay and reload tickets
        document.getElementById("pdf-annotation-overlay")?.classList.add("hidden");
        document.getElementById("pdf-annotation-container").innerHTML = "";
        openEngineerTicketModal(`/engineering/tickets/modal`);
      } else {
        alert(`Approval failed: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Approve request failed:", err);
      alert("Approval request failed.");
    }
  };
}

/**
 * (Optional) Inline approve without opening PDF.
 */
async function approveTicket(ticketNumber) {
  try {
    const resp = await fetch(`/engineering/ticket/${ticketNumber}/approve`, {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    const result = await resp.json();
    if (resp.ok && result.success) {
      openEngineerTicketModal(`/engineering/tickets/modal`);
    } else {
      alert(`Approval failed: ${result.error || "Unknown error"}`);
    }
  } catch (err) {
    console.error("Inline approve failed:", err);
    alert("Inline approval failed.");
  }
}
