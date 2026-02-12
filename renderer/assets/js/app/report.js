// -------------------------
// Elements
// -------------------------
const requestModal = document.getElementById("request-modal");
const openRequestBtn = document.getElementById("open-report-request");
const reportForm = document.getElementById("export-report-form");
const closeBtns = document.querySelectorAll(".close");

const radios = document.querySelectorAll('input[name="dateRange"]');
const customRange = document.getElementById("customDateRange");

radios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    customRange.classList.toggle("show", e.target.value === "custom");
  });
});

const from = document.getElementById("fromDate");
const to = document.getElementById("toDate");

radios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const isCustom = e.target.value === "custom";
    from.disabled = !isCustom;
    to.disabled = !isCustom;
  });
});

const fieldMap = {
  inventory: [
    { key: "book_id", label: "Book ID" },
    { key: "title", label: "Title" },
    { key: "author", label: "Author" },
    { key: "category", label: "Category" },
    { key: "year", label: "Year" },
    { key: "total_copies", label: "Total Copies" },
    { key: "available_amount", label: "Available Copies" },
  ],

  transaction: [
    { key: "transaction_id", label: "Transaction ID" },
    { key: "book_id", label: "Book ID" },
    { key: "borrower_st_id", label: "Student ID" },
    { key: "borrower_name", label: "Borrower Name" },
    { key: "borrower_grade", label: "Grade" },
    { key: "borrower_section", label: "Section" },
    { key: "copies_borrowed", label: "Copies Borrowed" },
    { key: "borrowed_at", label: "Borrowed Date" },
    { key: "due_date", label: "Due Date" },
    { key: "returned_at", label: "Returned Date" },
  ],
};

const commonFields = {
  inventory: ["book_id", "title", "author", "available_amount"],
  transaction: ["transaction_id", "book_id", "borrower_name", "borrowed_at"],
  combined: ["book_id", "title", "borrower_name", "borrowed_at"],
};

const reportRadios = document.querySelectorAll('input[name="reportType"]');
const checklist = document.getElementById("fieldChecklist");

reportRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    renderFields(e.target.value);
  });
});

// populate checklist
function renderFields(type) {
  checklist.innerHTML = "";

  if (type === "combined") {
    createGroup("Books Inventory", fieldMap.inventory);
    createGroup("Transactions", fieldMap.transaction);
  } else {
    createGroup(
      type === "inventory" ? "Books Inventory" : "Transactions",
      fieldMap[type],
    );
  }

  autoSelectFields(type);
}

function autoSelectFields(type) {
  const defaults = commonFields[type] || [];

  document
    .querySelectorAll('#fieldChecklist input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = defaults.includes(cb.value);
    });
}

// checklist helper
function createGroup(title, fields) {
  const group = document.createElement("div");
  group.className = "field-group";

  const heading = document.createElement("h6");
  heading.textContent = title;

  const list = document.createElement("div");
  list.className = "field-list";

  fields.forEach((field) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";

    label.innerHTML = `
      <input type="checkbox" value="${field.key}" />
      ${field.label}
    `;

    list.appendChild(label);
  });

  group.appendChild(heading);
  group.appendChild(list);
  checklist.appendChild(group);
}

reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // -------------------------
  // Report type
  // -------------------------
  const reportType = document.querySelector(
    'input[name="reportType"]:checked',
  )?.value;

  if (!reportType) {
    showNotification("Please select a report type.", "error", 3000);
    return;
  }

  // -------------------------
  // Date range
  // -------------------------
  const dateRangeValue = document.querySelector(
    'input[name="dateRange"]:checked',
  )?.value;

  if (!dateRangeValue) {
    showNotification("Please select a date range.", "error", 3000);

    return;
  }

  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  const type = dateRangeValue === "custom" ? "range" : dateRangeValue;

  if (type === "range" && (!from || !to)) {
    showNotification("Please select both From and To dates.", "error", 3000);

    return;
  }

  // -------------------------
  // Selected fields
  // -------------------------
  const fields = Array.from(
    document.querySelectorAll('#fieldChecklist input[type="checkbox"]:checked'),
  ).map((cb) => cb.value);

  if (!fields.length) {
    showNotification(
      "Please select at least one field to export.",
      "error",
      3000,
    );

    return;
  }

  // -------------------------
  // Export type
  // -------------------------
  const exportType = document.querySelector(
    'input[name="exportType"]:checked',
  )?.value;

  if (!exportType) {
    showNotification("Please select an export format.", "error", 3000);

    return;
  }

  // -------------------------
  // Final filter object
  // -------------------------
  const filter = {
    reportType,
    type,
    from,
    to,
    fields,
    exportType,
  };

  // -------------------------
  // Send to backend
  // -------------------------
  const result = await window.electronAPI.exportTransactions(filter);

  if (result.success) {
    showNotification("Report exported successfully!", "success", 3000);

    requestModal.classList.remove("show");
    document.body.style.overflow = "";
    reportForm.reset();
  } else {
    showNotification(result.message || "Export failed.", "error", 3000);
  }
});

// -------------------------
// Open Modal
// -------------------------
openRequestBtn.addEventListener("click", () => {
  requestModal.classList.add("show");
  document.body.style.overflow = "hidden";
});

// -------------------------
// Close Modal
// -------------------------
closeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    requestModal.classList.remove("show");
    document.body.style.overflow = "";
  });
});

// Close when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === requestModal) {
    requestModal.classList.remove("show");
    document.body.style.overflow = "";
  }
});

// -------------------------
// Notification working and Confirmation Modal
// -------------------------

/**
 * Show a custom notification
 * @param {string} message - The message to display
 * @param {string} type - "success", "error", "info" (optional, default "success")
 * @param {number} duration - How long to show it in ms (optional, default 2000)
 */
function showNotification(message, type = "success", duration = 2000) {
  const notification = document.getElementById("modal-notification");
  if (!notification) return;

  notification.textContent = message;
  notification.className = `modal-notification show ${type}`;

  // Remove the notification after the duration
  setTimeout(() => {
    notification.className = "modal-notification";
    notification.textContent = "";
  }, duration);
}
// Example usage:
// showNotification("Book added successfully!", "success", 2500);
// showNotification("Failed to delete book!", "error", 3000);

/**
 * Show a custom confirmation modal with dynamic message
 * @param {string} message - Message to display
 * @returns {Promise<boolean>} - Resolves true if Yes, false if No
 */
function customConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm-modal");
    const msgEl = document.getElementById("custom-confirm-message");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    msgEl.textContent = message;
    modal.classList.remove("hidden");

    // Cleanup listeners
    const cleanup = () => {
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      modal.classList.add("hidden");
    };

    const onYes = () => {
      cleanup();
      resolve(true);
    };

    const onNo = () => {
      cleanup();
      resolve(false);
    };

    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}
// Example usage:
// const confirm = await customConfirm(
//   `Are you sure you want to delete selected book(s)?`,
// );
// if (!confirm) return;
