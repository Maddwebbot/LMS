document.addEventListener("DOMContentLoaded", async () => {
  const settings = await window.electronAPI.getLibrarySettings();
  if (!settings) return;

  document.getElementById("maxBooks").innerHTML =
    settings.max_books_per_borrower;
  document.getElementById("borrowDays").innerHTML =
    settings.borrow_duration_days;

  const stats = await window.electronAPI.getStats();
  const summary = stats.summary;

  // =============================
  // SUMMARY CARDS
  // =============================

  function setSummary(
    id,
    value,
    zeroText,
    midText,
    highText,
    zeroColor,
    midColor,
    highColor,
    midCondition,
  ) {
    let text = "";
    let color = "";

    if (value === 0) {
      text = zeroText;
      color = zeroColor;
    } else if (midCondition(value)) {
      text = midText;
      color = midColor;
    } else {
      text = highText;
      color = highColor;
    }

    document.getElementById(id).textContent = value;
    document.getElementById(id + "Text").textContent = text;
    document.getElementById(id + "Text").style.color = color;
  }

  setSummary(
    "totalBookTitle",
    summary.totalBookTitle,
    "No collection yet!",
    "Small Collection",
    "Large Collection",
    "red",
    "orange",
    "green",
    (v) => v <= 10,
  );

  setSummary(
    "totalBorrowings",
    summary.totalBorrowingsWeekly,
    "No borrowings yet",
    "Moderate activity",
    "High activity",
    "red",
    "orange",
    "green",
    (v) => v <= 10,
  );

  setSummary(
    "activeCheckouts",
    summary.activeCheckoutsWeekly,
    "All books are available",
    "Few books were borrowed",
    "Many books are checked out, send reminders",
    "green",
    "orange",
    "red",
    (v) => v < 10,
  );

  setSummary(
    "overdueBooks",
    summary.overdueBooksWeekly,
    "No overdue",
    "Some overdue books!",
    "High overdue count, warning them will be nice",
    "green",
    "orange",
    "red",
    (v) => v < 5,
  );

  // =============================
  // MOST BORROWED CHART
  // =============================

  const topBooksLabels = stats.mostBorrowed.map((b) => b.book);
  const topBooksData = stats.mostBorrowed.map((b) => b.total);
  const topBooksColors = stats.mostBorrowed.map((b) =>
    b.status === "active" ? "#2563EB" : "#DC2626",
  );

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
        y: {
          title: { display: true, text: "Book Title" },
          ticks: {
            callback: function (value) {
              const label = this.getLabelForValue(value);
              return label.length > 25 ? label.substring(0, 25) + "..." : label;
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (tooltipItems) {
              return topBooksLabels[tooltipItems[0].dataIndex];
            },
          },
        },
      },
    },
  });

  // Manual Legend
  const legendContainer = document.getElementById("mostBorrowedLegend");
  legendContainer.innerHTML = `
    <span style="display:inline-block;width:12px;height:12px;background:#2563EB;margin-right:5px;"></span> Active
    <span style="display:inline-block;width:12px;height:12px;background:#DC2626;margin-left:15px;margin-right:5px;"></span> Archived
  `;

  // =============================
  // RECENTLY ADDED TABLE
  // =============================

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
      <td title="${b.title}">${b.title}</td>
      <td title="${b.author}">${b.author}</td>
      <td>${b.year}</td>
      <td title="${displayCategory}">${displayCategory}</td>
    `;

    addedTableBody.appendChild(row);
  });
});
