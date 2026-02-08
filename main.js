const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const api = require("./utils/api");
const helper = require("./utils/helper/exporthelper");
const {
  generateBookQRCode,
  generateTransactionQRCode,
} = require("./utils/helper/qrcode.js");
const fs = require("fs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    show: false,
    icon: path.join(__dirname, "renderer/assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenu(null);
  win.loadFile("renderer/html/index.html");

  win.once("ready-to-show", () => {
    win.maximize();
    win.show();
  });

  // for debugging
  win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

// --- IPC Handlers ---

// Book Management Handlers
ipcMain.handle("get-books", () => api.getBooks());

ipcMain.handle("add-book", (event, book) => {
  try {
    const year = Number(book.year);
    const total = Number(book.total_copies);

    if (!book.title || !book.author || !book.category) {
      return { success: false, error: "Missing required fields" };
    }
    if (Number.isNaN(year) || Number.isNaN(total) || total <= 0) {
      return { success: false, error: "Invalid numeric values" };
    }

    api.addBook(book.title, book.author, year, book.category, total);
    return { success: true };
  } catch (err) {
    console.error("Error adding book:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("edit-book", async (event, book) => {
  try {
    await api.editBook(
      book.id,
      book.title,
      book.author,
      book.year,
      book.category,
      book.total_copies,
    );
    return { success: true };
  } catch (err) {
    console.error("Error editing book:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("delete-book", async (event, id) => {
  try {
    const result = await api.deleteBook(id);
    return result;
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("generate-book-qr", async (event, bookId) => {
  const filePath = await generateBookQRCode(bookId);
  return filePath;
});
ipcMain.handle("generate-transaction-qr", async (event, transactionId) => {
  const filePath = await generateTransactionQRCode(transactionId);
  return filePath;
});

// Transaction Handlers
ipcMain.handle("get-transactions", async () => {
  const transactions = await api.getTransactions();
  return transactions;
});
ipcMain.handle("get-transaction-books", (event, transactionId) => {
  try {
    return api.getTransactionBooks(transactionId);
  } catch (err) {
    console.error("DB ERROR:", err);
    return [];
  }
});
ipcMain.handle("add-transaction", (event, payload) => {
  try {
    return api.addTransaction(payload);
  } catch (err) {
    console.error(err);
    throw err;
  }
});
ipcMain.handle("edit-transaction", async (event, transaction) => {
  try {
    await api.editTransaction(
      transaction.id,
      transaction.borrower_name,
      transaction.borrower_st_id,
      transaction.borrower_grade,
      transaction.borrower_section,
      transaction.due_date,
    );
    return { success: true };
  } catch (err) {
    console.error("Error editing transaction:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("return-books", (_, data) => {
  const { transaction_id, books: returnedBooks } = data;
  try {
    api.returnBooks(transaction_id, returnedBooks);
    return { success: true };
  } catch (err) {
    console.error("Return Error:", err);
    return { success: false, error: err.message };
  }
});

// Report Handlers
ipcMain.handle("get-stats", () => {
  try {
    return api.getReportStats();
  } catch (err) {
    console.error("Stats Error:", err);
    return {};
  }
});
ipcMain.handle("export-transactions-filtered", async (_, filter) => {
  try {
    // -------------------------
    // 1️⃣ Fetch data from API
    // -------------------------
    let rows = [];

    if (filter.reportType === "transaction") {
      rows = await api.exportTransactionsFiltered(filter);
    }

    if (filter.reportType === "inventory") {
      rows = await api.exportInventoryFiltered(filter);
    }

    if (filter.reportType === "combined") {
      const inventory = await api.exportInventoryFiltered(filter);
      const transactions = await api.exportTransactionsFiltered(filter);
      rows = { inventory, transactions };
    }

    // -------------------------
    // 2️⃣ Check if data exists
    // -------------------------
    if (
      (!Array.isArray(rows) &&
        !rows.inventory?.length &&
        !rows.transactions?.length) ||
      (Array.isArray(rows) && !rows.length)
    ) {
      return { success: false, message: "No data to export" };
    }

    // -------------------------
    // 3️⃣ Show save dialog
    // -------------------------
    const isExcel = filter.exportType === "excel"; // determine format

    const timestamp = new Date()
      .toLocaleString("sv-SE") // YYYY-MM-DD HH:mm:ss
      .replace(" ", "_")
      .replace(/:/g, "-");

    const { filePath } = await dialog.showSaveDialog({
      title: "Export Library Report",
      defaultPath: isExcel
        ? `library-report-${timestamp}.xlsx`
        : `library-report-${timestamp}.csv`,
      filters: isExcel
        ? [{ name: "Excel Files", extensions: ["xlsx"] }]
        : [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false }; // user canceled

    // -------------------------
    // 4️⃣ Export the file
    // -------------------------
    if (isExcel) {
      helper.exportToExcel(rows, filter, filePath); // REAL XLSX
    } else {
      const csv = helper.exportToCombinedCSV(rows, filter); // CSV text
      fs.writeFileSync(filePath, csv);
    }

    // -------------------------
    // 5️⃣ Return success
    // -------------------------
    return { success: true };
  } catch (err) {
    console.error("Export Error:", err);
    return { success: false, error: err.message };
  }
});

// Settings Handlers

const dbFile = path.join(app.getPath("userData"), "database", "pmci.db");

// Backup folder
const backupDir = path.join(app.getPath("userData"), "backups");

ipcMain.handle("get-database-info", () => {
  // DB size
  const stats = fs.existsSync(dbFile) ? fs.statSync(dbFile) : { size: 0 };
  const sizeMB = (stats.size / 1024 / 1024).toFixed(4) + " MB";

  // Ensure backup folder exists
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // List all backups
  const allBackups = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => {
      const fullPath = path.join(backupDir, f);
      const sizeMB = (fs.statSync(fullPath).size / 1024 / 1024).toFixed(4);
      return { file: fullPath, sizeMB };
    })
    .sort((a, b) => b.file.localeCompare(a.file));

  // Latest backup
  const lastBackup = allBackups.length ? allBackups[0] : "No backups found";

  return {
    dbPath: dbFile,
    dbSize: sizeMB,
    lastBackup,
    allBackups, // optional, useful for frontend display
  };
});

ipcMain.handle("get-library-settings", () => api.getLibrarySettings());
ipcMain.handle("update-library-settings", (event, settings) =>
  api.updateLibrarySettings(settings),
);

// Folder to store logos
ipcMain.handle("save-library-logo", async (event, fileName, uint8Array) => {
  if (!fileName || !uint8Array) throw new Error("No file provided");

  const buffer = Buffer.from(uint8Array);

  // Save in userData folder: userData/library-logos/
  const logoDir = path.join(app.getPath("userData"), "library-logos");
  if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

  const destPath = path.join(logoDir, fileName);
  fs.writeFileSync(destPath, buffer);

  return destPath; // full path in userData
});

ipcMain.handle("backup-database", () => api.backupDatabase());

ipcMain.handle("reset-database", async () => {
  return api.resetDatabase();
});
