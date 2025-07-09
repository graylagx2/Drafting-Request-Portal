import { openRequestsModal } from "./view_requests_modal.js";

// Module-level variable for file uploader data; used to reset uploader on type change
let uploadedFiles = [];
// Expose a reset function for the file uploader so that data is wiped when request type changes
let resetFileUploader = () => {};

export const initRequestModal = () => {
  const modalTrigger = document.getElementById("open-request-modal");
  const modalRoot = document.getElementById("modal-root");

  if (!modalTrigger || !modalRoot) return;

  modalTrigger.addEventListener("click", async (e) => {
    e.preventDefault();
    if (document.querySelector("#modal-container")) return;

    try {
      const res = await fetch("/drafting/submit");
      if (!res.ok)
        throw new Error(
          `Failed to load modal: ${res.status} ${res.statusText}`
        );
      modalRoot.innerHTML = await res.text();
      document.body.classList.add("overflow-hidden");

      // Bind all modal and form-related events
      bindModalEvents();
      bindRequestTypeToggle();
      bindFileUploader();
      bindCharCounter();
      bindFormValidation();
    } catch (err) {
      console.error("Modal load error:", err);
      alert(`Unable to load form. Please try again.\n${err.message}`);
    }
  });
};

const bindModalEvents = () => {
  const overlay = document.querySelector("#modal-overlay");
  const closeBtn = document.querySelector("#close-modal");
  const container = document.querySelector("#modal-container");

  const closeModal = () => {
    document.body.classList.remove("overflow-hidden");
    container?.classList.add("animate-fadeOut");
    setTimeout(() => {
      const modalRoot = document.getElementById("modal-root");
      if (modalRoot) modalRoot.innerHTML = "";
    }, 250);
  };

  document.addEventListener(
    "keydown",
    (e) => e.key === "Escape" && closeModal()
  );
  overlay?.addEventListener("click", closeModal);
  closeBtn?.addEventListener("click", closeModal);
};

// Bind request type toggle events; also wipe any previous type-specific data and reset the file uploader
const bindRequestTypeToggle = () => {
  const typeSelect = document.querySelector("#request_type");
  const typeSpecificFields = document.querySelector("#type-specific-fields");
  const fileUploaderContainer = document.querySelector("#file-uploader-container");

  // Updated renderFields function using fieldset/legend structure for floating labels
  const renderFields = (type) => {
    switch (type) {
      case "isometric":
        typeSpecificFields.innerHTML = `
          <div class="grid grid-cols-2 gap-2">
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">Pipe Spec</legend>
              <input name="pipe_spec" type="text" placeholder="Pipe Spec (required)" required class="floating-input w-full" />
            </fieldset>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">Operating PSIG</legend>
              <input name="operating_psig" type="text" placeholder="Operating PSIG (required)" required class="floating-input w-full" />
            </fieldset>
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">Operating Temp (°F)</legend>
              <input name="operating_temp" type="text" placeholder="Operating Temp (°F, required)" required class="floating-input w-full" />
            </fieldset>
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">Design PSIG</legend>
              <input name="design_psig" type="text" placeholder="Design PSIG (required)" required class="floating-input w-full" />
            </fieldset>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">Design Temp (°F)</legend>
              <input name="design_temp" type="text" placeholder="Design Temp (°F, required)" required class="floating-input w-full" />
            </fieldset>
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">RT NDE</legend>
              <select name="nde_rt" required class="floating-input w-full">
                <option value="" disabled selected hidden>RT (required)</option>
                <option>N/A</option>
                <option>5%</option>
                <option>10%</option>
                <option>20%</option>
                <option>100%</option>
              </select>
            </fieldset>
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">MT/PT NDE</legend>
              <select name="nde_pt" required class="floating-input w-full">
                <option value="" disabled selected hidden>MT/PT (required)</option>
                <option>N/A</option>
                <option>5%</option>
                <option>10%</option>
                <option>20%</option>
                <option>100%</option>
              </select>
            </fieldset>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">Pressure Test (PSIG)</legend>
              <input name="pressure_test" type="text" placeholder="Pressure Test (PSIG, required)" required class="floating-input w-full" />
            </fieldset>
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">Paint Spec</legend>
              <input name="paint_spec" type="text" placeholder="Default: N/A" class="floating-input w-full" />
            </fieldset>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">PWHT Temp (°F)</legend>
              <input name="pwht_temp" type="text" placeholder="Default: N/A" class="floating-input w-full" />
            </fieldset>
            <fieldset class="floating-fieldset">
              <legend class="floating-legend">PWHT Hold Time</legend>
              <input name="pwht_hold" type="text" placeholder="Default: N/A" class="floating-input w-full" />
            </fieldset>
          </div>
          <fieldset class="floating-fieldset">
            <legend class="floating-legend">Insulation Spec</legend>
            <input name="insulation_spec" type="text" placeholder="Default: N/A" class="floating-input w-full" />
          </fieldset>
        `;
        break;
      case "asbuilt":
      case "moc":
        typeSpecificFields.innerHTML = "";
        break;
      case "rfi":
        typeSpecificFields.innerHTML = `
          <fieldset class="floating-fieldset">
            <legend class="floating-legend">Equipment Number</legend>
            <input name="equipment_number" type="text" placeholder="Equipment Number (optional)" class="floating-input w-full" />
          </fieldset>
        `;
        break;
      default:
        typeSpecificFields.innerHTML = "";
    }
  };

  typeSelect?.addEventListener("change", (e) => {
    typeSpecificFields.innerHTML = "";
    typeSpecificFields.classList.add("hidden");

    if (typeof resetFileUploader === "function") {
      resetFileUploader();
    }

    const selectedType = e.target.value;
    if (selectedType) {
      renderFields(selectedType);
      typeSpecificFields.classList.remove("hidden");
      typeSpecificFields.classList.add("animate-fadeIn");
      fileUploaderContainer.classList.remove("hidden");
      setTimeout(() => {
        fileUploaderContainer.classList.remove("opacity-0", "translate-y-4");
      }, 10);
    } else {
      fileUploaderContainer.classList.add("hidden");
    }
  });
};

const bindCharCounter = () => {
  const desc = document.querySelector("#description");
  const counter = document.querySelector("#char-count");
  const max = 150;
  if (!desc) return;

  const update = () => {
    const remaining = max - (desc.value?.length ?? 0);
    counter.textContent = `${Math.max(0, remaining)} characters remaining`;
  };

  desc.addEventListener("input", update);
  update();
};

const showError = (field, message, errorId) => {
  let errorElem = field.parentElement.querySelector(`#${errorId}`);
  if (!errorElem) {
    errorElem = document.createElement("p");
    errorElem.id = errorId;
    errorElem.className = "text-xs text-red-500 mt-1";
    errorElem.textContent = message;
    field.parentElement.appendChild(errorElem);
  }
  errorElem.classList.remove("hidden");
};

const hideError = (field, errorId) => {
  const errorElem = field.parentElement.querySelector(`#${errorId}`);
  if (errorElem) {
    errorElem.classList.add("hidden");
  }
};

const bindFormValidation = () => {
  const form = document.getElementById("drafting-form");
  if (!form) return;

  const checkFormValidity = () => {
    const priority = form.querySelector("#priority");
    const unit = form.querySelector("#unit");
    const reviewEngineer = form.querySelector('[name="review_engineer"]');
    const requestTypeField = form.querySelector("#request_type");
    const desc = form.querySelector("#description");
    const files = form.querySelector("#attachments");
    const pipeSpec = form.querySelector('[name="pipe_spec"]');
    let isValid = true;

    if (!priority?.value) isValid = false;
    if (!unit?.value) isValid = false;
    if (!reviewEngineer || !reviewEngineer.value.trim()) isValid = false;
    if (!requestTypeField?.value) isValid = false;
    if (desc.value.trim().length < 150) isValid = false;
    if (
      requestTypeField?.value !== "rfi" &&
      requestTypeField?.value !== "moc" &&
      files.files.length === 0
    )
      isValid = false;

    if (requestTypeField?.value === "isometric") {
      if (!pipeSpec || !pipeSpec.value.trim()) isValid = false;
      const operatingPsig = form.querySelector('[name="operating_psig"]');
      const operatingTemp = form.querySelector('[name="operating_temp"]');
      const designPsig = form.querySelector('[name="design_psig"]');
      const designTemp = form.querySelector('[name="design_temp"]');
      const ndeRt = form.querySelector('[name="nde_rt"]');
      const ndePt = form.querySelector('[name="nde_pt"]');
      const pressureTest = form.querySelector('[name="pressure_test"]');
      if (!operatingPsig || !operatingPsig.value.trim()) isValid = false;
      if (!operatingTemp || !operatingTemp.value.trim()) isValid = false;
      if (!designPsig || !designPsig.value.trim()) isValid = false;
      if (!designTemp || !designTemp.value.trim()) isValid = false;
      if (!ndeRt || ndeRt.selectedIndex === 0) isValid = false;
      if (!ndePt || ndePt.selectedIndex === 0) isValid = false;
      if (!pressureTest || !pressureTest.value.trim()) isValid = false;
    }

    if (requestTypeField?.value === "asbuilt") {
      const serviceField = form.querySelector('[name="service"]');
      if (!serviceField || !serviceField.value.trim()) isValid = false;
    }

    return isValid;
  };

  const updateSubmitButtonState = () => {
    const btn = document.getElementById("submit-button");
    if (!btn) return;
  
    if (checkFormValidity()) {
      // enable and paint Nexus‑Blue
      btn.classList.remove("bg-gray-300", "hover:bg-nexus-dark");
      // pull the CSS vars and set inline
      const root = getComputedStyle(document.documentElement);
      btn.style.backgroundColor = root.getPropertyValue("--nexus-blue").trim();
      btn.style.color = root.getPropertyValue("--nexus-white").trim();
    } else {
      // revert to gray
      btn.classList.remove("btn-primary");
      btn.classList.add("bg-gray-300", "hover:bg-nexus-dark");
      // clear any inline colors
      btn.style.backgroundColor = "";
      btn.style.color = "";
    }
  };

  form.addEventListener("input", updateSubmitButtonState);
  form.addEventListener("change", updateSubmitButtonState);
  updateSubmitButtonState();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const priority = form.querySelector("#priority");
    const unit = form.querySelector("#unit");
    const reviewEngineer = form.querySelector('[name="review_engineer"]');
    const requestTypeField = form.querySelector("#request_type");
    const desc = form.querySelector("#description");
    const files = form.querySelector("#attachments");
    const pipeSpec = form.querySelector('[name="pipe_spec"]');
    let isValid = true;

    if (!priority?.value) {
      document.getElementById("priority-error").classList.remove("hidden");
      isValid = false;
    } else {
      document.getElementById("priority-error").classList.add("hidden");
    }

    if (!unit?.value) {
      document.getElementById("unit-error").classList.remove("hidden");
      isValid = false;
    } else {
      document.getElementById("unit-error").classList.add("hidden");
    }

    if (!reviewEngineer || !reviewEngineer.value.trim()) {
      document
        .getElementById("review-engineer-error")
        .classList.remove("hidden");
      isValid = false;
    } else {
      document.getElementById("review-engineer-error").classList.add("hidden");
    }

    if (!requestTypeField?.value) {
      document.getElementById("request-type-error").classList.remove("hidden");
      isValid = false;
    } else {
      document.getElementById("request-type-error").classList.add("hidden");
    }

    if (desc.value.trim().length < 150) {
      document.getElementById("description-error").classList.remove("hidden");
      isValid = false;
    } else {
      document.getElementById("description-error").classList.add("hidden");
    }

    if (
      requestTypeField?.value !== "rfi" &&
      requestTypeField?.value !== "moc" &&
      files.files.length === 0
    ) {
      document.getElementById("file-error").classList.remove("hidden");
      isValid = false;
    } else {
      document.getElementById("file-error").classList.add("hidden");
    }

    if (requestTypeField?.value === "isometric") {
      if (!pipeSpec || !pipeSpec.value.trim()) {
        showError(
          pipeSpec,
          "Pipe Spec is required for Isometric requests.",
          "pipe-spec-error"
        );
        isValid = false;
        pipeSpec.focus();
      } else {
        hideError(pipeSpec, "pipe-spec-error");
      }
      const operatingPsig = form.querySelector('[name="operating_psig"]');
      const operatingTemp = form.querySelector('[name="operating_temp"]');
      const designPsig = form.querySelector('[name="design_psig"]');
      const designTemp = form.querySelector('[name="design_temp"]');
      const ndeRt = form.querySelector('[name="nde_rt"]');
      const ndePt = form.querySelector('[name="nde_pt"]');
      const pressureTest = form.querySelector('[name="pressure_test"]');
      if (!operatingPsig || !operatingPsig.value.trim()) {
        showError(
          operatingPsig,
          "Operating PSIG is required.",
          "operating-psig-error"
        );
        isValid = false;
      } else {
        hideError(operatingPsig, "operating-psig-error");
      }
      if (!operatingTemp || !operatingTemp.value.trim()) {
        showError(
          operatingTemp,
          "Operating Temp is required.",
          "operating-temp-error"
        );
        isValid = false;
      } else {
        hideError(operatingTemp, "operating-temp-error");
      }
      if (!designPsig || !designPsig.value.trim()) {
        showError(designPsig, "Design PSIG is required.", "design-psig-error");
        isValid = false;
      } else {
        hideError(designPsig, "design-psig-error");
      }
      if (!designTemp || !designTemp.value.trim()) {
        showError(designTemp, "Design Temp is required.", "design-temp-error");
        isValid = false;
      } else {
        hideError(designTemp, "design-temp-error");
      }
      if (!ndeRt || ndeRt.selectedIndex === 0) {
        showError(ndeRt, "RT NDE selection is required.", "nde-rt-error");
        isValid = false;
      } else {
        hideError(ndeRt, "nde-rt-error");
      }
      if (!ndePt || ndePt.selectedIndex === 0) {
        showError(ndePt, "PT NDE selection is required.", "nde-pt-error");
        isValid = false;
      } else {
        hideError(ndePt, "nde-pt-error");
      }
      if (!pressureTest || !pressureTest.value.trim()) {
        showError(
          pressureTest,
          "Pressure Test is required.",
          "pressure-test-error"
        );
        isValid = false;
      } else {
        hideError(pressureTest, "pressure-test-error");
      }
    }

    if (requestTypeField?.value === "asbuilt") {
      const serviceField = form.querySelector('[name="service"]');
      if (!serviceField || !serviceField.value.trim()) {
        showError(serviceField, "Service is required.", "service-error");
        isValid = false;
      } else {
        hideError(serviceField, "service-error");
      }
    }

    if (!isValid) {
      updateSubmitButtonState();
      return;
    }

    // Set default for optional fields if empty
    ["paint_spec", "pwht_temp", "pwht_hold", "insulation_spec"].forEach(
      (name) => {
        const field = form.querySelector(`[name="${name}"]`);
        if (field && !field.value.trim()) field.value = "N/A";
      }
    );

    fetch("/drafting/submit", {
      method: "POST",
      body: new FormData(form),
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          const container = document.querySelector("#modal-container");
          if (container) {
            container.classList.add("animate-fadeOut");
            setTimeout(() => {
              const modalRoot = document.getElementById("modal-root");
              if (modalRoot) modalRoot.innerHTML = "";
              document.body.classList.remove("overflow-hidden");
              // Open the View Requests modal as originally
              openRequestsModal();
            }, 250);
          }
        } else {
          console.error("Submission error:", data.error);
          alert(`Submission failed: ${data.error}`);
        }
      })
      .catch((err) => {
        console.error("Submission exception:", err);
        alert(`Error submitting the form. Try again later.\n${err.message}`);
      });
  });
};

const bindFileUploader = () => {
  const dropZone = document.querySelector("#drop-zone");
  const fileInput = document.querySelector("#attachments");
  const preview = document.querySelector("#file-preview");
  uploadedFiles = [];

  const render = () => {
    preview.innerHTML = "";
    uploadedFiles.forEach((file, i) => {
      const clone = document
        .querySelector("#file-thumbnail-template")
        .content.cloneNode(true);
      clone.querySelector(".filename").textContent = file.name;
      clone.querySelector(".remove-file")?.addEventListener("click", () => {
        uploadedFiles.splice(i, 1);
        render();
      });
      preview.appendChild(clone);
    });
    const dt = new DataTransfer();
    uploadedFiles.forEach((f) => dt.items.add(f));
    fileInput.files = dt.files;
  };

  const handleFiles = (incoming) => {
    for (const file of incoming) {
      if (uploadedFiles.length >= 8) return alert("Max 8 files allowed.");
      if (
        !uploadedFiles.some((f) => f.name === file.name && f.size === file.size)
      ) {
        uploadedFiles.push(file);
      }
    }
    render();
  };

  dropZone?.addEventListener("click", () => fileInput.click());
  fileInput?.addEventListener("change", (e) =>
    handleFiles([...e.target.files])
  );
  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("ring", "ring-nexus-blue");
  });
  dropZone?.addEventListener("dragleave", () =>
    dropZone.classList.remove("ring", "ring-nexus-blue")
  );
  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("ring", "ring-nexus-blue");
    handleFiles([...e.dataTransfer.files]);
  });

  // Expose the reset function to clear uploader data when request type changes
  resetFileUploader = () => {
    uploadedFiles = [];
    preview.innerHTML = "";
    const dt = new DataTransfer();
    fileInput.files = dt.files;
  };
};

export {
  bindModalEvents,
  bindRequestTypeToggle,
  bindCharCounter,
  bindFormValidation,
  bindFileUploader,
};
