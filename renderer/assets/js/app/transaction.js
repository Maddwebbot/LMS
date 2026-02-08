// still working on it
window.addEventListener("DOMContentLoaded", () => {
  // Books
  if (document.getElementById("booksTableBody")) {
    if (searchInput) {
      searchInput.addEventListener("input", loadBooks);
      categorySelect?.addEventListener("change", loadBooks);
      statusSelect.forEach((radio) => {
        radio.addEventListener("change", loadBooks);
      });

      resetBtn?.addEventListener("click", () => {
        searchInput.value = "";
        categorySelect.selectedIndex = 0;
        statusSelect.forEach((radio) => (radio.checked = false));

        selectAll.checked = false;
        loadBooks();
      });
    }
    loadBooks();
    setupSelectAll();
  }

  // Transactions
  if (
    (document.getElementById("transactionsTableBody") && searchInputT) ||
    statusSelectT
  ) {
    searchInputT.addEventListener("input", loadTransaction);
    statusSelectT.forEach((radio) => {
      radio.addEventListener("change", loadTransaction);
    });
    loadTransaction(); // load transactions on page load
  }
});

const searchInputT = document.getElementById("transactionsearch");
const statusSelectT = document.querySelectorAll('input[name="searchStatusT"]');

const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("searchCategory");
const statusSelect = document.querySelectorAll(
  'input[name="searchAvailability"]',
);

const resetBtn = document.getElementById("resetFilters");

let books = [];

async function loadBooks() {
  const tableBody = document.getElementById("booksTableBody");
  if (!tableBody) return;

  books = await window.electronAPI.getBooks();
  tableBody.innerHTML = "";

  const searchTerm = searchInput?.value.trim().toLowerCase() || "";
  const selectedCategory = categorySelect?.value || "";
  const selectedStatus =
    document.querySelector('input[name="searchAvailability"]:checked')?.value ||
    "";

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      !searchTerm ||
      book.title.toLowerCase().includes(searchTerm) ||
      book.author.toLowerCase().includes(searchTerm) ||
      book.year.toString().includes(searchTerm) ||
      book.category.toLowerCase().includes(searchTerm) ||
      book.book_id.toLowerCase().includes(searchTerm);

    const matchesCategory =
      !selectedCategory || book.category === selectedCategory;
    const matchesStatus =
      !selectedStatus ||
      (selectedStatus === "Available"
        ? book.available_amount > 0
        : book.available_amount === 0);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (filteredBooks.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="10" class="not-found">No matching or existing books found</td>`;
    tableBody.appendChild(tr);
    return;
  }

  filteredBooks.forEach((book) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="book-checkbox" value="${book.id}"></td>
      <td>${book.title}</td>
      <td>${book.author}</td>
      <td>${book.category}</td>
      <td>${book.available_amount}</td>
      <td>${book.book_id}</td>
      <td>?</td>
    `;

    const statusTd = tr.querySelector("td:nth-child(7)");
    const isAvailable = book.available_amount > 0;
    statusTd.textContent = isAvailable ? "Available" : "Unavailable";
    statusTd.className = isAvailable
      ? "status available"
      : "status unavailable";
    // Makes the td not selectable when unavailable

    const checkbox = tr.querySelector(".book-checkbox");
    if (!isAvailable) {
      checkbox.disabled = true;
      checkbox.checked = false;
      tr.classList.add("row-unavailable");
    }

    tableBody.appendChild(tr);
  });
}

// -------------------------
// Book Checkbox Selection
// -------------------------
let selectedBooks = new Set();
const selectAll = document.getElementById("selectAll");
function setupSelectAll() {
  const tableBody = document.getElementById("booksTableBody");

  if (!selectAll || !tableBody) return;

  // When the header checkbox is clicked
  selectAll.addEventListener("change", () => {
    const checkboxes = tableBody.querySelectorAll(
      ".book-checkbox:not(:disabled)",
    );

    checkboxes.forEach((cb) => {
      cb.checked = selectAll.checked;
      const id = cb.value;

      if (selectAll.checked) selectedBooks.add(id);
      else selectedBooks.delete(id);
    });
  });

  // When any row checkbox changes
  tableBody.addEventListener("change", (e) => {
    if (!e.target.classList.contains("book-checkbox")) return;

    const cb = e.target;
    const id = cb.value;

    if (cb.checked) selectedBooks.add(id);
    else selectedBooks.delete(id);

    // Update header checkbox
    const allCheckboxes = tableBody.querySelectorAll(
      ".book-checkbox:not(:disabled)",
    );
    const checkedCheckboxes = tableBody.querySelectorAll(
      ".book-checkbox:not(:disabled):checked",
    );

    selectAll.checked =
      allCheckboxes.length > 0 &&
      allCheckboxes.length === checkedCheckboxes.length;
  });
}

// Get selected books anywhere
function getSelectedBooks() {
  return Array.from(selectedBooks);
}

// -------------------------
// Transaction List Modem Functions
// -------------------------

// Populate transaction list
function populateRequestTable() {
  const listTableBody = document.getElementById("listTableBody");
  if (!listTableBody) return;

  listTableBody.innerHTML = "";

  if (selectedBooks.size === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="not-found">No books selected</td>`;
    listTableBody.appendChild(tr);
    return;
  }

  Array.from(selectedBooks).forEach((id) => {
    const book = books.find((b) => b.id.toString() === id);
    if (!book) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${book.title}</td>
      <td>${book.author}</td>
      <td>${book.category}</td>
      <td>${book.available_amount}</td>
      <td>${book.book_id}</td>
      <td>
        <input type="text" class="request-amount" placeholder="Qty" data-max="${book.available_amount}" />
      </td>
    `;
    listTableBody.appendChild(tr);
  });

  // Activate input restrictions
  setupRequestInputs();
}

// Select all request-amount inputs inside the modal in limiting it
async function setupRequestInputs() {
  const settings = await window.electronAPI.getLibrarySettings();
  const GLOBAL_MAX = settings.max_books_per_borrower; // Maximum copies user can borrow per book this should be change via settings

  document.querySelectorAll(".request-amount").forEach((input) => {
    // Determine the maximum allowed: the lower of available_amount and global max
    const bookMax = parseInt(input.dataset.max, 10);
    const max = Math.min(bookMax, GLOBAL_MAX);

    input.addEventListener("input", () => {
      // Remove any non-digit characters
      input.value = input.value.replace(/\D/g, "");

      let val = parseInt(input.value, 10);

      if (isNaN(val) || val <= 0) {
        input.value = ""; // clear invalid input
        return;
      }

      if (val > max) {
        input.value = max; // enforce max
      }
    });
  });
}

function setupBorrowerInputValidation() {
  const nameInput = document.querySelector('input[name="borrower_name"]');
  const gradeInput = document.querySelector('input[name="grade"]');
  const sectionInput = document.querySelector('input[name="section"]');
  const studentNoInput = document.querySelector('input[name="borrower_st_id"]');

  // Name: letters and spaces only
  nameInput.addEventListener("input", () => {
    nameInput.value = nameInput.value.replace(/[^a-zA-ZñÑ\s.,-]/g, "");
  });

  // Grade: numbers only
  gradeInput.addEventListener("input", () => {
    // Remove non-numeric characters
    gradeInput.value = gradeInput.value.replace(/[^0-9]/g, "");

    // Limit to 2 digits max
    if (gradeInput.value.length > 2) {
      gradeInput.value = gradeInput.value.slice(0, 2);
    }
  });

  // Section: letters only (no numbers, allow spaces)
  sectionInput.addEventListener("input", () => {
    sectionInput.value = sectionInput.value.replace(/[^a-zA-ZñÑ\s.,-]/g, "");
  });

  // Student No.: numbers only
  studentNoInput.addEventListener("input", () => {
    studentNoInput.value = studentNoInput.value.replace(/[^0-9]/g, "");

    // Limit to 9 digits max
    if (studentNoInput.value.length > 9) {
      studentNoInput.value = studentNoInput.value.slice(0, 9);
    }
  });
}

// -------------------------
// Modal Elements
// -------------------------

// Add Book Modal
const addModal = document.getElementById("add-transaction-modal");
const openAddBtn = document.getElementById("open-transaction-list");
const addTransactionForm = document.getElementById("add-transaction-form");

// Close buttons (shared class .close)
const closeBtns = document.querySelectorAll(".close");

// -------------------------
// Open Modals
// -------------------------
openAddBtn.addEventListener("click", () => {
  addModal.classList.add("show");
  document.body.style.overflow = "hidden";
  populateRequestTable();
  setupBorrowerInputValidation();
});

// -------------------------
// Close Modals
// -------------------------
closeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".modal").classList.remove("show");
    document.body.style.overflow = "";
  });
});

// Close modal on click outside modal content
window.addEventListener("click", (e) => {
  if (e.target === addModal) {
    addModal.classList.remove("show");
    document.body.style.overflow = "";
  }

  if (e.target === editModal) {
    editModal.classList.remove("show");
    document.body.style.overflow = "";
  }

  if (e.target === infoModal) {
    infoModal.classList.remove("show");
    document.body.style.overflow = "";
  }

  if (e.target === returnModal) {
    returnModal.classList.remove("show");
    document.body.style.overflow = "";
  }
});

// Transaction request -> submission
addTransactionForm.onsubmit = async (e) => {
  e.preventDefault();

  try {
    const formData = new FormData(addTransactionForm);
    const borrower = {
      id: formData.get("borrower_st_id")?.trim(),
      name: formData.get("borrower_name")?.trim(),
      grade: formData.get("grade")?.trim(),
      section: formData.get("section")?.trim(),
    };

    // Simple checks
    if (
      !borrower.id ||
      !borrower.name ||
      !borrower.grade ||
      !borrower.section
    ) {
      showNotification("Borrower information is incomplete", "error", 3000);
      return;
    }

    if (/[^a-zA-ZñÑ\s.,-]/.test(borrower.name)) {
      showNotification(
        "Name can only contain letters and spaces",
        "error",
        3000,
      );
      return;
    }

    if (!/^[0-9]+$/.test(borrower.grade)) {
      showNotification("Grade can only be numbers", "error", 3000);
      return;
    }

    if (/[^a-zA-ZñÑ\s.,-]/g.test(borrower.section)) {
      showNotification("Section can only contain letters", "error", 3000);
      return;
    }

    const selectedBooks = [];

    document.querySelectorAll("#listTableBody tr").forEach((row) => {
      const input = row.querySelector(".request-amount");
      if (!input) return;

      const qty = parseInt(input.value, 10) || 0;
      const max = parseInt(input.dataset.max, 10);

      if (qty <= 0) return; // skip if nothing requested

      if (qty > max) {
        throw new Error(
          `Cannot borrow more than ${max} copies for ${row.cells[0].textContent}`,
        );
      }

      selectedBooks.push({
        id: row.cells[4].textContent.trim(), // Book ID
        qty,
      });
    });

    if (selectedBooks.length === 0) {
      showNotification("No books selected", "error", 3000);
      return;
    }

    const dueDate = new Date();
    const settings = await window.electronAPI.getLibrarySettings();

    dueDate.setDate(dueDate.getDate() + settings.borrow_duration_days);

    const confirm = await customConfirm("Are you sure you want to proceed?");
    if (!confirm) return;

    const transactionId = await window.electronAPI.addTransaction({
      borrower,
      selectedBooks,
      dueDate: dueDate.toISOString().split("T")[0],
    });

    addModal.classList.remove("show");
    showNotification(
      `Transaction successful! TX ID: ${transactionId}`,
      "success",
      3000,
    );
    addTransactionForm.reset();
    loadTransaction();
    loadBooks();
  } catch (err) {
    console.error(err);
    showNotification(err.message, "error", 4000);
  }
};

// -------------------------
// Viewable Existing Transactions
// -------------------------

async function loadTransaction() {
  const tableBody = document.getElementById("transactionsTableBody");
  if (!tableBody) return;

  const transactions = await window.electronAPI.getTransactions();
  tableBody.innerHTML = "";

  const searchTerm = searchInputT?.value.trim().toLowerCase() || "";
  const selectedStatusT =
    document.querySelector('input[name="searchStatusT"]:checked')?.value ||
    "All";

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      !searchTerm ||
      transaction.transaction_id.toLowerCase().includes(searchTerm) ||
      transaction.borrower_st_id.toLowerCase().includes(searchTerm) ||
      transaction.borrower_name.toLowerCase().includes(searchTerm) ||
      transaction.borrower_grade.toLowerCase().includes(searchTerm) ||
      transaction.borrower_section.toLowerCase().includes(searchTerm) ||
      transaction.borrowed_at.toLowerCase().includes(searchTerm) ||
      transaction.due_date.toLowerCase().includes(searchTerm);

    const now = new Date();
    const dueDate = new Date(transaction.due_date);

    const matchesStatus =
      selectedStatusT === "All" ||
      (selectedStatusT === "Returned" && transaction.returned_at) ||
      (selectedStatusT === "Overdue" &&
        !transaction.returned_at &&
        now > dueDate) ||
      (selectedStatusT === "Active" &&
        !transaction.returned_at &&
        now <= dueDate);

    return matchesSearch && matchesStatus;
  });

  if (filteredTransactions.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" class="not-found">No existing transaction found</td>`;
    tableBody.appendChild(tr);
    return;
  }

  filteredTransactions.forEach((transaction) => {
    const borrowedAt = new Date(transaction.borrowed_at);
    const returnedAt = transaction.returned_at
      ? new Date(transaction.returned_at)
      : null;

    const formattedBorrowed = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(borrowedAt);

    const formattedReturned = returnedAt
      ? new Intl.DateTimeFormat("en-CA", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(returnedAt)
      : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
    <td class="bn-td">${transaction.borrower_name}<br><span>${transaction.borrower_st_id}</span></td>
    <td>${transaction.borrower_grade}</td>
    <td>${transaction.borrower_section}</td>
    <td>${formattedBorrowed}</td>
    <td>${transaction.due_date}</td>
    <td>${transaction.transaction_id}</td>
    <td>?</td>
    <td>${formattedReturned}</td>
    <td class="action-td">
      <button class="edit-btn" title="Edit Transaction">
        <div class="icon-container">
          <img src="../assets/img/png/edit-icon.png" alt="Edit">
        </div>
      </button>

      <button class="return-btn" title="Return Items">
        <div class="icon-container">
          <img src="../assets/img/png/return-icon.png" alt="Return">
        </div>
      </button>

      <button class="info-btn" title="Transaction Information">
        <div class="icon-container">
          <img src="../assets/img/png/info-icon.png" alt="Info">
        </div>
      </button>

      <button class="qr-btn" title="Create QR">
        <div class="icon-container">
          <img src="../assets/img/png/qr-icon.png" alt="QR">
        </div>
      </button>
    </td>
  `;

    // Status column
    const statusTd = tr.querySelector("td:nth-child(7)");
    const editBtn = tr.querySelector(".edit-btn");
    const returnBtn = tr.querySelector(".return-btn");

    const now = new Date();
    const dueDate = new Date(transaction.due_date);

    if (transaction.returned_at) {
      statusTd.innerHTML = '<span class="status returned">Returned</span>';

      // Disable buttons
      editBtn.disabled = true;
      returnBtn.disabled = true;

      // Optional: add a CSS class to visually show disabled
      editBtn.classList.add("disabled");
      returnBtn.classList.add("disabled");
    } else if (now > dueDate) {
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      statusTd.innerHTML = `<span class="status overdue">Overdue (${daysOverdue} d)</span>`;

      // Keep buttons active
      editBtn.disabled = false;
      returnBtn.disabled = false;
    } else {
      statusTd.innerHTML = '<span class="status active">Active</span>';

      editBtn.disabled = false;
      returnBtn.disabled = false;
    }

    // Button listeners
    tr.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openTransactionModal(transaction);
    });
    tr.querySelector(".return-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      openReturnModal(transaction);
    });
    tr.querySelector(".info-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openInfoModal(transaction);
    });
    tr.querySelector(".qr-btn").addEventListener("click", async (e) => {
      e.stopPropagation();

      try {
        const filePath = await window.electronAPI.generateTransactionQRCode(
          transaction.transaction_id,
        );
        showNotification(`QR code saved: ${filePath}`, "success", 3000);
      } catch (err) {
        console.error(err);
        showNotification("Failed to generate QR code", "error", 3000);
      }
    });

    tableBody.appendChild(tr);
  });
}

// -------------------------
// Edit Transaction
// -------------------------
const editModal = document.getElementById("edit-transaction-modal");
const editTransactionForm = document.getElementById("edit-transaction-form");

function setupEditTransactionInputValidation() {
  if (!editTransactionForm) return;

  const nameInput = editTransactionForm.elements["borrower_name"];
  const gradeInput = editTransactionForm.elements["borrower_grade"];
  const sectionInput = editTransactionForm.elements["borrower_section"];
  const studentNoInput = editTransactionForm.elements["borrower_st_id"];

  // 🔤 Name: letters and spaces only
  nameInput.addEventListener("input", () => {
    nameInput.value = nameInput.value.replace(/[^a-zA-ZñÑ\s.,-]/g, "");
  });

  // 🔢 Grade: numbers only (max 2 digits)
  gradeInput.addEventListener("input", () => {
    gradeInput.value = gradeInput.value.replace(/[^0-9]/g, "");

    if (gradeInput.value.length > 2) {
      gradeInput.value = gradeInput.value.slice(0, 2);
    }
  });

  // 🏫 Section: letters only
  sectionInput.addEventListener("input", () => {
    sectionInput.value = sectionInput.value.replace(/[^a-zA-ZñÑ\s.,-]/g, "");
  });

  // 🆔 Student No.: numbers only (max 9 digits)
  studentNoInput.addEventListener("input", () => {
    studentNoInput.value = studentNoInput.value.replace(/[^0-9]/g, "");

    if (studentNoInput.value.length > 9) {
      studentNoInput.value = studentNoInput.value.slice(0, 9);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupEditTransactionInputValidation();
});

// Open Edit Book Modal and pre-fill data
function openTransactionModal(transaction) {
  if (!editModal || !editTransactionForm) return;

  editModal.classList.add("show");
  document.body.style.overflow = "hidden";

  // Pre-fill form inputs
  editTransactionForm.elements["borrower_name"].value =
    transaction.borrower_name || "";
  editTransactionForm.elements["borrower_st_id"].value =
    transaction.borrower_st_id || "";
  editTransactionForm.elements["borrower_grade"].value =
    transaction.borrower_grade || "";
  editTransactionForm.elements["borrower_section"].value =
    transaction.borrower_section || "";
  editTransactionForm.elements["due_date"].value = transaction.due_date || "";

  // Store book ID in form dataset
  editTransactionForm.dataset.transactionId = transaction.id;
}

// Edit Book frontend function
async function editTransaction(
  id,
  borrower_name,
  borrower_st_id,
  borrower_grade,
  borrower_section,
  due_date,
) {
  try {
    await window.electronAPI.editTransaction({
      id,
      borrower_name,
      borrower_st_id,
      borrower_grade,
      borrower_section,
      due_date,
    });
    await loadTransaction();
  } catch (err) {
    console.error("Failed to edit transaction:", err);
  }
}

// Edit Transaction Form backend submission
editTransactionForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const transactionId = editTransactionForm.dataset.transactionId;

  const borrower = {
    id: editTransactionForm.elements["borrower_st_id"].value.trim(),
    name: editTransactionForm.elements["borrower_name"].value.trim(),
    grade: editTransactionForm.elements["borrower_grade"].value.trim(),
    section: editTransactionForm.elements["borrower_section"].value.trim(),
  };

  const due_date = editTransactionForm.elements["due_date"].value;

  // 🔍 Basic checks
  if (
    !transactionId ||
    !borrower.id ||
    !borrower.name ||
    !borrower.grade ||
    !borrower.section ||
    !due_date
  ) {
    showNotification("Invalid or incomplete data!", "error", 3000);
    return;
  }

  // 🔤 Name validation
  if (/[^a-zA-ZñÑ\s.,-]/.test(borrower.name)) {
    showNotification("Name can only contain letters and spaces", "error", 3000);
    return;
  }

  // 🔢 Grade validation
  if (!/^[0-9]+$/.test(borrower.grade)) {
    showNotification("Grade can only be numbers", "error", 3000);
    return;
  }

  // 🏫 Section validation
  if (!/^[a-zA-ZñÑ\s.,-]+$/.test(borrower.section)) {
    showNotification("Section can only contain letters", "error", 3000);
    return;
  }

  try {
    await window.electronAPI.editTransaction({
      id: transactionId,
      borrower_name: borrower.name,
      borrower_st_id: borrower.id,
      borrower_grade: borrower.grade,
      borrower_section: borrower.section,
      due_date,
    });

    showNotification("Transaction edited successfully!", "success", 2500);

    editTransactionForm.reset();
    editTransactionForm.dataset.transactionId = "";
    editModal.classList.remove("show");
    document.body.style.overflow = "";

    loadTransaction();
  } catch (err) {
    console.error(err);
    showNotification(
      err.message || "Failed to edit transaction!",
      "error",
      3000,
    );
  }
});

// Set minimum date for due_date input to today
const dueDateInput = document.getElementById("due_date_input");
if (dueDateInput) {
  const today = new Date().toISOString().split("T")[0];
  dueDateInput.min = today;
}

// -------------------------
// Transaction Info
// -------------------------

const infoModal = document.getElementById("info-modal");
const infoContents = document.getElementById("infoContents");

// Open Info Modal data
function openInfoModal(transaction) {
  if (!infoModal) return;

  infoModal.classList.add("show");
  document.body.style.overflow = "hidden";

  // Fill up transaction model with information
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "error";
  }

  setText("transaction_id", transaction.transaction_id);

  // Combine grade + section
  const student =
    transaction.borrower_name && transaction.borrower_st_id
      ? `${transaction.borrower_name} (${transaction.borrower_st_id})`
      : "";

  setText("borrower", student);

  // Combine grade + section
  const gradeSection =
    transaction.borrower_grade && transaction.borrower_section
      ? `${transaction.borrower_grade} ${transaction.borrower_section}`
      : "";

  setText("borrower_grade_section", gradeSection);

  function formatDateYYYYMMDD(dateValue) {
    if (!dateValue) return "";

    const d = new Date(dateValue);
    if (isNaN(d)) return "";

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${y}-${m}-${day}`;
  }
  setText("borrowed_at", formatDateYYYYMMDD(transaction.borrowed_at));

  setText("due_date", transaction.due_date);

  populateTransactionBooks(transaction.transaction_id);
}

// Fetches bookid => to populate/render in the info modal
async function populateTransactionBooks(transactionId) {
  const tbody = document.getElementById("borrowerListBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const books = await window.electronAPI.getTransactionBooks(transactionId);

  if (!Array.isArray(books) || books.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">No borrowed books</td>
      </tr>
    `;
    return;
  }

  books.forEach((book) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${book.title}</td>
      <td>${book.author}</td>
      <td>${book.category}</td>
      <td>${book.copies_borrowed}</td>
      <td>${book.book_id}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------
// Return Transaction
// -------------------------
const returnModal = document.getElementById("return-modal");
const confirmReturnBtn = document.getElementById("confirm-return");

// -------------------------
// Open Return Modal
// -------------------------
function openReturnModal(transaction) {
  if (!returnModal) return;

  returnModal.currentTransaction = transaction;

  returnModal.classList.add("show");
  document.body.style.overflow = "hidden";

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "error";
  }

  setText("return_transaction_id", transaction.transaction_id);
  setText(
    "return_borrower",
    transaction.borrower_name + " (" + transaction.borrower_st_id + ")",
  );
  setText(
    "return_borrower_grade_section",
    transaction.borrower_grade + " " + transaction.borrower_section,
  );
  function formatDateYYYYMMDD(dateValue) {
    if (!dateValue) return "";

    const d = new Date(dateValue);
    if (isNaN(d)) return "";

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${y}-${m}-${day}`;
  }
  setText("return_borrowed_at", formatDateYYYYMMDD(transaction.borrowed_at));
  setText("return_due_date", formatDateYYYYMMDD(transaction.due_date));

  // Populate books table
  populateReturningList(transaction.transaction_id);
}

// -------------------------
// Populate Returnable Books
// -------------------------
async function populateReturningList(transactionId) {
  const tbody = document.getElementById("returnModalBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const books = await window.electronAPI.getTransactionBooks(transactionId);

  // ✅ STORE THEM HERE
  returnModal.transactionBooks = books;

  if (!Array.isArray(books) || books.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No books found</td></tr>`;
    return;
  }

  books.forEach((book, index) => {
    const remaining = book.copies_borrowed - (book.copies_returned ?? 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${book.title}</td>
      <td>${book.author}</td>
      <td>${book.category}</td>
      <td class="borrowedQty">${remaining}</td>
      <td>${book.book_id}</td>
      <td>
        <input
          type="text"
          class="returningQty"
          placeholder="Qty"
          data-index="${index}"
        />
      </td>
    `;

    tbody.appendChild(tr);

    const input = tr.querySelector(".returningQty");

    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
      let val = parseInt(input.value, 10);
      if (!val || val < 1) input.value = "";
      if (val > remaining) input.value = remaining;
    });

    if (remaining <= 0) {
      input.disabled = true;
    }
  });
}

// ====================
// Confirm Return Button
// ====================
confirmReturnBtn.addEventListener("click", async () => {
  if (!returnModal.currentTransaction) return;

  const rows = document.querySelectorAll("#returnModalBody tr");
  const returnData = [];

  rows.forEach((row) => {
    const input = row.querySelector(".returningQty");
    const qty = parseInt(input.value, 10) || 0;
    if (qty > 0) {
      const index = Number(input.dataset.index);
      const book = returnModal.transactionBooks?.[index];

      if (!book) {
        console.warn("Invalid book index:", index);
        return;
      }

      returnData.push({
        book_id: book.book_id,
        returning: qty,
      });
    }
  });

  if (returnData.length === 0) {
    showNotification("No books selected to return!", "error", 2500);
    return;
  }

  try {
    await window.electronAPI.returnBooks({
      transaction_id: returnModal.currentTransaction.transaction_id,
      books: returnData,
    });

    loadTransaction();
    loadBooks();

    showNotification("Book(s) returned successfully!", "success", 2500);

    // Close modal
    returnModal.classList.remove("show");
    document.body.style.overflow = "auto";

    // Refresh transactions
    populateTransactionBooks(returnModal.currentTransaction.transaction_id);
  } catch (err) {
    showNotification(`Return failed: ${err.message}`, "error", 2500);
  }
});

let isScanning = false;
let debounce = false;
let activeBtn = null;
let activeIcon = null;
let activeInput = null;

const previewContainer = document.getElementById("qrContainer");

async function handleQRScan(targetInput, btn, icon) {
  if (debounce) return;
  debounce = true;
  setTimeout(() => (debounce = false), 300);

  if (!targetInput) {
    showNotification("Target input not found", "error", 3000);
    return;
  }

  if (isScanning) {
    window.qrScanner.stopScan();
    resetScanUI();
    showNotification("Scan cancelled", "success", 3000);
    return;
  }

  try {
    isScanning = true;

    activeInput = targetInput;
    activeBtn = btn;
    activeIcon = icon;

    activeIcon.src = "../assets/img/png/cancel-icon.png";
    previewContainer.classList.add("active");

    const qrData = await window.qrScanner.startScan("qrPreview");

    if (activeInput) {
      activeInput.value = qrData;

      if (activeInput.id === "search") loadBooks();
      if (activeInput.id === "transactionsearch") loadTransaction();
    }

    resetScanUI();
    showNotification("QR scanned!", "success", 3000);
  } catch (err) {
    resetScanUI();
    showNotification(err.message, "error", 3000);
  }
}

const scanBtnBooks = document.getElementById("scanBtnBooks");
const scanBtnTransactions = document.getElementById("scanBtnTransactions");

scanBtnBooks.addEventListener("click", () => {
  const input = document.getElementById("search");
  if (!input) return;

  handleQRScan(input, scanBtnBooks, scanBtnBooks.querySelector("img"));
});

scanBtnTransactions.addEventListener("click", () => {
  const input = document.getElementById("transactionsearch");
  if (!input) {
    showNotification("Transaction input not available", "error", 3000);
    return;
  }

  handleQRScan(
    input,
    scanBtnTransactions,
    scanBtnTransactions.querySelector("img"),
  );
});

function resetScanUI() {
  if (isScanning) {
    window.qrScanner.stopScan();
  }

  isScanning = false;

  if (activeIcon) activeIcon.src = "../assets/img/png/scan-icon.png";

  previewContainer.classList.remove("active");
  previewContainer.classList.remove("closing");

  setTimeout(() => {
    previewContainer.classList.remove("closing");
  }, 250);

  activeBtn = null;
  activeIcon = null;
  activeInput = null;
}

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

const sections = document.querySelectorAll(".collapsible-section");

sections.forEach((section) => {
  const header = section.querySelector(".section-header");
  const body = section.querySelector(".section-body");
  const icon = header.querySelector(".toggle-icon");

  header.addEventListener("click", () => {
    const isCurrentlyOpen = body.classList.contains("open");

    // Close all sections first
    sections.forEach((s) => {
      s.querySelector(".section-body").classList.remove("open");
      s.querySelector(".toggle-icon").style.transform = "rotate(0deg)";
    });

    let sectionToOpen;

    if (!isCurrentlyOpen) {
      // Open the clicked section
      body.classList.add("open");
      icon.style.transform = "rotate(180deg)";
      sectionToOpen = section;
    } else {
      // If clicked section was open, open the other one
      const other = Array.from(sections).find((s) => s !== section);
      const otherBody = other.querySelector(".section-body");
      const otherIcon = other.querySelector(".toggle-icon");

      otherBody.classList.add("open");
      otherIcon.style.transform = "rotate(180deg)";
      sectionToOpen = other;
    }

    // Smooth scroll to the opened section
    sectionToOpen.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
});

// Default open section: Book Request
const defaultSection = document.getElementById("request-section");
defaultSection.querySelector(".section-body").classList.add("open");
defaultSection.querySelector(".toggle-icon").style.transform = "rotate(180deg)";
