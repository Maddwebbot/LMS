const { Notification } = require("electron");
const path = require("path");
const api = require("../api");

let mainWindow = null;

// Set mainWindow reference for navigation
function setMainWindow(window) {
  mainWindow = window;
}

// Show notification utility
function showNotification(title, options = {}, page = null) {
  const notification = new Notification({
    title: title,
    timeoutType: "default",
    icon: path.join(__dirname, "../../renderer/assets/icon.ico"),
    tag: "bookling-notification",
    ...options,
  });

  // Add click handler to navigate to specified page
  notification.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Send navigation command to renderer
      if (page) {
        mainWindow.webContents.send("navigate-to-page", page);
      }
    }
  });

  notification.show();
}

// Check if a date is overdue
function isOverdue(dueDate) {
  return new Date(dueDate) < new Date();
}

// Periodically check for overdue transactions (every 30 minutes)
async function startOverdueCheck() {
  // Function to run the check
  const runCheck = async () => {
    try {
      const transactions = await api.getTransactions();

      const overdueTransactions = transactions.filter((t) => {
        const isOverdueDate = isOverdue(t.due_date);
        const isNotFullyReturned = t.fully_returned === 0 || !t.fully_returned;

        return isOverdueDate && isNotFullyReturned;
      });

      if (overdueTransactions.length > 0) {
        const borrowerDetails = overdueTransactions
          .map(
            (t) =>
              `Name:    ${t.borrower_name}\nGrade:   ${t.borrower_grade}-${t.borrower_section}\nTransaction ID: ${t.transaction_id}`,
          )
          .join("\n\n");

        showNotification(
          "⚠️ Overdue Transaction!",
          {
            body: borrowerDetails,
          },
          "transactions",
        );
      }
    } catch (err) {
      console.error("Error checking overdue transactions:", err);
    }
  };

  // Run check immediately on startup
  await runCheck();

  // Then set interval to check every 30 minutes
  setInterval(runCheck, 30 * 60 * 1000);
}

module.exports = {
  setMainWindow,
  showNotification,
  isOverdue,
  startOverdueCheck,
};
