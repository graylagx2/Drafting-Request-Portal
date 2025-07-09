// static/js/pdf_editor_render.js
import { state } from "./pdf_editor_state.js";
import * as utils from "./pdf_editor_utils.js";

export async function renderPage() {
  const { container, wrapper, canvas, annotCanvas, formLayer, prevBtn, nextBtn, pageIndicator, mapLog } = state.elements;
  const page = await state.pdfDoc.getPage(state.currentPage);
  const containerRect = container.getBoundingClientRect();
  const baseVP = page.getViewport({ scale: 1 });
  const scale = (containerRect.height / baseVP.height) * state.zoomLevel;
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  annotCanvas.width = viewport.width;
  annotCanvas.height = viewport.height;
  formLayer.style.width = viewport.width + "px";
  formLayer.style.height = viewport.height + "px";

  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
    annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS
  }).promise;

  formLayer.innerHTML = "";
  await pdfjsLib.AnnotationLayer.render({
    viewport,
    div: formLayer,
    annotations: await page.getAnnotations({ intent: "display" }),
    page,
    renderInteractiveForms: true
  });

  pageIndicator.textContent = `${state.currentPage} / ${state.totalPages}`;
  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = state.currentPage >= state.totalPages;

  redraw();
  mapLog.textContent = `Rendered page ${state.currentPage}`;

  if (!state.isPanning && (!wrapper.style.left || wrapper.style.left === "0px")) {
    const left = (containerRect.width - canvas.width) / 2;
    const top = (containerRect.height - canvas.height) / 2;
    state.wrapperOffsetX = left;
    state.wrapperOffsetY = top;
    utils.updateWrapperPosition();
  }
}

export function redraw() {
  const { annotCanvas } = state.elements;
  const ctx = annotCanvas.getContext("2d");
  ctx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);

  (state.markups[state.currentPage] || []).forEach((m, i) => {
    if (m.type === "highlight") {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = m.width;
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();
      ctx.restore();
    } else if (m.type === "line") {
      ctx.save();
      ctx.strokeStyle = m.color;
      ctx.lineWidth = m.width;
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();
      ctx.restore();

      if (state.selected?.page === state.currentPage && state.selected.index === i) {
        ctx.save();
        ctx.fillStyle = "#facc15";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x1, m.y1, 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(m.x2, m.y2, 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (m.type === "pen") {
      ctx.save();
      ctx.strokeStyle = m.color;
      ctx.lineWidth = m.width;
      ctx.beginPath();
      ctx.moveTo(m.path[0].x, m.path[0].y);
      m.path.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.stroke();
      ctx.restore();

      if (state.selected?.page === state.currentPage && state.selected.index === i) {
        ctx.save();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        m.path.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
        ctx.restore();
      }
    }
  });
}
