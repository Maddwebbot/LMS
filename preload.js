const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Book Page
  getBooks: () => ipcRenderer.invoke("get-books"),

  addBook: (book) => ipcRenderer.invoke("add-book", book),
  editBook: (book) => ipcRenderer.invoke("edit-book", book),
  deleteBook: (id) => ipcRenderer.invoke("delete-book", id),
  // bookIdOrObj may be a string or an object containing {bookId, title, category}
  generateBookQRCode: (bookIdOrObj) =>
    ipcRenderer.invoke("generate-book-qr", bookIdOrObj),

  // Transaction Page
  getTransactions: () => ipcRenderer.invoke("get-transactions"),
  getTransactionBooks: (transactionId) =>
    ipcRenderer.invoke("get-transaction-books", transactionId),
  addTransaction: (payload) => ipcRenderer.invoke("add-transaction", payload),
  editTransaction: (transaction) =>
    ipcRenderer.invoke("edit-transaction", transaction),

  // need to be recoded
  returnBooks: (data) => ipcRenderer.invoke("return-books", data),

  generateTransactionQRCode: (transactionId) =>
    ipcRenderer.invoke("generate-transaction-qr", transactionId),

  // Report Stats
  getStats: () => ipcRenderer.invoke("get-stats"),
  exportTransactions: (filter) =>
    ipcRenderer.invoke("export-transactions-filtered", filter),

  // Settings
  getDatabaseInfo: () => ipcRenderer.invoke("get-database-info"),
  getLibrarySettings: () => ipcRenderer.invoke("get-library-settings"),
  updateLibrarySettings: (settings) =>
    ipcRenderer.invoke("update-library-settings", settings),
  saveLibraryLogo: (fileName, uint8Array) =>
    ipcRenderer.invoke("save-library-logo", fileName, uint8Array),
  importBooksFromExcel: () => ipcRenderer.invoke("import-books-from-excel"),
  downloadTemplate: () => ipcRenderer.invoke("download-template"),
  downloadManual: () => ipcRenderer.invoke("download-manual"),

  // Database Backup
  backupDatabase: () => ipcRenderer.invoke("backup-database"),
  importBackup: () => ipcRenderer.invoke("import-backup"),
  restoreBackup: () => ipcRenderer.invoke("restore-backup"),
  resetDatabase: () => ipcRenderer.invoke("reset-database"),

  // Navigation from notifications
  onNavigatePage: (callback) => {
    ipcRenderer.on("navigate-to-page", (event, page) => {
      callback(page);
    });
  },
});
