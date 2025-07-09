// static/js/pdf_editor_utils.js
import { state } from "./pdf_editor_state.js";

export function extractTicketNumber() {
  if (state.ticketNumber) return state.ticketNumber;
  const match = window.location.pathname.match(/\/ticket\/([^/]+)/);
  if (match) state.ticketNumber = match[1];
  return state.ticketNumber;
}

export function updateWrapperPosition() {
  const { wrapper } = state.elements;
  wrapper.style.left = state.wrapperOffsetX + "px";
  wrapper.style.top = state.wrapperOffsetY + "px";
}

export function updateActionButtons() {
  const { approveBtn, revisionBtn } = state.elements;
  if (state.hasMarkups) {
    approveBtn.disabled = true;
    revisionBtn.disabled = false;
    approveBtn.classList.add("opacity-50", "cursor-not-allowed");
    revisionBtn.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    approveBtn.disabled = false;
    revisionBtn.disabled = false;
    approveBtn.classList.remove("opacity-50", "cursor-not-allowed");
    revisionBtn.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

export function updateMarkupsState() {
  state.hasMarkups = Object.values(state.markups).some(arr => arr && arr.length > 0);
  updateActionButtons();
}
