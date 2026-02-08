document.addEventListener("DOMContentLoaded", async () => {
  const settings = await window.electronAPI.getLibrarySettings();
  if (!settings) return;

  document.getElementById("maxBooks").innerHTML =
    settings.max_books_per_borrower;
  document.getElementById("borrowDays").innerHTML =
    settings.borrow_duration_days;

  const stats = await window.electronAPI.getStats();
  const summary = stats.summary;

  // Total titled book collection
  let totalBookTitleText = "";
  let totalBookTitleColor = "";
  const totalBookTitle = summary.totalBookTitle;

  if (totalBookTitle === 0) {
    totalBookTitleText = "No collection yet!";
    totalBookTitleColor = "red";
  } else if (totalBookTitle > 10) {
    totalBookTitleText = "Large Collection";
    totalBookTitleColor = "green";
  } else {
    totalBookTitleText = "Small Collection";
    totalBookTitleColor = "orange";
  }

  document.getElementById("totalBookTitle").textContent = totalBookTitle;
  document.getElementById("totalBookTitleText").textContent =
    totalBookTitleText;
  document.getElementById("totalBookTitleText").style.color =
    totalBookTitleColor;

  // Total Borrowings
  let totalBorrowingsText = "";
  let totalBorrowingsColor = "";
  const totalBorrowings = summary.totalBorrowingsWeekly;

  if (totalBorrowings === 0) {
    totalBorrowingsText = "No borrowings yet";
    totalBorrowingsColor = "red";
  } else if (totalBorrowings > 10) {
    totalBorrowingsText = "High activity";
    totalBorrowingsColor = "green";
  } else {
    totalBorrowingsText = "Moderate activity";
    totalBorrowingsColor = "orange";
  }

  document.getElementById("totalBorrowings").textContent = totalBorrowings;
  document.getElementById("totalBorrowingsText").textContent =
    totalBorrowingsText;
  document.getElementById("totalBorrowingsText").style.color =
    totalBorrowingsColor;

  // Active Checkouts
  let activeCheckoutsText = "";
  let activeCheckoutsColor = "";
  const activeCheckouts = summary.activeCheckoutsWeekly;

  if (activeCheckouts === 0) {
    activeCheckoutsText = "All books are available";
    activeCheckoutsColor = "green";
  } else if (activeCheckouts < 10) {
    activeCheckoutsText = "Few books were borrowed";
    activeCheckoutsColor = "orange";
  } else {
    activeCheckoutsText = "Many books are checked out, send out reminders";
    activeCheckoutsColor = "red";
  }

  document.getElementById("activeCheckouts").textContent = activeCheckouts;
  document.getElementById("activeCheckoutsText").textContent =
    activeCheckoutsText;
  document.getElementById("activeCheckoutsText").style.color =
    activeCheckoutsColor;

  // Overdue Books
  let overdueBooksText = "";
  let overdueBooksColor = "";
  const overdueBooks = summary.overdueBooksWeekly;

  if (overdueBooks === 0) {
    overdueBooksText = "No overdue";
    overdueBooksColor = "green";
  } else if (overdueBooks < 5) {
    overdueBooksText = "Some overdue books!";
    overdueBooksColor = "orange";
  } else {
    overdueBooksText = "High overdue count, warning them will be nice";
    overdueBooksColor = "red";
  }

  document.getElementById("overdueBooks").textContent = overdueBooks;
  document.getElementById("overdueBooksText").textContent = overdueBooksText;
  document.getElementById("overdueBooksText").style.color = overdueBooksColor;

  // -----------------------------
  // Charts
  // -----------------------------

  // -----------------------------
  // Most Borrowed Books (Horizontal Bar)
  // -----------------------------
  // Existing chart data
  const topBooksLabels = stats.mostBorrowed.map((b) => b.book);
  const topBooksData = stats.mostBorrowed.map((b) => b.total);
  const topBooksColors = stats.mostBorrowed.map((b) =>
    b.status === "active" ? "#2563EB" : "#DC2626",
  );

  // Create the chart
  new Chart(document.getElementById("mostBorrowedBooks"), {
    type: "bar",
    data: {
      labels: topBooksLabels,
      datasets: [
        {
          label: "Times Borrowed",
          data: topBooksData,
          backgroundColor: topBooksColors,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Times Borrowed" },
        },
        y: { title: { display: true, text: "Book Title" } },
      },
      plugins: { legend: { display: false } }, // hide default legend
    },
  });

  // Manual legend
  const legendContainer = document.getElementById("mostBorrowedLegend");
  legendContainer.innerHTML = `
  <span style="display:inline-block;width:12px;height:12px;background:#2563EB;margin-right:5px;"></span> Active
  <span style="display:inline-block;width:12px;height:12px;background:#DC2626;margin-left:15px;margin-right:5px;"></span> Archived
`;

  // -----------------------------
  // Table
  // -----------------------------

  // -----------------------------
  // Recently Added Books Table
  // -----------------------------
  const recentAddedBooks = stats.recentTitle || [];
  const addedTableBody = document.getElementById("recentAddedBooks");
  addedTableBody.innerHTML = "";

  recentAddedBooks.forEach((b) => {
    let displayCategory = b.category;
    if (displayCategory === "Araling Panlipunan") displayCategory = "AP";
    if (displayCategory === "Technology and Livelihood Education")
      displayCategory = "TLE";

    const row = document.createElement("tr");

    if (b.is_deleted === 1) {
      row.classList.add("archived");
    }

    row.innerHTML = `
    <td>${b.title}</td>
    <td>${b.author}</td>
    <td>${b.year}</td>
    <td>${displayCategory}</td>
  `;

    addedTableBody.appendChild(row);
  });
});
