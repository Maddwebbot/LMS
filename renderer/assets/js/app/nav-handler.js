// Global Navigation Handler for Notification Clicks
document.addEventListener("DOMContentLoaded", () => {
  // Listen for navigation commands from main process notifications
  window.electronAPI.onNavigatePage((page) => {
    // Map page names to HTML file names
    const pageMap = {
      dashboard: "index.html",
      books: "books.html",
      transactions: "transaction.html",
      reports: "reports.html",
      settings: "settings.html",
    };

    const fileName = pageMap[page];
    if (fileName) {
      // Navigate to the specified page
      window.location.href = fileName;
    }
  });
});
