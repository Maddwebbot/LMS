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
  console.log("[NotificationHelper] showNotification called", title, options);
  if (!Notification.isSupported()) {
    console.warn(
      "[NotificationHelper] Electron notifications are not supported on this platform.",
    );
    return;
  }

  const notificationOptions = {
    title: title || "Notification",
    body: options.body || "",
    timeoutType: "default",
    icon: path.join(__dirname, "../../renderer/assets/icon.ico"),
    tag: "bookling-notification",
    ...options,
  };

  const notification = new Notification(notificationOptions);

  notification.once("show", () => {
    console.log(
      "[NotificationHelper] Notification shown:",
      notificationOptions.title,
    );
  });

  notification.once("failed", (err) => {
    console.error("[NotificationHelper] Notification failed:", err);
  });

  notification.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      if (page) {
        mainWindow.webContents.send("navigate-to-page", page);
      }
    }
  });

  try {
    notification.show();
  } catch (err) {
    console.error("[NotificationHelper] notification.show() failed", err);
  }
}

// Check if a date is overdue
function parseDueDate(dueDate) {
  if (!dueDate) return null;
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    // Try with explicit timezone for YYYY-MM-DD
    const normalized = `${dueDate}T23:59:59`;
    const tryParse = new Date(normalized);
    return Number.isNaN(tryParse.getTime()) ? null : tryParse;
  }
  return parsed;
}

function isOverdue(dueDate) {
  const parsed = parseDueDate(dueDate);
  if (!parsed) return false;
  return parsed < new Date();
}

// Periodically check for overdue transactions (every 30 minutes)
async function startOverdueCheck() {
  // Function to run the check
  const runCheck = async () => {
    try {
      const transactions = await api.getTransactions();
      console.log(
        `[NotificationHelper] Overdue check run: ${transactions.length} transactions`,
      );

      const overdueTransactions = transactions.filter((t) => {
        const parsedDue = parseDueDate(t.due_date);
        const isOverdueDate = parsedDue ? parsedDue < new Date() : false;
        const isNotFullyReturned = t.fully_returned === 0 || !t.fully_returned;

        if (parsedDue === null) {
          console.warn(
            `[NotificationHelper] Invalid due_date for transaction ${t.transaction_id}: ${t.due_date}`,
          );
        }

        return isOverdueDate && isNotFullyReturned;
      });

      if (overdueTransactions.length > 0) {
        console.log(
          `[NotificationHelper] Found ${overdueTransactions.length} overdue transaction(s)`,
        );
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
      } else {
        console.log("[NotificationHelper] No overdue transactions found.");
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
