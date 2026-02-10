const db = require("./db");
const stats = require("./stats");

// QR-Code Unique ID Generation
function generateBookId() {
  return `B${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// Offline CRUD
function addBook(title, author, year, category, total_copies) {
  const book_id = generateBookId();

  db.prepare(
    `
    INSERT INTO books (
      title, author, year, book_id, category,
      total_copies, available_amount
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(title, author, year, book_id, category, total_copies, total_copies);
}

function deleteBook(id) {
  try {
    // 1️⃣ Check for active (unreturned) transactions
    const active = db
      .prepare(
        `
      SELECT COUNT(*) AS count
      FROM transactions t
      JOIN books b ON b.book_id = t.book_id
      WHERE b.id = ?
        AND t.copies_borrowed > t.copies_returned
    `,
      )
      .get(id);

    if (active.count > 0) {
      return {
        success: false,
        error: "Cannot delete book: active transaction ongoing",
      };
    }

    // 2️⃣ Archive the book (soft delete)
    const result = db
      .prepare(
        `
      UPDATE books
      SET is_deleted = 1
      WHERE id = ? AND is_deleted = 0
    `,
      )
      .run(id);

    if (result.changes === 0) {
      return {
        success: false,
        error: "Book not found or already archived",
      };
    }

    return {
      success: true,
      msg: "Book archived successfully!",
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getBooks() {
  return db
    .prepare(
      `
    SELECT * 
    FROM books 
    WHERE is_deleted = 0
  `,
    )
    .all();
}

function editBook(id, title, author, year, category, total_copies) {
  // 1️⃣ Get current book info
  const book = db
    .prepare("SELECT total_copies, available_amount FROM books WHERE id = ?")
    .get(id);

  if (!book) throw new Error("Book not found");

  const activeTransactions = book.total_copies - book.available_amount;

  // 2️⃣ Validate total_copies
  if (total_copies < activeTransactions) {
    throw new Error(
      `Total copies cannot be less than currently borrowed books (${activeTransactions})`,
    );
  }

  // 3️⃣ Calculate new available_amount
  // New available = old available + (new total - old total)
  let newAvailable = book.available_amount + (total_copies - book.total_copies);

  // Clamp available_amount between 0 and total_copies
  if (newAvailable < 0) newAvailable = 0;
  if (newAvailable > total_copies) newAvailable = total_copies;

  // 4️⃣ Update the book
  db.prepare(
    `
    UPDATE books
    SET title = ?, author = ?, year = ?, category = ?, total_copies = ?, available_amount = ?
    WHERE id = ?
  `,
  ).run(title, author, year, category, total_copies, newAvailable, id);
}

let txCounter = 0;

function generateTXCId() {
  // Get first 6 chars of UUID
  const uuidPart = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 6)
    .toUpperCase();

  // Last 4 digits of current timestamp
  const timePart = Date.now().toString().slice(-4);

  // Increment counter and reset if it gets too high
  txCounter = (txCounter + 1) % 100;
  const counterPart = txCounter.toString().padStart(2, "0"); // always 2 digits

  return `TXC-${uuidPart}${timePart}${counterPart}`;
}

function addTransaction({ borrower, selectedBooks, dueDate }) {
  if (!Array.isArray(selectedBooks)) {
    throw new Error("selectedBooks must be an array");
  }

  const transaction_id = generateTXCId();

  const insertTx = db.prepare(`
    INSERT INTO transactions (
      transaction_id, book_id,
      borrower_st_id, borrower_name, borrower_grade, borrower_section,
      copies_borrowed, due_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStock = db.prepare(`
    UPDATE books
    SET available_amount = available_amount - ?
    WHERE book_id = ? AND available_amount >= ?
  `);

  const tx = db.transaction(() => {
    for (const book of selectedBooks) {
      insertTx.run(
        transaction_id,
        book.id,
        borrower.id,
        borrower.name,
        borrower.grade,
        borrower.section,
        book.qty,
        dueDate,
      );

      const result = updateStock.run(book.qty, book.id, book.qty);
      if (result.changes === 0) {
        throw new Error("Not enough copies available");
      }
    }
  });

  tx();

  return transaction_id;
}

function editTransaction(
  id,
  borrower_name,
  borrower_st_id,
  borrower_grade,
  borrower_section,
  due_date,
) {
  db.prepare(
    `
    UPDATE transactions
    SET borrower_name = ?, borrower_st_id = ?, borrower_grade = ?, borrower_section = ?, due_date = ?
    WHERE id = ?
  `,
  ).run(
    borrower_name,
    borrower_st_id,
    borrower_grade,
    borrower_section,
    due_date,
    id,
  );
}

function getTransactions() {
  return db
    .prepare(
      `
      SELECT
        t.transaction_id,
        MIN(t.borrower_name) AS borrower_name,
        MIN(t.borrower_st_id) AS borrower_st_id,
        MIN(t.borrower_grade) AS borrower_grade,
        MIN(t.borrower_section) AS borrower_section,
        MIN(t.borrowed_at) AS borrowed_at,
        MAX(t.due_date) AS due_date,
        MAX(t.returned_at) AS returned_at, -- Latest returned_at
        CASE
          WHEN SUM(t.copies_borrowed - t.copies_returned) = 0 THEN 1
          ELSE 0
        END AS fully_returned
      FROM transactions t
      GROUP BY t.transaction_id
      ORDER BY borrowed_at DESC
    `,
    )
    .all();
}

// Transaction Items Get
function getTransactionBooks(transactionId) {
  return db
    .prepare(
      `
    SELECT 
      b.title,
      b.author,
      b.year,
      b.category,
      b.book_id,
      t.copies_borrowed,
      t.copies_returned
    FROM transactions t
    JOIN books b ON b.book_id = t.book_id
    WHERE t.transaction_id = ?

  `,
    )
    .all(transactionId);
}

// -------------------------
// Return a single book's stock
// -------------------------
function returnBook(bookId, qty) {
  const book = db
    .prepare(
      `SELECT available_amount, total_copies FROM books WHERE book_id = ?`,
    )
    .get(bookId);

  if (!book) throw new Error(`Book ${bookId} not found`);
  if (qty <= 0) throw new Error("Return quantity must be positive");

  const newAvailable = book.available_amount + qty;

  if (newAvailable > book.total_copies) {
    throw new Error("Return exceeds total copies");
  }

  db.prepare(`UPDATE books SET available_amount = ? WHERE book_id = ?`).run(
    newAvailable,
    bookId,
  );
}

// -------------------------
// Return multiple books in a single transaction
// Returns updated transaction rows for frontend
// -------------------------
function returnBooks(transactionId, returnedBooks) {
  if (!Array.isArray(returnedBooks) || returnedBooks.length === 0) {
    throw new Error("No books to return");
  }

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    returnedBooks.forEach(({ book_id, returning }) => {
      // Fetch transaction row
      const txn = db
        .prepare(
          `
          SELECT copies_borrowed, copies_returned
          FROM transactions
          WHERE transaction_id = ? AND book_id = ?
        `,
        )
        .get(transactionId.trim(), book_id.trim());

      if (!txn) {
        throw new Error(`Transaction row not found for book ID ${book_id}`);
      }

      const returnedSoFar = txn.copies_returned || 0;
      const remaining = txn.copies_borrowed - returnedSoFar;

      if (remaining <= 0) {
        throw new Error(`All copies already returned for book ID ${book_id}`);
      }
      if (returning > remaining) {
        throw new Error(
          `Cannot return ${returning}. Only ${remaining} remaining for book ID ${book_id}.`,
        );
      }

      // Update book stock
      returnBook(book_id, returning);

      // Calculate total returned copies
      const totalReturned = returnedSoFar + returning;

      if (totalReturned >= txn.copies_borrowed) {
        // Fully returned → set returned_at
        db.prepare(
          `
          UPDATE transactions
          SET copies_returned = ?, returned_at = ?
          WHERE transaction_id = ? AND book_id = ?
        `,
        ).run(totalReturned, now, transactionId, book_id);
      } else {
        // Partial return → only update copies_returned
        db.prepare(
          `
          UPDATE transactions
          SET copies_returned = ?
          WHERE transaction_id = ? AND book_id = ?
        `,
        ).run(totalReturned, transactionId, book_id);
      }
    });
  });

  // Execute all updates atomically
  tx();

  // Fetch and return updated transactions
  const updatedRows = returnedBooks.map(({ book_id }) =>
    db
      .prepare(
        `
        SELECT book_id, copies_borrowed, copies_returned, returned_at
        FROM transactions
        WHERE transaction_id = ? AND book_id = ?
      `,
      )
      .get(transactionId.trim(), book_id.trim()),
  );

  return updatedRows;
}

// Report Statistics
function getReportStats() {
  return {
    booksPerCategory: stats.booksPerCategory(),
    availability: stats.availabilityStats(),
    borrowedTrend: stats.borrowedTrend(),
    mostBorrowed: stats.mostBorrowedBooks(),
    summary: stats.librarySummary(),

    peakBorrowDays: stats.peakBorrowDays(5),
    outofStack: stats.outOfStockBooks(),

    recentUser: stats.recentBorrowedUsers(5),
    recentTitle: stats.recentAddedBooks(5),
  };
}

// Export Functions
function exportTransactionsFiltered(filter) {
  switch (filter.type) {
    case "today":
      return db
        .prepare(
          `
        SELECT * FROM transactions
        WHERE DATE(borrowed_at) = DATE('now')
      `,
        )
        .all();

    case "week":
      return db
        .prepare(
          `
        SELECT * FROM transactions
        WHERE DATE(borrowed_at) >= DATE('now','-7 days')
      `,
        )
        .all();

    case "month":
      return db
        .prepare(
          `
        SELECT * FROM transactions
        WHERE strftime('%Y-%m', borrowed_at) = strftime('%Y-%m','now')
      `,
        )
        .all();

    case "last_month":
      return db
        .prepare(
          `
    SELECT * FROM transactions
    WHERE borrowed_at >= date('now','start of month','-1 month')
      AND borrowed_at < date('now','start of month')
    ORDER BY borrowed_at DESC
  `,
        )
        .all();

    case "last_quarter":
      return db
        .prepare(
          `
    SELECT * FROM transactions
    WHERE borrowed_at >= date('now','-3 months')
    ORDER BY borrowed_at DESC
  `,
        )
        .all();

    case "range":
      return db
        .prepare(
          `
        SELECT * FROM transactions
        WHERE DATE(borrowed_at) BETWEEN DATE(?) AND DATE(?)
      `,
        )
        .all(filter.from, filter.to);

    default:
      return [];
  }
}

function exportInventoryFiltered(filter) {
  if (filter.onlyAvailable) {
    return db
      .prepare(
        `
      SELECT *
      FROM books
      WHERE available_amount > 0
      AND is_deleted = 0
      ORDER BY title ASC
    `,
      )
      .all();
  }

  return db
    .prepare(
      `
    SELECT *
    FROM books
    WHERE is_deleted = 0
    ORDER BY title ASC
  `,
    )
    .all();
}

// Settings Functions
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const Database = require("better-sqlite3");

// SINGLE SOURCE OF TRUTH
const dbDir = path.join(app.getPath("userData"), "database");
const dbPath = path.join(dbDir, "pmci.db");

function getLibrarySettings() {
  return db.prepare("SELECT * FROM settings WHERE id = 1").get();
}

function getDatabaseInfo() {
  // Database path (fixed)
  const dbPath = path.join(app.getPath("userData"), "database", "pmci.db");

  // DB size
  const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : { size: 0 };
  const dbSize = (stats.size / 1024 / 1024).toFixed(4) + " MB";

  // Backup folder
  const backupDir = path.join(app.getPath("userData"), "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // List all backups with size
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
  const latestBackup = allBackups.length ? allBackups[0] : "No backups found";

  return {
    dbPath,
    dbSize,
    latestBackup,
    allBackups,
  };
}

function updateLibrarySettings(settings) {
  const stmt = db.prepare(`
    UPDATE settings
    SET library_name = @library_name,
        school_name = @school_name,
        max_books_per_borrower = @max_books_per_borrower,
        borrow_duration_days = @borrow_duration_days,
        library_logo_path = @library_logo_path
    WHERE id = 1
  `);
  stmt.run(settings);
  return true;
}

function saveLibraryLogo(filePath, fileName) {
  const destPath = path.join(logoDir, fileName);
  fs.copyFileSync(filePath, destPath);
  return destPath;
}

// Backup / Auto Backup / Drop Database / Import
function backupDatabase() {
  const backupDir = path.join(app.getPath("userData"), "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  } else {
    console.log("Created Backup Folder : ", backupDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `backup_${timestamp}.db`);

  fs.copyFileSync(dbPath, backupFile);
  return backupFile;
}

function resetDatabase() {
  try {
    // Ensure database folder exists
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const db = new Database(dbPath);

    // Drop existing tables
    db.exec(`
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS books;
    `);

    // Recreate tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        year INTEGER NOT NULL,
        book_id TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies > 0),
        available_amount INTEGER NOT NULL DEFAULT 0 CHECK (
          available_amount >= 0 AND available_amount <= total_copies
        )
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL,
        book_id TEXT NOT NULL,

        borrower_st_id TEXT NOT NULL,
        borrower_name TEXT NOT NULL,
        borrower_grade TEXT NOT NULL,
        borrower_section TEXT NOT NULL,

        copies_borrowed INTEGER NOT NULL CHECK (copies_borrowed > 0),
        copies_returned INTEGER NOT NULL DEFAULT 0,

        borrowed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        returned_at DATETIME,
        due_date DATETIME,

        FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE RESTRICT
      );
    `);

    db.close();
    return { success: true, msg: "Database has been reset successfully!" };
  } catch (err) {
    console.error("Error resetting database:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  addBook,
  editBook,
  deleteBook,
  getBooks,
  addTransaction,
  getTransactions,
  getTransactionBooks,
  editTransaction,
  returnBook,
  returnBooks,
  getReportStats,
  exportTransactionsFiltered,
  exportInventoryFiltered,

  getLibrarySettings,
  getDatabaseInfo,
  updateLibrarySettings,
  saveLibraryLogo,

  backupDatabase,
  resetDatabase,
};
