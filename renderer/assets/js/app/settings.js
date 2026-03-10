// Tab switching functionality
document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", function () {
    const tabName = this.getAttribute("data-tab");

    // Remove active class from all buttons and content
    document
      .querySelectorAll(".tab-button")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((content) => content.classList.remove("active"));

    // Add active class to clicked button and corresponding content
    this.classList.add("active");
    document.getElementById(tabName).classList.add("active");
  });
});

// Toggle switches functionality
document.querySelectorAll(".toggle").forEach((toggle) => {
  toggle.addEventListener("click", function () {
    this.classList.toggle("active");
  });
});

// Logo Preview
const logoInput = document.getElementById("libraryLogo");
if (logoInput) {
  logoInput.addEventListener("change", () => {
    const file = logoInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const logoPreview = document.getElementById("logoPreview");
      logoPreview.src = e.target.result;
      logoPreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });
}

// ------------------------- Load settings on page load -------------------------
window.addEventListener("load", async () => {
  try {
    const settings = await window.electronAPI.getLibrarySettings();
    if (!settings) return;

    document.getElementById("libraryName").value = settings.library_name;
    document.getElementById("schoolName").value = settings.school_name;
    document.getElementById("maxBooks").value = settings.max_books_per_borrower;
    document.getElementById("borrowDays").value = settings.borrow_duration_days;

    if (settings.library_logo_path) {
      const logoPreview = document.getElementById("logoPreview");
      logoPreview.src = `file://${settings.library_logo_path}`;
      logoPreview.style.display = "block";
    }

    // Load database info
    const { dbPath, lastBackup, dbSize } =
      await window.electronAPI.getDatabaseInfo();

    document.getElementById("dbLocation").textContent = dbPath;
    document.getElementById("dbSize").textContent = dbSize;

    // Handle lastBackup object
    if (lastBackup && typeof lastBackup === "object") {
      document.getElementById("lastBackup").textContent =
        `${lastBackup.file} (${lastBackup.sizeMB})`;
    } else {
      document.getElementById("lastBackup").textContent = lastBackup;
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
});

// ------------------------- Save Library Settings ------------------------------
async function saveLibrarySettings() {
  // Get current settings
  const currentSettings = await window.electronAPI.getLibrarySettings();
  const existingLogoPath = currentSettings.library_logo_path || null;

  const libraryName = document.getElementById("libraryName").value;
  const schoolName = document.getElementById("schoolName").value;
  const maxBooks = parseInt(document.getElementById("maxBooks").value);
  const borrowDays = parseInt(document.getElementById("borrowDays").value);

  if (!libraryName || !schoolName || !maxBooks || !borrowDays) {
    return showNotification("Please fill in all fields", "error", 2500);
  }

  let logoPath = existingLogoPath;
  const logoInput = document.getElementById("libraryLogo");

  if (logoInput.files.length > 0) {
    const file = logoInput.files[0];
    if (!file) return showNotification("No file selected", "error", 2500);

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    logoPath = await window.electronAPI.saveLibraryLogo(
      "library-logo.png",
      uint8Array,
    );
  }

  const settings = {
    library_name: libraryName,
    school_name: schoolName,
    max_books_per_borrower: maxBooks,
    borrow_duration_days: borrowDays,
    library_logo_path: logoPath,
  };

  await window.electronAPI.updateLibrarySettings(settings);

  // Notification before reload
  showNotification("Settings Saved!", "success", 1200);
  setTimeout(() => {
    window.location.reload();
  }, 1210);
}

// ------------------------- Backup / Reset || Drop / Import -----------------------------------
async function backupDatabase() {
  try {
    const path = await window.electronAPI.backupDatabase();
    showNotification("Backup created: " + path, "success", 2500);
    window.location.reload();
  } catch (err) {
    showNotification("Failed to create backup.", "error", 2500);
    console.error(err);
  }
}

async function restoreBackup() {
  try {
    const confirm = await customConfirm(
      "Restoring a backup will replace your current database and cannot be undone. Continue?",
    );
    if (!confirm) return;

    const result = await window.electronAPI.restoreBackup();
    if (!result.success) {
      showNotification(
        result.message || result.error || "Restore cancelled",
        "info",
        2500,
      );
      return;
    }

    let msg = "Backup restored successfully.";
    if (result.oldPath) {
      const name = result.oldPath.split(/[\\/]/).pop();
      msg += ` Previous database renamed to ${name}`;
    }

    showNotification(msg, "success", 3000);

    // give a moment before reloading so user sees notification
    setTimeout(() => {
      window.location.reload();
    }, 3100);
  } catch (err) {
    showNotification("Failed to restore backup.", "error", 2500);
    console.error(err);
  }
}

async function resetDatabase() {
  try {
    const confirm = await customConfirm(
      `Are you sure you want to delete records?`,
    );
    if (!confirm) return;

    const result = await window.electronAPI.resetDatabase();
    if (result.success) {
      showNotification(result.msg, "success", 3000);
    } else {
      showNotification(result.error, "error", 3000);
    }
  } catch (err) {
    console.error("Error occured upon deleting: ", err);
  }
}

async function importBooks() {
  const result = await window.electronAPI.importBooksFromExcel();

  if (!result.success) {
    return showNotification(result.message, "error", 3000);
  }

  showNotification(
    `Imported: ${result.inserted} | Duplicates skipped: ${result.duplicates}`,
    "success",
    4000,
  );
}

async function downloadTemplate() {
  try {
    await window.electronAPI.downloadTemplate();
    showNotification("Template successfully downloaded.", "success", 2500);
  } catch (err) {
    showNotification("Failed to download template.", "error", 2500);
    console.error(err);
  }
}

async function downloadManual() {
  try {
    await window.electronAPI.downloadManual();
    showNotification("User manual successfully downloaded.", "success", 2500);
  } catch (err) {
    showNotification("Failed to download user manual.", "error", 2500);
    console.error(err);
  }
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
