// Initial load and event listeners
window.addEventListener("DOMContentLoaded", () => {
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
});

const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("searchCategory");
const statusSelect = document.querySelectorAll(
  'input[name="searchAvailability"]',
);
const resetBtn = document.getElementById("resetFilters");

async function loadBooks() {
  const tableBody = document.getElementById("booksTableBody");
  if (!tableBody) return;

  const books = await window.electronAPI.getBooks();
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
      <td>${book.year}</td>
      <td>${book.category}</td>
      <td>${book.total_copies}</td>
      <td>${book.available_amount}</td>
      <td>${book.book_id}</td>
       <td>?</td>
      <td class="action-td">
        <button class="edit-btn" title="Edit Book">
          <div class="icon-container">
            <img src="../assets/img/png/edit-icon.png" alt="Edit">
          </div>
        </button>
        <button class="delete-btn" title="Delete Book">
          <div class="icon-container">
            <img src="../assets/img/png/trash-icon.png" alt="Delete">
          </div>
        </button>
        <button class="qr-btn">
          <div class="icon-container" title="Create QR">
            <img src="../assets/img/png/qr-icon.png" alt="QR">
          </div>
        </button>
      </td>
    `;

    const statusTd = tr.querySelector("td:nth-child(9)");
    const isAvailable = book.available_amount > 0;
    statusTd.textContent = isAvailable ? "Available" : "Unavailable";
    statusTd.className = isAvailable
      ? "status available"
      : "status unavailable";

    // Edit / Delete buttons
    tr.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditBookModal(book);
    });
    tr.querySelector(".delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirm = await customConfirm(
        `Are you sure you want to delete "${book.title}"?`,
      );
      if (!confirm) return;

      await deleteSingleBook(book.id);
    });
    tr.querySelector(".qr-btn").addEventListener("click", async (e) => {
      e.stopPropagation();

      try {
        const filePath = await window.electronAPI.generateBookQRCode(
          book.book_id,
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
// Book Checkbox Selection
// -------------------------
let selectedBooks = new Set();
const selectAll = document.getElementById("selectAll");
function setupSelectAll() {
  const tableBody = document.getElementById("booksTableBody");

  if (!selectAll || !tableBody) return;

  // When the header checkbox is clicked
  selectAll.addEventListener("change", () => {
    const checkboxes = tableBody.querySelectorAll(".book-checkbox");
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
    const allCheckboxes = tableBody.querySelectorAll(".book-checkbox");
    const checkedCheckboxes = tableBody.querySelectorAll(
      ".book-checkbox:checked",
    );
    selectAll.checked = allCheckboxes.length === checkedCheckboxes.length;
  });
}

// Get selected books anywhere
function getSelectedBooks() {
  return Array.from(selectedBooks);
}

// -------------------------
// Delete Book
// -------------------------

// Single book delete function — returns API response, no notifications
async function deleteBook(id) {
  const result = await window.electronAPI.deleteBook(id);
  return result;
}

async function deleteSingleBook(id) {
  const result = await deleteBook(id);

  if (result.success) {
    showNotification(result.msg, "success", 3000);
    loadBooks();
  } else {
    showNotification(result.error, "error", 2500);
  }
}

async function deleteMultipleBooks(ids) {
  const failed = [];
  const succeeded = [];

  for (const id of ids) {
    const result = await deleteBook(id);

    if (result.success) {
      succeeded.push(id);
    } else {
      failed.push({ id, error: result.error });
    }
  }

  // ✅ Success notification
  if (succeeded.length > 0) {
    showNotification(
      `Archived ${succeeded.length} book(s) successfully`,
      "success",
      3000,
    );

    console.log(`Archived book ID(s): ${succeeded.join(", ")}`);
  }

  // ⚠️ Failure notification
  if (failed.length > 0) {
    const failedIds = failed.map((f) => f.id).join(", ");
    const errors = failed.map((f) => f.error).join("; ");

    showNotification(`Some book(s) could not be archived`, "error", 4000);

    console.warn("Failed archives:", failed);
    console.log(`Failed book ID(s): ${failedIds} — ${errors}`);
  }
}

const deleteSelectedBtn = document.getElementById("deleteSelected");
const createQRSelectedBtn = document.getElementById("createQRSelected");

// handler for deleting multiple books
deleteSelectedBtn?.addEventListener("click", async () => {
  const ids = getSelectedBooks();

  if (ids.length === 0) return; // nothing selected, do nothing

  // Delete all selected books
  try {
    const confirm = await customConfirm(
      `Are you sure you want to delete selected book(s)?`,
    );
    if (!confirm) return;
    await deleteMultipleBooks(ids);
  } catch (err) {
    showNotification("Some book(s) were not deleted!", "error", 2500);
    console.error("Failed to delete some books:", err);
  }

  // Clear selection
  selectedBooks.clear();
  const selectAll = document.getElementById("selectAll");
  if (selectAll) selectAll.checked = false;

  // Refresh table
  loadBooks();
});

// handler for creating QR codes for selected books
createQRSelectedBtn?.addEventListener("click", async () => {
  const ids = getSelectedBooks();
  if (ids.length === 0) return; // nothing selected

  try {
    const books = await window.electronAPI.getBooks();
    const toGenerate = books.filter((b) => ids.includes(b.id.toString()));

    for (const book of toGenerate) {
      try {
        await window.electronAPI.generateBookQRCode({
          bookId: book.book_id,
          title: book.title,
          category: book.category,
          open: false, // avoid popping up dozens of windows during bulk export
        });
        showNotification(
          `QR code generated for "${book.title}"`,
          "success",
          1500,
        );
      } catch (err) {
        console.error(`Failed to generate QR for ${book.title}:`, err);
        showNotification(
          `Failed to generate QR for "${book.title}"`,
          "error",
          2000,
        );
      }
    }

    // optional: clear selection after generation
    selectedBooks.clear();
    const selectAllCheckbox = document.getElementById("selectAll");
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    loadBooks();
  } catch (err) {
    console.error("Error while generating QR codes:", err);
    showNotification("Failed to create QR codes", "error", 3000);
  }
});

// -------------------------
// Modal Elements
// -------------------------

// Add Book Modal
const addModal = document.getElementById("add-book-modal");
const openAddBtn = document.getElementById("open-add-book");
const addBookForm = document.getElementById("add-book-form");
const addAuthor = addBookForm.querySelector('input[name="author"]');
const addYearInput = addBookForm.querySelector('input[name="year"]');
const addAmountInput = addBookForm.querySelector('input[name="amount"]');
const addNotification = document.getElementById("modal-notification");

// Edit Book Modal
const editModal = document.getElementById("edit-book-modal");
const editBookForm = document.getElementById("edit-book-form");
const editYearInput = editBookForm.querySelector('input[name="year"]');
const editTotalCopiesInput = editBookForm.querySelector(
  'input[name="total_copies"]',
);

// Close buttons (shared class .close)
const closeBtns = document.querySelectorAll(".close");

// -------------------------
// Open Modals
// -------------------------
openAddBtn.addEventListener("click", () => {
  addModal.classList.add("show");
  addBookForm.querySelector('input[name="title"]').focus();
});

// -------------------------
// Close Modals
// -------------------------
closeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".modal").classList.remove("show");
  });
});

// Close modal on click outside modal content
window.addEventListener("click", (e) => {
  if (e.target === addModal) addModal.classList.remove("show");
  if (e.target === editModal) editModal.classList.remove("show");
});

// -------------------------
// Input Validation (Add & Edit Forms)
// -------------------------

// Add Form
addAuthor.addEventListener("input", () => {
  addAuthor.value = addAuthor.value.replace(/[^a-zA-Z\s.,-]/g, "");
});

addYearInput.addEventListener("input", () => {
  addYearInput.value = addYearInput.value.replace(/\D/g, "").slice(0, 4);
});

addAmountInput.addEventListener("input", () => {
  addAmountInput.value = addAmountInput.value.replace(/\D/g, "");
});

// Edit Form
editYearInput.addEventListener("input", () => {
  editYearInput.value = editYearInput.value.replace(/\D/g, "").slice(0, 4);
});

editTotalCopiesInput.addEventListener("input", () => {
  const min = parseInt(editTotalCopiesInput.dataset.minCopies, 10) || 0;
  let value = parseInt(editTotalCopiesInput.value, 10) || 0;

  if (value < min) {
    editTotalCopiesInput.value = min;
  }
});

// -------------------------
// Add Book
// -------------------------

// Add Book frontend function
async function addBook(title, author, year, category, total_copies) {
  const result = await window.electronAPI.addBook({
    title,
    author,
    year,
    category,
    total_copies,
  });

  if (!result.success) {
    showNotification(`Could not add book: ${result.error}`, "error", 4000);
    return;
  }

  await loadBooks();
  showNotification("Book added successfully!", "success", 2500);
}

// Add Book Form backend submission
addBookForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = addBookForm.elements["title"].value.trim();
  const author = addBookForm.elements["author"].value.trim();
  const year = parseInt(addBookForm.elements["year"].value);
  const category = addBookForm.elements["category"]?.value.trim() || "General";
  const amount = parseInt(addBookForm.elements["amount"].value) || 1;

  if (title && author && category && amount && !isNaN(year)) {
    addBookForm.dataset.bookId = "";
    addModal.classList.remove("show");
    addBook(title, author, year, category, amount);
    showNotification("Book added successfully!", "success", 2500);
    addBookForm.reset();
  } else {
    showNotification("Could not add book!", "error", 2500);
  }
});

// -------------------------
// Edit Book
// -------------------------

// Open Edit Book Modal and pre-fill data
function openEditBookModal(book) {
  if (!editModal || !editBookForm) return;

  editModal.classList.add("show");

  // Pre-fill form inputs
  editBookForm.elements["title"].value = book.title || "";
  editBookForm.elements["author"].value = book.author || "";
  editBookForm.elements["year"].value = book.year || "";
  editBookForm.elements["category"].value = book.category || "";
  editBookForm.elements["total_copies"].value = book.total_copies || "";

  // Calculate minimum total copies based on active transactions
  // Example: book.total_copies = 10, book.available_amount = 7 => 3 are active
  const activeTransactions = book.total_copies - book.available_amount;
  const minCopies = activeTransactions;
  editTotalCopiesInput.min = minCopies; // set the min attribute dynamically
  editTotalCopiesInput.dataset.minCopies = minCopies; // store for validation

  const minHint = document.getElementById("min-copies-hint");

  if (activeTransactions == book.total_copies) {
    minHint.style.display = "none";
  } else {
    minHint.style.display = "block";
    minHint.textContent = `Minimum total copies: ${minCopies}`;
  }

  // Store book ID in form dataset
  editBookForm.dataset.bookId = book.id;

  editBookForm.elements["title"].focus();
}

// Edit Book frontend function
async function editBook(id, title, author, year, category, total_copies) {
  try {
    await window.electronAPI.editBook({
      id,
      title,
      author,
      year,
      category,
      total_copies,
    });
    await loadBooks();
  } catch (err) {
    console.error("Failed to edit book:", err);
  }
}

// Edit Book Form backend submission
editBookForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = editBookForm.dataset.bookId;
  const title = editBookForm.elements["title"].value.trim();
  const author = editBookForm.elements["author"].value.trim();
  const year = parseInt(editBookForm.elements["year"].value);
  const category = editBookForm.elements["category"]?.value.trim() || "General";
  const total_copies = editBookForm.elements["total_copies"].value.trim();

  console.log(total_copies);

  if (id && title && author && category && total_copies && !isNaN(year)) {
    editBook(id, title, author, year, category, total_copies);
    editBookForm.dataset.bookId = "";
    editModal.classList.remove("show");
    showNotification("Book edited successfully!", "success", 2500);
  } else {
    showNotification("Invalid data encoded!", "error", 2500);
  }
});

const scanBtn = document.getElementById("scanBtn");
const scanIcon = document.getElementById("scanIcon");
const previewContainer = document.getElementById("qrContainer");

let isScanning = false;
let debounce = false;

scanBtn.addEventListener("click", async () => {
  if (debounce) return;
  debounce = true;
  setTimeout(() => (debounce = false), 300);

  // Cancel scanning if already scanning
  if (isScanning) {
    window.qrScanner.stopScan();
    resetScanUI();
    showNotification("Scan cancelled", "success", 3000);
    return;
  }

  // Start scanning
  try {
    isScanning = true;
    scanBtn.disabled = true;

    scanIcon.src = "../assets/img/png/cancel-icon.png";
    previewContainer.classList.add("active");

    scanBtn.disabled = false;

    // Start QR scan
    const qrData = await window.qrScanner.startScan("qrPreview");

    resetScanUI();
    showNotification("QR scanned!", "success", 3000);

    const successSound = new Audio("../assets/audio/scan.mp3");
    successSound.play();

    // Inject scanned QR into search
    searchInput.value = qrData;

    // Re-filter books table
    loadBooks();
  } catch (err) {
    resetScanUI();
    showNotification(err.message, "error", 3000);
  }
});

// UI reset function
function resetScanUI() {
  window.qrScanner.stopScan();
  isScanning = false;
  scanBtn.disabled = false;
  scanIcon.src = "../assets/img/png/scan-icon.png";
  previewContainer.classList.remove("active");
  previewContainer.classList.remove("closing");

  setTimeout(() => {
    previewContainer.classList.remove("closing");
  }, 250);
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
