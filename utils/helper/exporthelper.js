const XLSX = require("xlsx");

// Define field types for intelligent column filtering
const inventoryFields = [
  "book_id",
  "title",
  "author",
  "category",
  "year",
  "total_copies",
  "available_amount",
  "id",
  "is_deleted",
];
const transactionFields = [
  "transaction_id",
  "book_id",
  "borrower_st_id",
  "borrower_name",
  "borrower_grade",
  "borrower_section",
  "copies_borrowed",
  "borrowed_at",
  "due_date",
  "returned_at",
  "copies_returned",
  "id",
];

// file csv / xslx helper
function exportToExcel(rows, filter, filePath) {
  const wb = XLSX.utils.book_new(); // create a new workbook

  if (filter.reportType === "combined") {
    // For combined reports, use intelligent field separation
    const invFields = filterFieldsByType(filter.fields, "inventory");
    const txnFields = filterFieldsByType(filter.fields, "transaction");

    const filterRows = (data, fields) =>
      data.map((row) => {
        const obj = {};
        fields.forEach((f) => {
          obj[f] = row[f];
        });
        return obj;
      });

    // inventory sheet
    const invSheet = XLSX.utils.json_to_sheet(
      filterRows(rows.inventory, invFields),
    );
    XLSX.utils.book_append_sheet(wb, invSheet, "Inventory");

    // transactions sheet
    const txnSheet = XLSX.utils.json_to_sheet(
      filterRows(rows.transactions, txnFields),
    );
    XLSX.utils.book_append_sheet(wb, txnSheet, "Transactions");
  } else {
    // For single report types, use all selected fields
    const filterRows = (data) =>
      data.map((row) => {
        const obj = {};
        filter.fields.forEach((f) => {
          obj[f] = row[f];
        });
        return obj;
      });

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

  // For combined reports, intelligently separate fields
  const invFields = filterFieldsByType(filter.fields, "inventory");
  const txnFields = filterFieldsByType(filter.fields, "transaction");

  let csv = "";

  csv += "BOOKS INVENTORY\n";
  csv += toCSV(filterRows(rows.inventory, invFields));
  csv += "\n\n";

  csv += "TRANSACTIONS\n";
  csv += toCSV(filterRows(rows.transactions, txnFields));

  return csv;
}

// Filter fields based on type (inventory or transaction)
function filterFieldsByType(fields, type) {
  const typeFields = type === "inventory" ? inventoryFields : transactionFields;
  return fields.filter((f) => typeFields.includes(f));
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
