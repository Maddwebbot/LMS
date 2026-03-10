const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const api = require("./utils/api");
const helper = require("./utils/helper/exporthelper");
const {
  generateBookQRCode,
  generateTransactionQRCode,
} = require("./utils/helper/qrcode.js");
const fs = require("fs");
const { importBooksFromExcel } = require("./utils/helper/importhelper.js");
const {
  setMainWindow,
  startOverdueCheck,
} = require("./utils/helper/notificationHelper.js");

// Set app name and ID for Windows notifications
if (process.platform === "win32") {
  app.setAppUserModelId("BookLing");
}

// Set application name to match package.json
app.name = "BookLing";

// Single instance lock
let mainWindow;
const gotTheLock = app.requestSingleInstanceLock();
let isStartupMinimized = process.argv.includes("--minimized");

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    // If someone tries to open a second instance or opening the app for a second time, focus on the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
// Set up auto-launch on system startup
if (process.platform === "win32") {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe"),
    args: ["--minimized"],
  });

  // Update Windows registry to show BookLing icon in startup
  const { execSync } = require("child_process");
  const iconPath = path.join(__dirname, "renderer/assets/icon.ico");

  try {
    // Register the app with icon in Windows registry
    const exePath = app.getPath("exe");
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "BookLing" /d "\\"${exePath}\\" --minimized" /f`,
      { stdio: "pipe", windowsHide: true },
    );
  } catch (err) {
    console.error("Error updating registry:", err.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.setMenu(null);
  mainWindow.loadFile("renderer/html/index.html");

  // Set mainWindow reference for notification helper
  setMainWindow(mainWindow);

  mainWindow.once("ready-to-show", () => {
    if (!isStartupMinimized) {
      mainWindow.maximize();
      mainWindow.show();
    } else {
      // Start minimized in system tray if launched on startup
      mainWindow.hide();
    }
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // for debugging
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  createWindow();
  await startOverdueCheck(); // Start checking for overdue transactions
});

// Quit app when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
// Re-create window on app activate (macOS)
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

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

ipcMain.handle("generate-book-qr", async (event, payload) => {
  // payload can be a plain id or an object containing extra metadata
  let args;
  if (typeof payload === "object" && payload !== null) {
    // normalize name for internal helper, but keep all other fields (e.g. open)
    const bookId = payload.bookId || payload.id || payload.book_id;
    args = { ...payload, bookId };
    // remove alternative keys if any
    delete args.id;
    delete args.book_id;
  } else {
    args = payload; // simple id
  }
  const filePath = await generateBookQRCode(args);
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
    const result = api.addTransaction(payload);
    return result;
  } catch (err) {
    console.error(err);
    throw err;
  }
});
ipcMain.handle("edit-transaction", (event, transaction) => {
  try {
    api.editTransaction(
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
ipcMain.handle("backup-database", () => {
  try {
    const result = api.backupDatabase();
    return result;
  } catch (err) {
    console.error("Backup Error:", err);
    throw err;
  }
});

ipcMain.handle("restore-backup", async () => {
  try {
    const backupDir = path.join(app.getPath("userData"), "backups");
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Select Backup File",
      defaultPath: backupDir,
      properties: ["openFile"],
      filters: [{ name: "Backup Files", extensions: ["db"] }],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, message: "Restore cancelled" };
    }

    const backupPath = filePaths[0];
    const result = api.restoreDatabase(backupPath);
    return result;
  } catch (err) {
    console.error("Restore Error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("reset-database", async () => {
  try {
    const result = api.resetDatabase();
    return result;
  } catch (err) {
    console.error("Reset Error:", err);
    throw err;
  }
});
ipcMain.handle("import-books-from-excel", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }],
  });

  if (canceled) {
    return { success: false, message: "Import cancelled" };
  }

  try {
    const result = importBooksFromExcel(filePaths[0]);
    return {
      success: true,
      inserted: result.inserted,
      duplicates: result.duplicates,
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Import failed" };
  }
});
ipcMain.handle("download-template", async () => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: "Download Import Template",
      defaultPath: "books-import-template.xlsx",
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (!filePath) return { success: false, message: "Download cancelled" };

    const templatePath = path.join(__dirname, "renderer/assets/sample.xlsx");
    fs.copyFileSync(templatePath, filePath);
    return { success: true, filePath };
  } catch (err) {
    console.error("Template Download Error:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("download-manual", async () => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: "Download User Manual",
      defaultPath: "BookLing_User_Manual.pdf",
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (!filePath) return { success: false, message: "Download cancelled" };

    const manualPath = path.join(
      __dirname,
      "renderer/assets/BookLing_User_Manual.pdf",
    );
    fs.copyFileSync(manualPath, filePath);
    return { success: true, filePath };
  } catch (err) {
    console.error("Manual Download Error:", err);
    return { success: false, error: err.message };
  }
});
