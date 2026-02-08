const XLSX = require("xlsx");

// file csv / xslx helper
function exportToExcel(rows, filter, filePath) {
  const wb = XLSX.utils.book_new(); // create a new workbook

  // Helper to filter rows based on selected fields
  const filterRows = (data) =>
    data.map((row) => {
      const obj = {};
      filter.fields.forEach((f) => {
        obj[f] = row[f];
      });
      return obj;
    });

  if (filter.reportType === "combined") {
    // inventory sheet
    const invSheet = XLSX.utils.json_to_sheet(filterRows(rows.inventory));
    XLSX.utils.book_append_sheet(wb, invSheet, "Inventory");

    // transactions sheet
    const txnSheet = XLSX.utils.json_to_sheet(filterRows(rows.transactions));
    XLSX.utils.book_append_sheet(wb, txnSheet, "Transactions");
  } else {
    const sheet = XLSX.utils.json_to_sheet(filterRows(rows));
    const sheetName =
      filter.reportType === "inventory" ? "Inventory" : "Transactions";
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  }

  // write the workbook to a real XLSX file
  XLSX.writeFile(wb, filePath);
}

function exportToCombinedCSV(rows, filter) {
  if (filter.reportType !== "combined") {
    return toCSV(filterRows(rows, filter.fields));
  }

  let csv = "";

  csv += "BOOKS INVENTORY\n";
  csv += toCSV(filterRows(rows.inventory, filter.fields));
  csv += "\n\n";

  csv += "TRANSACTIONS\n";
  csv += toCSV(filterRows(rows.transactions, filter.fields));

  return csv;
}

function filterRows(rows, fields) {
  return rows.map((row) => {
    const obj = {};
    fields.forEach((f) => (obj[f] = row[f]));
    return obj;
  });
}

function toCSV(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(",")),
  ].join("\n");
}

module.exports = {
  exportToExcel,
  exportToCombinedCSV,
};
