document.addEventListener("DOMContentLoaded", async () => {
  const stats = await window.electronAPI.getStats();
  const summary = stats.summary;

  // -----------------------------
  // 1️⃣ Total Borrowings
  // -----------------------------
  let totalBorrowingsText = "";
  let totalBorrowingsColor = "";
  const totalBorrowings = summary.totalBorrowings;

  if (totalBorrowings === 0) {
    totalBorrowingsText = "No transaction detected";
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

  // -----------------------------
  // 2️⃣ Active Checkouts
  // -----------------------------
  let activeCheckoutsText = "";
  let activeCheckoutsColor = "";
  const activeCheckouts = summary.activeCheckouts;

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
  summary.activeCheckouts;
  document.getElementById("activeCheckoutsText").textContent =
    summary.activeCheckouts === 0
      ? "All books are available 📚"
      : summary.activeCheckouts < 10
        ? "Few books currently borrowed"
        : "Many books are checked out";

  // -----------------------------
  // 3️⃣ Overdue Books
  // -----------------------------
  let overdueBooksText = "";
  let overdueBooksColor = "";
  const overdueBooks = summary.overdueBooks;

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
  // 4️⃣ Avg Borrow Duration
  // -----------------------------
  const avg = summary.avgBorrowDuration; // NUMBER

  let avgBorrowDurationText = "";
  let avgBorrowDurationColor = "";

  // Logic (numbers only)
  if (avg <= 0) {
    avgBorrowDurationText = "Books returned quickly ✅";
    avgBorrowDurationColor = "green";
  } else if (avg <= 5) {
    avgBorrowDurationText = "Borrow durations normal ⏱️";
    avgBorrowDurationColor = "orange";
  } else {
    avgBorrowDurationText = "Long borrow durations ⚠️";
    avgBorrowDurationColor = "red";
  }

  // Output
  document.getElementById("avgBorrowDuration").textContent = `${avg} days`;
  document.getElementById("avgBorrowDurationText").textContent =
    avgBorrowDurationText;
  document.getElementById("avgBorrowDurationText").style.color =
    avgBorrowDurationColor;

  // -----------------------------
  // Charts (optional)
  // -----------------------------

  // -----------------------------
  // Borrowing per Category (Bar)
  // -----------------------------
  const catLabels = stats.booksPerCategory.map((c) => {
    if (c.category === "Technology and Livelihood Education") return "TLE";
    if (c.category === "Araling Panlipunan") return "AP";
    return c.category;
  });

  const catTotals = stats.booksPerCategory.map((c) => c.total);

  new Chart(document.getElementById("categoryBar"), {
    type: "bar", // changed from "radar" to "bar"
    data: {
      labels: catLabels,
      datasets: [
        {
          label: "Books per Category",
          data: catTotals,
          backgroundColor: "#2563EB",
          borderColor: "#fff",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          title: {
            display: true,
            text: "CATEGORY",
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "NUMBER OF BOOKS",
          },
          ticks: {
            precision: 0, // show integers only
          },
        },
      },
      plugins: {
        legend: { display: true }, // optional, hide legend since label is clear
      },
    },
  });

  // -----------------------------
  // Availability (Dougnut)
  // -----------------------------
  const available = stats.availability.available;
  const borrowed = stats.availability.total - available;

  new Chart(document.getElementById("availabilityDoughnut"), {
    type: "doughnut",
    data: {
      labels: ["Available", "Unavailable"],
      datasets: [
        {
          data: [available, borrowed],
          backgroundColor: ["#2563EB", "#ee2525"],
        },
      ],
    },
    options: { responsive: false },
  });

  // -----------------------------
  // Overdue / Active / Returned (Dougnut)
  // -----------------------------
  const overdue = summary.overdueBooks;
  const active = Math.max((summary.activeCheckouts || 0) - overdue, 0);
  const returned = Math.max(
    (summary.totalBorrowings || 0) - (summary.activeCheckouts || 0),
    0,
  );

  new Chart(document.getElementById("overdueDoughnut"), {
    type: "doughnut",
    data: {
      labels: ["Active", "Overdue", "Returned"],
      datasets: [
        {
          data: [active, overdue, returned],
          backgroundColor: ["#2563EB", "#DC2626", "#22c55e"],
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });

  // -----------------------------
  // OutofStack (Bar)
  // -----------------------------
  const labels = stats.outofStack.map((b) => b.title);
  const data = stats.outofStack.map((b) => b.total_copies);

  new Chart(document.getElementById("outOfStockBar"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Copies (Out of Stock)",
          data,
          backgroundColor: "#DC2626",
        },
      ],
    },
    options: {
      responsive: false,
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });
});
