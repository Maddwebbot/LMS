const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// 1️⃣ Base userData path
const userDataDir = app.getPath("userData");

// 2️⃣ Database folder inside userData
const dbDir = path.join(userDataDir, "database");
const dbPath = path.join(dbDir, "pmci.db");

// 3️⃣ If database folder does NOT exist → create it
// If it EXISTS → remove existing DB (RESET)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("Created database directory:", dbDir);
}

console.log("Using database at:", dbPath);

// 4️⃣ Open DB (creates fresh file)
const db = new Database(dbPath);

// 5️⃣ Create tables
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
`);

db.exec(`
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

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  library_name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  max_books_per_borrower INTEGER NOT NULL,
  borrow_duration_days INTEGER NOT NULL,
  library_logo_path TEXT
);
`);

db.exec(`
INSERT OR IGNORE INTO settings 
  (id, library_name, school_name, max_books_per_borrower, borrow_duration_days, library_logo_path) 
VALUES (1, 'School Library', 'School Name', 5, 7, NULL);
`);

module.exports = db;
