// static/js/pdf_editor_state.js
export const state = {
  // PDF.js document data
  pdfDoc: null,
  originalPdfBytes: null,
  // Pagination
  currentPage: 1,
  totalPages: 0,
  // Zoom & pan
  zoomLevel: 1.0,
  wrapperOffsetX: 0,
  wrapperOffsetY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  initOffsetX: 0,
  initOffsetY: 0,
  pendingZoomUpdate: false,
  lastZoomEvent: null,
  // Drawing tools
  currentTool: null,
  currentColor: "rgba(255,105,180,0.6)",
  currentWidth: 4,
  penPath: [],
  penDrawing: false,
  snapActive: false,
  snapEscapeCount: 0,
  // Drawing state
  startX: 0,
  startY: 0,
  mode: null,
  markups: {},
  selected: null,
  hasMarkups: false,
  // Comment thread context
  ticketNumber: window.PDF_TICKET_NUMBER || null,
  currentUserId: window.CURRENT_USER_ID || null,
  pdfCommentThread: null,
  // DOM elements (populated in init)
  elements: {
    container: null,
    wrapper: null,
    canvas: null,
    annotCanvas: null,
    formLayer: null,
    prevBtn: null,
    nextBtn: null,
    pageIndicator: null,
    clearBtn: null,
    mapLog: null,
    approveBtn: null,
    revisionBtn: null,
    commentThread: null,
    commentForm: null,
    commentInput: null,
    commentBadge: null,
    closeBtn: null,
    highlighterColorSel: null,
    highlighterWidthSel: null,
    highlighterBtn: null,
    lineColorSel: null,
    lineWidthSel: null,
    lineBtn: null,
    penColorSel: null,
    penWidthSel: null,
    penBtn: null,
    toolChestToggle: null
  }
};