const db = require("./db");

// CHART USAGE:
// - totalBookTitle → KPI / Stat card
// - totalBorrowings → KPI / Stat card
// - activeCheckouts → KPI / Stat card
// - overdueBooks → KPI / Warning stat card
// - avgBorrowDuration → KPI or Gauge
// - insight → Textual insight (no chart)
function librarySummary() {
  // Total book titles
  const totalBookTitle = db
    .prepare("SELECT COUNT(*) AS total_titles FROM books;")
    .get().total_titles;

  // Total borrowings
  const totalBorrowings = db
    .prepare(
      `
    SELECT COUNT(DISTINCT transaction_id) AS total 
    FROM transactions
  `,
    )
    .get().total;

  const totalBorrowingsWeekly = db
    .prepare(
      `
    SELECT COUNT(DISTINCT transaction_id) AS total
    FROM transactions
    WHERE borrowed_at >= date('now', '-7 days')
  `,
    )
    .get().total;

  // Active checkouts (not returned yet)
  const activeCheckouts = db
    .prepare(
      `SELECT COUNT(*) AS total FROM transactions WHERE returned_at IS NULL`,
    )
    .get().total;

  const activeCheckoutsWeekly = db
    .prepare(
      `
    SELECT COUNT(*) AS total
    FROM transactions
    WHERE returned_at IS NULL
      AND borrowed_at >= date('now', '-7 days')
  `,
    )
    .get().total;

  // Overdue books
  const overdueBooks = db
    .prepare(
      `
    SELECT COUNT(*) AS total
    FROM transactions
    WHERE returned_at IS NULL AND due_date < CURRENT_TIMESTAMP
  `,
    )
    .get().total;

  const overdueBooksWeekly = db
    .prepare(
      `
    SELECT COUNT(*) AS total
    FROM transactions
    WHERE returned_at IS NULL
      AND due_date < CURRENT_TIMESTAMP
      AND borrowed_at >= date('now', '-7 days')
  `,
    )
    .get().total;

  // Average borrow duration (in days) for returned books
  const avgDurationRow = db
    .prepare(
      `
    SELECT AVG(JULIANDAY(returned_at) - JULIANDAY(borrowed_at)) AS avg_days
    FROM transactions
    WHERE returned_at IS NOT NULL
  `,
    )
    .get();

  const avgBorrowDuration = avgDurationRow.avg_days
    ? Number(avgDurationRow.avg_days.toFixed(1))
    : 0;

  // Insight: consistency
  // If avgBorrowDuration < 7 → books returned quickly
  // 7-14 → normal
  // >14 → slow returns
  let insight = "";
  if (avgBorrowDuration === 0) {
    insight = "No completed borrowings yet.";
  } else if (avgBorrowDuration < 7) {
    insight = "Borrowers return books quickly. ✅ Consistent usage.";
  } else if (avgBorrowDuration <= 14) {
    insight = "Borrow durations are moderate. ⏱️";
  } else {
    insight = "Borrow durations are long. ⚠️ May need reminders.";
  }

  return {
    totalBookTitle,
    totalBorrowings,
    totalBorrowingsWeekly,
    activeCheckouts,
    activeCheckoutsWeekly,
    overdueBooks,
    overdueBooksWeekly,
    avgBorrowDuration,
    insight,
  };
}

// BEST CHARTS:
// - Bar Chart (Category vs Total Books) ✅
// - Pie Chart (Category distribution)
function booksPerCategory() {
  return db
    .prepare(
      `
    SELECT category, COUNT(*) AS total
    FROM books
    WHERE is_deleted = 0
    GROUP BY category
  `,
    )
    .all();
}

// BEST CHARTS:
// - Donut / Pie Chart (Available vs Borrowed)
// - Stacked Bar (Total vs Available)
function availabilityStats() {
  return db
    .prepare(
      `
    SELECT 
      SUM(total_copies) AS total,
      SUM(available_amount) AS available
    FROM books
    WHERE is_deleted = 0

  `,
    )
    .get();
}

// BEST CHARTS:
// - Line Chart (Date vs Books Borrowed) ✅
// - Area Chart (borrowing volume over time)
function borrowedTrend() {
  return db
    .prepare(
      `
    SELECT DATE(borrowed_at) AS date, SUM(COALESCE(copies_borrowed,0)) AS total
    FROM transactions
    WHERE borrowed_at IS NOT NULL
    GROUP BY DATE(borrowed_at)
    ORDER BY DATE(borrowed_at) ASC
  `,
    )
    .all();
}

// BEST CHARTS:
// - Horizontal Bar Chart (Top books ranking) ✅
// - Column Chart
function mostBorrowedBooks(limit = 5) {
  return db
    .prepare(
      `
    SELECT 
      b.title AS book,
      SUM(t.copies_borrowed) AS total,
      b.is_deleted AS status
    FROM transactions t
    JOIN books b ON t.book_id = b.book_id
    GROUP BY t.book_id
    ORDER BY total DESC
    LIMIT ?
  `,
    )
    .all([limit])
    .map((row) => ({
      book: row.book,
      total: row.total,
      status: row.status === 0 ? "active" : "archived", // convert 0/1 to text
    }));
}

/* ================================
   ADDITIONAL ANALYTICS (SAFE TO ADD)
   These do NOT modify existing logic
================================ */

/**
 * Purpose:
 * Shows how many books are currently borrowed vs returned
 * Useful for dashboard pie charts
 */
// BEST CHARTS:
// - Pie Chart (Borrowed vs Returned) ✅
// - Donut Chart

function checkoutStatusBreakdown() {
  return db
    .prepare(
      `
      SELECT 
        CASE 
          WHEN returned_at IS NULL THEN 'Borrowed'
          ELSE 'Returned'
        END AS status,
        COUNT(*) AS total
      FROM transactions
      GROUP BY status
    `,
    )
    .all();
}

/**
 * Purpose:
 * Identifies students who borrow the most
 * Helps detect power users or possible abuse
 */
// BEST CHARTS:
// - Horizontal Bar Chart (Top borrowers by volume) ✅
// - Table with ranking

function topBorrowers(limit = 5) {
  return db
    .prepare(
      `
      SELECT 
        borrower_name,
        borrower_st_id,
        COUNT(*) AS total_transactions,
        SUM(copies_borrowed) AS total_books
      FROM transactions
      GROUP BY borrower_st_id
      ORDER BY total_books DESC
      LIMIT ?
    `,
    )
    .all([limit]);
}

/**
 * Purpose:
 * Shows overdue trends per day
 * Useful for admin monitoring and reminders
 */
// BEST CHARTS:
// - Line Chart (Overdue count over time) ✅
// - Area Chart (risk growth visualization)

function overdueTrend() {
  return db
    .prepare(
      `
      SELECT 
        DATE(due_date) AS date,
        COUNT(*) AS total
      FROM transactions
      WHERE returned_at IS NULL
        AND due_date < CURRENT_TIMESTAMP
      GROUP BY DATE(due_date)
      ORDER BY DATE(due_date)
    `,
    )
    .all();
}

/**
 * Purpose:
 * Finds books that are rarely or never borrowed
 * Useful for weeding or acquisition decisions
 */
// BEST CHARTS:
// - Horizontal Bar Chart (Least used books) ✅
// - Table (for decision making)

function leastBorrowedBooks(limit = 5) {
  return db
    .prepare(
      `
      SELECT 
        b.title,
        COALESCE(SUM(t.copies_borrowed), 0) AS total
      FROM books b
      LEFT JOIN transactions t ON b.book_id = t.book_id
      GROUP BY b.book_id
      ORDER BY total ASC
      LIMIT ?
    `,
    )
    .all([limit]);
}

/**
 * Purpose:
 * Calculates borrowing frequency by grade level
 * Useful for academic planning
 */
// BEST CHARTS:
// - Grouped Bar Chart (Grade vs Total Books) ✅
// - Column Chart

function borrowingByGrade() {
  return db
    .prepare(
      `
      SELECT 
        borrower_grade AS grade,
        COUNT(*) AS total_transactions,
        SUM(copies_borrowed) AS total_books
      FROM transactions
      GROUP BY borrower_grade
      ORDER BY borrower_grade
    `,
    )
    .all();
}

/**
 * Purpose:
 * Measures return compliance (on-time vs late)
 * Can be shown as compliance percentage
 */
// BEST CHARTS:
// - Pie Chart (On-time vs Late returns) ✅
// - Donut Chart
// - Percentage Gauge

function returnComplianceStats() {
  return db
    .prepare(
      `
      SELECT
        SUM(
          CASE 
            WHEN returned_at IS NOT NULL 
             AND returned_at <= due_date THEN 1
            ELSE 0
          END
        ) AS on_time,
        SUM(
          CASE 
            WHEN returned_at IS NOT NULL 
             AND returned_at > due_date THEN 1
            ELSE 0
          END
        ) AS late
      FROM transactions
    `,
    )
    .get();
}

/**
 * Purpose:
 * Calculates library utilization rate
 * Shows how much of the collection is in use
 */
// BEST CHARTS:
// - Gauge Chart (Utilization %) ✅
// - Single KPI card with progress bar

function utilizationRate() {
  return db
    .prepare(
      `
      SELECT
        ROUND(
          (SUM(total_copies) - SUM(available_amount)) * 100.0 
          / SUM(total_copies),
          2
        ) AS utilization_percentage
      FROM books
    `,
    )
    .get();
}

/**
 * Purpose:
 * Finds peak borrowing days
 * Useful for staffing or scheduling
 */
// BEST CHARTS:
// - Bar Chart (Weekday vs Borrow count) ✅
// - Heatmap (if combined with time)

function peakBorrowDays(limit = 5) {
  return db
    .prepare(
      `
      SELECT 
        STRFTIME('%w', borrowed_at) AS weekday,
        COUNT(*) AS total
      FROM transactions
      GROUP BY weekday
      ORDER BY total DESC
      LIMIT ?
    `,
    )
    .all([limit]);
}

/**
 * Purpose:
 * Detects books with zero availability
 * Useful for alerts and acquisition planning
 */
// BEST CHARTS:
// - Table (Title | Copies | Status) ✅
// - Alert list (critical inventory)
function outOfStockBooks() {
  return db
    .prepare(
      `
      SELECT 
        title,
        total_copies,
        available_amount
      FROM books
      WHERE available_amount = 0
      AND is_deleted = 0
    `,
    )
    .all();
}

/* ================================
   RECENT ACTIVITY ANALYTICS
   Safe to add without breaking existing logic
================================ */

/**
 * Purpose:
 * Fetch the most recent borrowings
 * Useful for dashboard / admin overview
 */
// BEST DISPLAY:
// - Table (Borrower | Book | Borrowed At) ✅
// - Optional: Bar Chart by borrower for volume
function recentBorrowedUsers(limit = 5) {
  return db
    .prepare(
      `
      SELECT 
        t.borrower_name,
        b.title AS book_title,
        t.borrowed_at
      FROM transactions t
      JOIN books b ON t.book_id = b.book_id
      ORDER BY t.borrowed_at DESC
      LIMIT ?
    `,
    )
    .all([limit]);
}

/**
 * Purpose:
 * Fetch the most recently added books
 * Useful for library updates / dashboard
 */
// BEST DISPLAY:
// - Table (Title | Author | Year | Category) ✅
// - Optional: Bar chart by category for recent additions
function recentAddedBooks(limit = 5) {
  return db
    .prepare(
      `
      SELECT 
        title,
        author,
        year,
        category,
        is_deleted
      FROM books
      ORDER BY id DESC
      LIMIT ?
    `,
    )
    .all([limit])
    .map((b) => ({
      ...b,
      status: b.is_deleted === 0 ? "active" : "archived", // convert to text
    }));
}

module.exports = {
  booksPerCategory,
  availabilityStats,
  borrowedTrend,
  mostBorrowedBooks,
  librarySummary,

  // Added analytics
  checkoutStatusBreakdown,
  topBorrowers,
  overdueTrend,
  leastBorrowedBooks,
  borrowingByGrade,
  returnComplianceStats,
  utilizationRate,
  peakBorrowDays,
  outOfStockBooks,

  // Recent activity
  recentBorrowedUsers,
  recentAddedBooks,
};
