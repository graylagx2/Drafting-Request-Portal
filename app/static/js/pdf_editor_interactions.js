// static/js/pdf_editor_interactions.js

import { state } from "./pdf_editor_state.js";
import * as utils from "./pdf_editor_utils.js";
import * as render from "./pdf_editor_render.js";
import * as actions from "./pdf_editor_actions.js";
import { PdfCommentThread } from "./pdf_comments.js";

// Snap distance in pixels
const SNAP_THRESHOLD = 5;

/**
 * Find the nearest annotation endpoint within SNAP_THRESHOLD.
 * Excludes the annotation at excludeIndex on excludePage.
 */
function getSnapPoint(x, y, list, excludePage = null, excludeIndex = null) {
  let minDist = Infinity;
  let snap = null;

  list.forEach((m, idx) => {
    if (excludePage === state.currentPage && excludeIndex === idx) return;
    const pts = m.type === "pen"
      ? [[m.path[0].x, m.path[0].y], [m.path[m.path.length - 1].x, m.path[m.path.length - 1].y]]
      : [[m.x1, m.y1], [m.x2, m.y2]];
    pts.forEach(([ex, ey]) => {
      const d = Math.hypot(x - ex, y - ey);
      if (d <= SNAP_THRESHOLD && d < minDist) {
        minDist = d;
        snap = { x: ex, y: ey };
      }
    });
  });
  return snap;
}

/** Draw yellow endpoint anchors on the currently selected annotation. */
function drawAnchors() {
  const sel = state.selected;
  if (!sel) return;
  const ann = state.markups[sel.page][sel.index];
  const ctx = state.elements.annotCanvas.getContext("2d");
  ctx.fillStyle = "yellow";

  if (ann.type === "line" || ann.type === "highlight") {
    [[ann.x1, ann.y1], [ann.x2, ann.y2]].forEach(([ax, ay]) => {
      ctx.beginPath();
      ctx.arc(ax, ay, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
  } else if (ann.type === "pen") {
    const p = ann.path;
    [[p[0].x, p[0].y], [p[p.length - 1].x, p[p.length - 1].y]].forEach(([ax, ay]) => {
      ctx.beginPath();
      ctx.arc(ax, ay, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }
}

/** Redraw annotations, then draw anchors. */
function doRedraw() {
  render.redraw();
  drawAnchors();
}

export function setupTools() {
  const mapLog = state.elements.mapLog;
  const icons = document.querySelectorAll(".tool-icon");

  icons.forEach(icon => {
    icon.onclick = () => {
      icons.forEach(i => i.classList.remove("active"));
      icon.classList.add("active");

      document.querySelectorAll(".settings-group").forEach(g => g.classList.add("hidden"));
      const key = icon.id.replace("tool-", "");
      const panel = document.getElementById(`settings-${key}`);
      panel?.classList.remove("hidden");

      state.currentTool = key === "highlighter" ? "highlight" : key;
      const swatch = panel.querySelector(".color-swatch.selected");
      if (swatch) state.currentColor = swatch.getAttribute("data-color");
      const slider = panel.querySelector(".thickness-slider");
      if (slider) state.currentWidth = parseInt(slider.value, 10);

      mapLog.textContent = `${state.currentTool}: ${state.currentColor}, ${state.currentWidth}px`;
    };
  });

  document.getElementById("tool-highlighter").click();

  document.querySelectorAll(".color-swatch").forEach(swatch => {
    swatch.onclick = () => {
      const picker = swatch.closest(".color-picker");
      picker.querySelectorAll(".color-swatch").forEach(c => c.classList.remove("selected"));
      swatch.classList.add("selected");
      state.currentColor = swatch.getAttribute("data-color");
      mapLog.textContent = `${state.currentTool}: ${state.currentColor}, ${state.currentWidth}px`;
    };
  });

  document.querySelectorAll(".thickness-slider").forEach(slider => {
    slider.oninput = () => {
      state.currentWidth = parseInt(slider.value, 10);
      mapLog.textContent = `${state.currentTool}: ${state.currentColor}, ${state.currentWidth}px`;
    };
  });
}

export function setupNavigationAndClear() {
  const e = state.elements;
  e.prevBtn.onclick = () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      render.renderPage().then(() => drawAnchors());
    }
  };
  e.nextBtn.onclick = () => {
    if (state.currentPage < state.totalPages) {
      state.currentPage++;
      render.renderPage().then(() => drawAnchors());
    }
  };
  e.clearBtn.onclick = () => {
    state.markups[state.currentPage] = [];
    state.selected = null;
    doRedraw();
    state.elements.mapLog.textContent = "Cleared annotations";
    utils.updateMarkupsState();
  };
}

export function setupInteractionEvents() {
  const { annotCanvas, mapLog } = state.elements;

  annotCanvas.onmousedown = e => {
    if (e.button === 1) return;
    const rect = annotCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const list = state.markups[state.currentPage] || [];

    // DOUBLE-CLICK → edit selection/resize/move
    if (e.detail === 2) {
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i];
        // resize-start
        if ((m.type === "line" || m.type === "highlight")
            && Math.hypot(x - m.x1, y - m.y1) < 10) {
          state.selected = { page: state.currentPage, index: i, anchor: "start" };
          state.mode = "resize-start";
          state.startX = x; state.startY = y;
          doRedraw(); mapLog.textContent = "Resizing start";
          return;
        }
        // resize-end
        if ((m.type === "line" || m.type === "highlight")
            && Math.hypot(x - m.x2, y - m.y2) < 10) {
          state.selected = { page: state.currentPage, index: i, anchor: "end" };
          state.mode = "resize-end";
          state.startX = x; state.startY = y;
          doRedraw(); mapLog.textContent = "Resizing end";
          return;
        }
        // move segment
        if (m.type === "line" || m.type === "highlight") {
          const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
          const t = ((x - m.x1) * dx + (y - m.y1) * dy) / (dx * dx + dy * dy);
          const px = m.x1 + Math.max(0, Math.min(1, t)) * dx;
          const py = m.y1 + Math.max(0, Math.min(1, t)) * dy;
          if (Math.hypot(x - px, y - py) < 8) {
            state.selected = { page: state.currentPage, index: i };
            state.mode = "move";
            state.startX = x; state.startY = y;
            doRedraw(); mapLog.textContent = "Moving annotation";
            return;
          }
        }
        // pen select
        if (m.type === "pen") {
          for (const pt of m.path) {
            if (Math.hypot(x - pt.x, y - pt.y) < 8) {
              state.selected = { page: state.currentPage, index: i };
              state.mode = "select-pen";
              doRedraw(); mapLog.textContent = "Selected pen";
              return;
            }
          }
        }
      }
      return;
    }

    // SINGLE-CLICK → draw or continue editing selected
    const sel = state.selected;
    if (sel && state.mode === null) {
      const m = list[sel.index];
      // resize-start
      if ((m.type === "line" || m.type === "highlight")
          && Math.hypot(x - m.x1, y - m.y1) < 10) {
        state.mode = "resize-start"; state.startX = x; state.startY = y;
        doRedraw(); mapLog.textContent = "Resizing start"; return;
      }
      // resize-end
      if ((m.type === "line" || m.type === "highlight")
          && Math.hypot(x - m.x2, y - m.y2) < 10) {
        state.mode = "resize-end"; state.startX = x; state.startY = y;
        doRedraw(); mapLog.textContent = "Resizing end"; return;
      }
      // move segment
      if (m.type === "line" || m.type === "highlight") {
        const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
        const t = ((x - m.x1) * dx + (y - m.y1) * dy) / (dx * dx + dy * dy);
        const px = m.x1 + Math.max(0, Math.min(1, t)) * dx;
        const py = m.y1 + Math.max(0, Math.min(1, t)) * dy;
        if (Math.hypot(x - px, y - py) < 8) {
          state.mode = "move"; state.startX = x; state.startY = y;
          doRedraw(); mapLog.textContent = "Moving annotation"; return;
        }
      }
      // pen select
      if (m.type === "pen") {
        for (const pt of m.path) {
          if (Math.hypot(x - pt.x, y - pt.y) < 8) {
            state.mode = "select-pen";
            doRedraw(); mapLog.textContent = "Selected pen"; return;
          }
        }
      }
    }

    // Clear selection and begin drawing
    state.selected = null;

    // PEN TOOL: start at snap if within threshold
    if (state.currentTool === "pen") {
      const snap = getSnapPoint(x, y, list);
      const start = snap || { x, y };
      state.penDrawing = true;
      state.penPath = [{ x: start.x, y: start.y }];
      state.mode = "pen";
      doRedraw();
      return;
    }

    // HIGHLIGHT TOOL: start at snap if within threshold
    if (state.currentTool === "highlight") {
      const snap = getSnapPoint(x, y, list);
      const start = snap || { x, y };
      state.mode = "draw";
      state.startX = start.x;
      state.startY = start.y;
      doRedraw();
      return;
    }

    // LINE TOOL: start at snap if within threshold
    if (state.currentTool === "line") {
      const snap = getSnapPoint(x, y, list);
      const start = snap || { x, y };
      state.mode = "draw";
      state.startX = start.x;
      state.startY = start.y;
      doRedraw();
      return;
    }
  };

  annotCanvas.onmousemove = e => {
    if (!state.mode) return;
    const rect = annotCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    doRedraw();
    const ctx = annotCanvas.getContext("2d");

    if (state.mode === "draw" && state.currentTool === "highlight") {
      ctx.strokeStyle = state.currentColor;
      ctx.lineWidth = state.currentWidth;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(state.startX, state.startY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    } else if (state.mode === "draw" && state.currentTool === "line") {
      ctx.strokeStyle = state.currentColor;
      ctx.lineWidth = state.currentWidth;
      ctx.beginPath();
      ctx.moveTo(state.startX, state.startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (state.mode === "pen" && state.penDrawing) {
      state.penPath.push({ x, y });
      ctx.strokeStyle = state.currentColor;
      ctx.lineWidth = state.currentWidth;
      ctx.beginPath();
      ctx.moveTo(state.penPath[0].x, state.penPath[0].y);
      for (let i = 1; i < state.penPath.length; i++) {
        ctx.lineTo(state.penPath[i].x, state.penPath[i].y);
      }
      ctx.stroke();
    } else if (state.selected && state.mode === "move") {
      const m = state.markups[state.selected.page][state.selected.index];
      const dx = x - state.startX, dy = y - state.startY;
      m.x1 += dx; m.y1 += dy; m.x2 += dx; m.y2 += dy;
      state.startX = x; state.startY = y;
      doRedraw();
    } else if (state.selected && state.mode === "resize-start") {
      const m = state.markups[state.selected.page][state.selected.index];
      let nx = x, ny = y;
      const snap = getSnapPoint(x, y, state.markups[state.currentPage], state.currentPage, state.selected.index);
      if (snap) {
        nx = snap.x;
        ny = snap.y;
      }
      m.x1 = nx; m.y1 = ny;
      doRedraw();
    } else if (state.selected && state.mode === "resize-end") {
      const m = state.markups[state.selected.page][state.selected.index];
      let nx = x, ny = y;
      const snap = getSnapPoint(x, y, state.markups[state.currentPage], state.currentPage, state.selected.index);
      if (snap) {
        nx = snap.x;
        ny = snap.y;
      }
      m.x2 = nx; m.y2 = ny;
      doRedraw();
    }
  };

  annotCanvas.onmouseup = e => {
    if (!state.mode) return;
    const rect = annotCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const dist = Math.hypot(x - state.startX, y - state.startY);

    if (state.mode === "draw" && state.currentTool === "highlight" && dist >= 2) {
      state.markups[state.currentPage] = state.markups[state.currentPage] || [];
      state.markups[state.currentPage].push({
        type: "highlight",
        x1: state.startX, y1: state.startY,
        x2: x, y2: y,
        color: state.currentColor,
        width: state.currentWidth
      });
      state.elements.mapLog.textContent = "Drew highlight";
    } else if (state.mode === "draw" && state.currentTool === "line" && dist >= 2) {
      state.markups[state.currentPage] = state.markups[state.currentPage] || [];
      state.markups[state.currentPage].push({
        type: "line",
        x1: state.startX, y1: state.startY,
        x2: x, y2: y,
        color: state.currentColor,
        width: state.currentWidth
      });
      state.elements.mapLog.textContent = "Drew line";
    } else if (state.mode === "pen" && state.penDrawing) {
      state.markups[state.currentPage] = state.markups[state.currentPage] || [];
      state.markups[state.currentPage].push({
        type: "pen",
        path: [...state.penPath],
        color: state.currentColor,
        width: state.currentWidth
      });
      state.penDrawing = false;
      state.penPath = [];
      state.elements.mapLog.textContent = "Drew pen";
    }

    state.mode = null;
    doRedraw();
    utils.updateMarkupsState();
  };
}

export function setupPanAndZoom() {
  const { container, wrapper } = state.elements;

  // Pan (middle-button drag)
  wrapper.addEventListener("mousedown", e => {
    if (e.button === 1) {
      e.preventDefault();
      state.isPanning = true;
      state.panStartX = e.clientX;
      state.panStartY = e.clientY;
      state.initOffsetX = state.wrapperOffsetX;
      state.initOffsetY = state.wrapperOffsetY;
      wrapper.style.cursor = "grabbing";
    }
  });

  document.addEventListener("mousemove", e => {
    if (!state.isPanning) return;
    const dx = e.clientX - state.panStartX;
    const dy = e.clientY - state.panStartY;
    state.wrapperOffsetX = state.initOffsetX + dx;
    state.wrapperOffsetY = state.initOffsetY + dy;
    utils.updateWrapperPosition();
  });

  document.addEventListener("mouseup", e => {
    if (e.button === 1 && state.isPanning) {
      state.isPanning = false;
      wrapper.style.cursor = "default";
    }
  });

  // Zoom (Ctrl + wheel)
  container.addEventListener("wheel", e => {
    if (!e.ctrlKey) return;
    e.preventDefault();

    state.lastZoomEvent = e;
    if (!state.pendingZoomUpdate) {
      state.pendingZoomUpdate = true;
      requestAnimationFrame(async () => {
        const rect = container.getBoundingClientRect();
        const px = state.lastZoomEvent.clientX - rect.left;
        const py = state.lastZoomEvent.clientY - rect.top;
        const oldZoom = state.zoomLevel;
        const delta = -state.lastZoomEvent.deltaY * 0.001;
        state.zoomLevel = Math.min(Math.max(0.5, oldZoom + delta), 5);
        const ratio = state.zoomLevel / oldZoom;

        // Scale all stored annotation coordinates
        state.markups[state.currentPage]?.forEach(m => {
          if (m.type === "highlight" || m.type === "line") {
            m.x1 *= ratio; m.y1 *= ratio;
            m.x2 *= ratio; m.y2 *= ratio;
          } else if (m.type === "pen") {
            m.path.forEach(pt => {
              pt.x *= ratio; pt.y *= ratio;
            });
          }
        });

        // Adjust pan so zoom focal point stays under cursor
        state.wrapperOffsetX = px - (px - state.wrapperOffsetX) * ratio;
        state.wrapperOffsetY = py - (py - state.wrapperOffsetY) * ratio;

        // Re-render at new zoom
        await render.renderPage();
        utils.updateWrapperPosition();
        doRedraw();

        state.pendingZoomUpdate = false;
      });
    }
  }, { passive: false });
}

export function setupKeyListeners() {
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      state.snapEscapeCount++;
      state.elements.mapLog.textContent = "Snap-to-continue disabled for this session.";
    }
    if ((e.key === "Delete" || e.key === "Backspace") && state.selected) {
      const { page, index } = state.selected;
      state.markups[page].splice(index, 1);
      state.selected = null;
      doRedraw();
      utils.updateMarkupsState();
      state.elements.mapLog.textContent = "Annotation deleted";
    }
  });
}


export function setupSidebarToggle() {
  const toggle = state.elements.toolChestToggle;
  if (toggle) {
    toggle.onclick = () => {
      const sidebar = document.getElementById("qcConsole");
      sidebar.classList.toggle("collapsed");
      document.getElementById("toggleIcon").textContent =
        sidebar.classList.contains("collapsed") ? "⮞" : "⮜";
    };
  }
}

export function setupCloseModal() {
  const { closeBtn } = state.elements;
  if (closeBtn) {
    closeBtn.onclick = () => {
      const modal = document.getElementById("modal-pdf-container");
      if (modal) modal.parentNode.innerHTML = "";
    };
  }
}

export function setupActionButtons() {
  const { approveBtn, revisionBtn, commentInput } = state.elements;
  approveBtn.onclick = async () => {
    if (state.hasMarkups) {
      approveBtn.disabled = true;
      return;
    }
    if (commentInput.value.trim()) {
      if (!confirm("You have left a comment. Are you sure you want to approve this ticket?")) return;
    }
    await actions.submitAction("approve");
  };
  revisionBtn.onclick = async () => {
    if (!state.hasMarkups && !commentInput.value.trim()) {
      if (!confirm("You have not made any markups or left a comment. Submit for revision anyway?")) return;
    } else if (!state.hasMarkups && commentInput.value.trim()) {
      if (!confirm("You have not made any markups. Submit for revision based only on your comments?")) return;
    }
    await actions.submitAction("revise");
  };
}
