// static/js/pdf_comments.js

/**
 * PDF Comment Thread Module
 * - Handles comment UI, posting, optimistic updates, and event dispatch.
 * - Advanced, modular, and ready for real-time or WebSocket extension.
 * - Usage: import { PdfCommentThread } from './pdf_comments.js';
 */

export class PdfCommentThread {
  /**
   * @param {Object} options
   * @param {string} options.ticketNumber - The ticket number for API calls.
   * @param {HTMLElement} options.threadContainer - The DOM element for the comment thread.
   * @param {HTMLFormElement} options.form - The comment form element.
   * @param {HTMLTextAreaElement} options.input - The comment input textarea.
   * @param {HTMLElement} options.badge - The badge element for unread count.
   * @param {string|number} options.currentUserId - The current user's ID.
   */
  constructor({
    ticketNumber,
    threadContainer,
    form,
    input,
    badge,
    currentUserId,
  }) {
    this.ticketNumber = ticketNumber;
    this.threadContainer = threadContainer;
    this.form = form;
    this.input = input;
    this.badge = badge;
    this.currentUserId = currentUserId;
    this.comments = [];
    this.optimisticId = 0;

    this._bindEvents();
    this.loadComments();
  }

  _bindEvents() {
    if (this.form) {
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = this.input.value.trim();
        if (!msg) return;
        this.postComment(msg);
      });
    }
  }

  /**
   * Loads comments from the backend and renders them.
   */
  async loadComments() {
    if (!this.ticketNumber) return;
    try {
      const resp = await fetch(
        `/engineering/ticket/${this.ticketNumber}/comments`
      );
      if (!resp.ok) throw new Error("Failed to load comments");
      const comments = await resp.json();
      this.comments = comments;
      this.renderComments();
      this._dispatch("comments:loaded", { comments });
    } catch (err) {
      this.threadContainer.innerHTML =
        '<div class="text-red-500 text-sm text-center py-4">Failed to load comments.</div>';
    }
  }

  /**
   * Renders the comment thread.
   */
  renderComments() {
    const comments = this.comments;
    this.threadContainer.innerHTML = "";
    if (!comments.length) {
      this.threadContainer.innerHTML =
        '<div class="comment-placeholder text-gray-400 text-sm text-center py-4">No comments yet. Add your notes or revision requests here.</div>';
      this.badge?.classList.add("hidden");
      return;
    }
    comments.forEach((c) => {
      this.threadContainer.appendChild(this._renderCommentItem(c));
    });
    // Show badge if there are unread comments (future: integrate with backend)
    this.badge?.classList.toggle("hidden", comments.length === 0);
    this.badge && (this.badge.textContent = comments.length);
    // Auto-scroll to bottom
    this.threadContainer.scrollTop = this.threadContainer.scrollHeight;
  }

  /**
   * Renders a single comment item.
   * @param {Object} c - Comment object.
   * @returns {HTMLElement}
   */
  _renderCommentItem(c) {
    const div = document.createElement("div");
    div.className = "comment-item bg-gray-100 rounded p-2 mb-2 flex flex-col";
    const header = document.createElement("div");
    header.className = "flex justify-between items-center mb-1";
    const author = document.createElement("span");
    author.className = "font-semibold text-xs";
    author.textContent =
      c.user_id == this.currentUserId ? "You" : c.author_name || "Engineer";
    const time = document.createElement("span");
    time.className = "text-xs text-gray-500";
    time.textContent = new Date(c.created_at).toLocaleString();
    header.appendChild(author);
    header.appendChild(time);
    const body = document.createElement("p");
    body.className = "text-sm";
    body.textContent = c.message;
    div.appendChild(header);
    div.appendChild(body);
    if (c.optimistic) {
      div.classList.add("opacity-60");
    }
    return div;
  }

  /**
   * Posts a comment (optimistic UI).
   * @param {string} message
   */
  async postComment(message) {
    // Optimistic UI: add comment immediately
    const optimisticComment = {
      id: `optimistic-${++this.optimisticId}`,
      user_id: this.currentUserId,
      author_name: "You",
      message,
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    this.comments.push(optimisticComment);
    this.renderComments();
    this.input.value = "";
    this._dispatch("comments:post", { message });

    // Post to backend
    try {
      const resp = await fetch(
        `/engineering/ticket/${this.ticketNumber}/comment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ message }),
        }
      );
      if (!resp.ok) throw new Error("Failed to post comment");
      const data = await resp.json();
      // Replace optimistic comment with real one
      this.comments = this.comments.filter(
        (c) => !c.optimistic || c.message !== message
      );
      if (data.comment) {
        this.comments.push(data.comment);
      }
      this.renderComments();
      this._dispatch("comments:posted", { comment: data.comment });
    } catch (err) {
      // Remove optimistic comment and show error
      this.comments = this.comments.filter(
        (c) => !c.optimistic || c.message !== message
      );
      this.renderComments();
      alert("Failed to post comment.");
      this._dispatch("comments:error", { error: err });
    }
  }

  /**
   * Dispatches a custom event for cross-module communication.
   * @param {string} name
   * @param {Object} detail
   */
  _dispatch(name, detail) {
    document.dispatchEvent(new CustomEvent(`pdf-comments:${name}`, { detail }));
  }
}
