// static/js/engineer_review_modal.js

document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("pdf-annotation-overlay");
    const container = document.getElementById("pdf-annotation-container");
    const closeBtn = document.getElementById("close-pdf-annotation");
  
    // Attach click event listener to all buttons with class "open-review-modal"
    document.querySelectorAll(".open-review-modal").forEach(button => {
      button.addEventListener("click", async () => {
        // Get ticket number and PDF filename from button data attributes
        const ticketNumber = button.getAttribute("data-ticket-number");
        const filename = button.getAttribute("data-filename");
        
        // Build the URL to your preview route – ensure your backend route exists
        const url = `/engineering/ticket/${ticketNumber}/preview-file/${filename}`;
  
        try {
          const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          if (!res.ok) throw new Error(`Preview failed with status: ${res.status}`);
          
          // Insert the fetched HTML (the PDF viewer snippet) into the modal container
          const html = await res.text();
          container.innerHTML = html;
          // Show the overlay modal
          overlay.classList.remove("hidden");
        } catch (err) {
          alert("Failed to load PDF preview.");
          console.error(err);
        }
      });
    });
  
    // Attach click event listener to close button of the modal
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        overlay.classList.add("hidden");
        container.innerHTML = ""; // clear out the viewer content
      });
    }
  });
  