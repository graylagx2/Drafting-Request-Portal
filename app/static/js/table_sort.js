// static/js/table_sort.js

/**
 * Sorts the table rows in the given table element by the specified column index.
 * @param {HTMLElement} table - The table element.
 * @param {number} colIndex - The index of the column to sort.
 * @param {boolean} numeric - Whether to sort numerically.
 * @param {boolean} asc - True for ascending, false for descending.
 */
export function sortTable(table, colIndex, numeric = false, asc = true) {
    if (!table) return;
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
  
    rows.sort((a, b) => {
      const cellA = a.children[colIndex].textContent.trim();
      const cellB = b.children[colIndex].textContent.trim();
      let valA = numeric ? parseFloat(cellA) : cellA.toLowerCase();
      let valB = numeric ? parseFloat(cellB) : cellB.toLowerCase();
      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });
  
    // Append the sorted rows back into the tbody.
    rows.forEach(row => tbody.appendChild(row));
  }
  
  /**
   * Binds sorting event listeners to all header cells with the "sortable" class
   * inside the table with the given ID.
   * @param {string} tableId - The id of the table.
   */
  export function bindTableSorting(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const sortableHeaders = table.querySelectorAll("th.sortable");
    sortableHeaders.forEach(th => {
      th.addEventListener("click", () => {
        // Retrieve column index from data-index attribute.
        const colIndex = parseInt(th.getAttribute("data-index"), 10);
        // Toggle sort direction stored in a data attribute.
        const currentDir = th.getAttribute("data-sort-dir") || "asc";
        const newDir = currentDir === "asc" ? "desc" : "asc";
        th.setAttribute("data-sort-dir", newDir);
        // Determine if numeric sort is desired.
        const isNumeric = th.getAttribute("data-numeric") === "true";
        sortTable(table, colIndex, isNumeric, newDir === "asc");
      });
    });
  }
  