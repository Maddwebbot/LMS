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
  "transaction_status",
  "id",
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatExportDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return dateValue;
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeExportRow(row) {
  return {
    ...row,
    borrowed_at: formatExportDate(row.borrowed_at),
    due_date: formatExportDate(row.due_date),
    returned_at: formatExportDate(row.returned_at),
  };
}

function computeTransactionStatus(row) {
  // Priority: returned_at means returned
  if (row.returned_at && String(row.returned_at).trim() !== "") {
    return "Returned";
  }

  const borrowedTotal = Number(row.copies_borrowed ?? 0);
  const returnedTotal = Number(row.copies_returned ?? 0);
  if (borrowedTotal > 0 && returnedTotal >= borrowedTotal) {
    return "Returned";
  }

  const dueDate = row.due_date ? new Date(row.due_date) : null;
  if (dueDate instanceof Date && !Number.isNaN(dueDate.getTime())) {
    const now = new Date();
    if (now > dueDate) {
      return "Overdue";
    }
  }

  return "Active";
}

function withTransactionStatus(row) {
  const status = computeTransactionStatus(row);
  return {
    ...normalizeExportRow(row),
    transaction_status: status,
  };
}

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
        const r = withTransactionStatus(row);
        fields.forEach((f) => {
          obj[f] = r[f];
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
        const r =
          filter.reportType === "transactions"
            ? withTransactionStatus(row)
            : row;
        filter.fields.forEach((f) => {
          obj[f] = r[f];
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
    const data =
      filter.reportType === "transactions"
        ? rows.map(withTransactionStatus)
        : rows;
    return toCSV(filterRows(data, filter.fields));
  }

  // For combined reports, intelligently separate fields
  const invFields = filterFieldsByType(filter.fields, "inventory");
  const txnFields = filterFieldsByType(filter.fields, "transaction");

  let csv = "";

  csv += "BOOKS INVENTORY\n";
  csv += toCSV(filterRows(rows.inventory, invFields));
  csv += "\n\n";

  csv += "TRANSACTIONS\n";
  csv += toCSV(
    filterRows(rows.transactions.map(withTransactionStatus), txnFields),
  );

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
    const r = row.transaction_status ? row : withTransactionStatus(row);
    fields.forEach((f) => {
      obj[f] = r[f];
    });
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
