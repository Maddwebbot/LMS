const XLSX = require("xlsx");
const crypto = require("crypto");
const db = require("../db"); // adjust path if needed

function generateBookId() {
  return `B${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function importBooksBulkWithDuplicates(books) {
  const insert = db.prepare(`
    INSERT INTO books (
      title, author, year, book_id, category,
      total_copies, available_amount
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const checkDuplicate = db.prepare(`
    SELECT id FROM books
    WHERE title = ?
      AND author = ?
      AND year = ?
      AND is_deleted = 0
  `);

  let inserted = 0;
  let duplicates = 0;

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      const exists = checkDuplicate.get(row.title, row.author, row.year);

      if (exists) {
        duplicates++;
        continue;
      }

      const book_id = generateBookId();

      insert.run(
        row.title,
        row.author,
        row.year,
        book_id,
        row.category,
        row.total_copies,
        row.total_copies,
      );

      inserted++;
    }
  });

  transaction(books);

  return { inserted, duplicates };
}

function importBooksFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const books = rows
    .map((row) => ({
      title: row.title?.trim(),
      author: row.author?.trim(),
      year: Number(row.year),
      category: row.category?.trim(),
      total_copies: Number(row.total_copies) || 1,
    }))
    .filter(
      (b) => b.title && b.author && b.year && b.category && b.total_copies > 0,
    );

  return importBooksBulkWithDuplicates(books);
}

module.exports = {
  importBooksFromExcel,
};
