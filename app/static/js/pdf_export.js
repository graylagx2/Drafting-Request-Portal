// static/js/pdf_export.js

/**
 * PDF Export Module
 * - Exports the current PDF with markups as a new PDF Blob.
 * - Uses pdf-lib for annotation flattening.
 * - Designed for integration with pdf_editor.js.
 */

import {
  PDFDocument,
  rgb,
} from "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js";

/**
 * Exports the annotated PDF as a Blob.
 * @param {Uint8Array} originalPdfBytes - The original PDF bytes.
 * @param {Object} markups - The markups object { pageNum: [ {x1,y1,x2,y2,color}, ...] }
 * @returns {Promise<Blob>} - The annotated PDF as a Blob.
 */
export async function exportAnnotatedPdf(originalPdfBytes, markups) {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();

  Object.entries(markups).forEach(([pageNum, lines]) => {
    const page = pages[parseInt(pageNum, 10) - 1];
    if (!page || !lines) return;
    lines.forEach((m) => {
      // Parse color (rgba or named)
      let color = rgb(0, 0, 0);
      if (m.color && m.color.startsWith("rgba")) {
        const [r, g, b] = m.color
          .replace("rgba(", "")
          .replace(")", "")
          .split(",")
          .map((v) => parseInt(v.trim(), 10));
        color = rgb(r / 255, g / 255, b / 255);
      } else if (m.color && m.color === "red") {
        color = rgb(1, 0, 0);
      } else if (m.color && m.color === "blue") {
        color = rgb(0, 0, 1);
      }
      page.drawLine({
        start: { x: m.x1, y: page.getHeight() - m.y1 },
        end: { x: m.x2, y: page.getHeight() - m.y2 },
        thickness: 3,
        color,
        opacity: 0.8,
      });
    });
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}
