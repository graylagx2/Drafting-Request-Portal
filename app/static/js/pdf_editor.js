// static/js/pdf_editor.js
import { state } from "./pdf_editor_state.js";
import * as utils from "./pdf_editor_utils.js";
import * as render from "./pdf_editor_render.js";
import * as interactions from "./pdf_editor_interactions.js";

export async function initPdfEditor(pdfUrl) {
  const e = state.elements;
  // Query all DOM elements...
  e.container = document.getElementById("pdfContainer");
  e.wrapper = document.getElementById("pdfCanvasWrapper");
  e.canvas = document.getElementById("mapPdfCanvas");
  e.annotCanvas = document.getElementById("annotationCanvas");
  e.formLayer = document.getElementById("formLayer");
  e.prevBtn = document.getElementById("prevPageBtn");
  e.nextBtn = document.getElementById("nextPageBtn");
  e.pageIndicator = document.getElementById("pageIndicator");
  e.clearBtn = document.getElementById("clearHighlightsBtn");
  e.mapLog = document.getElementById("mapLog");
  e.approveBtn = document.getElementById("btn-approve");
  e.revisionBtn = document.getElementById("btn-revision");
  e.commentThread = document.getElementById("comment-thread");
  e.commentForm = document.getElementById("comment-form");
  e.commentInput = document.getElementById("comment-input");
  e.commentBadge = document.getElementById("comment-badge");
  e.closeBtn = document.getElementById("close-pdf-modal");
  e.highlighterColorSel = document.getElementById("highlighter-color");
  e.highlighterWidthSel = document.getElementById("highlighter-width");
  e.highlighterBtn = document.getElementById("select-highlighter");
  e.lineColorSel = document.getElementById("line-color");
  e.lineWidthSel = document.getElementById("line-width");
  e.lineBtn = document.getElementById("select-line");
  e.penColorSel = document.getElementById("pen-color");
  e.penWidthSel = document.getElementById("pen-width");
  e.penBtn = document.getElementById("select-pen");
  e.toolChestToggle = document.getElementById("toolChestToggle");

  // Load PDF document
  state.originalPdfBytes = await fetch(pdfUrl).then(r => r.arrayBuffer());
  state.pdfDoc = await pdfjsLib.getDocument({ data: state.originalPdfBytes }).promise;
  state.totalPages = state.pdfDoc.numPages;

  // Initial render
  await render.renderPage();

  // Comment thread init
  utils.extractTicketNumber();
  if (state.ticketNumber && e.commentThread && e.commentForm && e.commentInput && e.commentBadge) {
    state.pdfCommentThread = new PdfCommentThread({
      ticketNumber: state.ticketNumber,
      threadContainer: e.commentThread,
      form: e.commentForm,
      input: e.commentInput,
      badge: e.commentBadge,
      currentUserId: state.currentUserId
    });
  }

  // Wire up everything
  utils.updateMarkupsState();
  interactions.setupTools();
  interactions.setupNavigationAndClear();
  interactions.setupInteractionEvents();
  interactions.setupPanAndZoom();
  interactions.setupKeyListeners();
  interactions.setupSidebarToggle();
  interactions.setupCloseModal();
  interactions.setupActionButtons();
}

window.initPdfEditor = initPdfEditor;
