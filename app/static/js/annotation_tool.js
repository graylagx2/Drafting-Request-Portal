/**
 * Handles the annotation panel: sliding in, comment thread, and submission.
 */
document.addEventListener("DOMContentLoaded", () => {
  function openAnnotationPanel(ticketNumber) {
    let panel = document.getElementById("annotation-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "annotation-panel";
      panel.className =
        "fixed top-0 left-0 h-full w-1/3 bg-white shadow-xl z-50 transform -translate-x-full transition-transform duration-300 flex flex-col";
      panel.innerHTML = `
          <div class="p-4 border-b flex justify-between items-center">
            <h3 class="text-lg font-bold">Annotations for Ticket ${ticketNumber}</h3>
            <button id="close-annotation-panel" class="text-gray-500 hover:text-red-600">Close</button>
          </div>
          <div id="annotation-comments" class="flex-1 p-4 overflow-y-auto space-y-4">
            <!-- Comments will be appended here -->
          </div>
          <div class="p-4 border-t">
            <textarea id="annotation-input" class="w-full border rounded p-2" placeholder="Add a comment..."></textarea>
            <button id="submit-annotation" class="btn-primary mt-2">Submit Comment</button>
          </div>
        `;
      document.body.appendChild(panel);

      // Close panel
      document
        .getElementById("close-annotation-panel")
        .addEventListener("click", () => {
          panel.classList.add("-translate-x-full");
        });

      // Submit comment
      document
        .getElementById("submit-annotation")
        .addEventListener("click", async () => {
          const input = document.getElementById("annotation-input");
          const message = input.value.trim();
          if (!message) return;

          try {
            const resp = await fetch(
              `/engineering/ticket/${ticketNumber}/comment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ message }),
              }
            );
            const result = await resp.json();
            if (resp.ok && result.success) {
              appendComment(result.comment);
              input.value = "";
            } else {
              alert(
                `Failed to submit comment: ${result.error || "Unknown error"}`
              );
            }
          } catch (err) {
            console.error("Comment submission failed:", err);
            alert("Error submitting comment.");
          }
        });
    }

    // Slide in
    panel.classList.remove("-translate-x-full");
  }

  /**
   * Appends a single comment to the comment thread and scrolls to bottom.
   */
  function appendComment(comment) {
    const container = document.getElementById("annotation-comments");
    const wrapper = document.createElement("div");
    wrapper.className = "bg-gray-100 p-2 rounded";

    const header = document.createElement("div");
    header.className = "flex justify-between items-center mb-1";

    const author = document.createElement("span");
    author.className = "font-semibold text-sm";
    author.textContent = "You";

    const time = document.createElement("span");
    time.className = "text-xs text-gray-500";
    time.textContent = new Date(comment.created_at).toLocaleString();

    header.appendChild(author);
    header.appendChild(time);

    const body = document.createElement("p");
    body.className = "text-sm";
    body.textContent = comment.message;

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    container.appendChild(wrapper);

    // Auto‑scroll
    container.scrollTop = container.scrollHeight;
  }

  // Expose globally
  window.openAnnotationPanel = openAnnotationPanel;
});
