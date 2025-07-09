// static/js/pdf_editor_actions.js
import { state } from "./pdf_editor_state.js";
import { exportAnnotatedPdf } from "./pdf_export.js";

export async function submitAction(action) {
  if (!state.ticketNumber) return;
  let url, method;
  if (action === "approve") {
    url = `/engineering/ticket/${state.ticketNumber}/approve`;
    method = "POST";
  } else if (action === "revise") {
    url = `/engineering/ticket/${state.ticketNumber}/request-revision`;
    method = "POST";
  } else {
    return;
  }

  try {
    if (action === "revise" && state.hasMarkups) {
      await saveAnnotatedPdf();
    }
    const resp = await fetch(url, {
      method,
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });
    const result = await resp.json();
    if (resp.ok && result.success) {
      alert(action === "approve"
        ? "Ticket approved successfully."
        : "Revision requested. Drafter will be notified.");
      window.dispatchEvent(new Event("pdf-review-complete"));
    } else {
      alert(result.error || "Action failed.");
    }
  } catch {
    alert("Failed to submit action.");
  }
}

async function saveAnnotatedPdf() {
  if (!state.originalPdfBytes || !state.ticketNumber) return;
  const blob = await exportAnnotatedPdf(new Uint8Array(state.originalPdfBytes), state.markups);
  const urlParts = window.location.pathname.split("/");
  const filename = urlParts.pop() || "annotated.pdf";
  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("original_filename", filename);

  const resp = await fetch(`/engineering/ticket/${state.ticketNumber}/upload-annotated`, {
    method: "POST",
    body: formData,
    headers: { "X-Requested-With": "XMLHttpRequest" }
  });
  if (!resp.ok) {
    alert("Failed to upload annotated PDF.");
    throw new Error("Upload failed");
  }
}
