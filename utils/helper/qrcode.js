const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const { shell, app } = require("electron");

// Base Pictures directory
const picturesDir = app.getPath("pictures");

// Base QR folder
const qrBaseDir = path.join(picturesDir, "QR");

// Ensure base QR folder exists
if (!fs.existsSync(qrBaseDir)) {
  fs.mkdirSync(qrBaseDir, { recursive: true });
}

// simple helper that replaces characters invalid in file/folder names
function sanitizeFilename(name) {
  if (!name) return "";
  // strip path separators and other illegal Windows chars
  return name.replace(/[\\/:*?"<>|]/g, "-").trim();
}

// --------------------
// BOOK QR CODE
// --------------------
/**
 * Generate a QR code for a book.
 *
 * The function accepts either a string (bookId) for backwards compatibility
 * or an object containing { bookId, title, category }.
 * If a category is provided the QR image will be placed in a subfolder named
 * after the category. The file name will use the sanitized book title if
 * available, otherwise the ID itself.
 */
async function generateBookQRCode(bookIdOrObj) {
  try {
    // normalize input
    let bookId;
    let title;
    let category;
    let doOpen = true;

    if (typeof bookIdOrObj === "object" && bookIdOrObj !== null) {
      bookId = bookIdOrObj.bookId || bookIdOrObj.id || bookIdOrObj.book_id;
      title = bookIdOrObj.title;
      category = bookIdOrObj.category;
      if (bookIdOrObj.hasOwnProperty("open")) {
        doOpen = !!bookIdOrObj.open;
      }
    } else {
      bookId = bookIdOrObj;
    }

    // prepare directory structure
    let qrDir = path.join(qrBaseDir, "QRBooks");
    if (category) {
      qrDir = path.join(qrDir, sanitizeFilename(category));
    }
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // choose filename
    const fileName = title ? `${sanitizeFilename(title)}.png` : `${bookId}.png`;

    const filePath = path.join(qrDir, fileName);

    await QRCode.toFile(filePath, bookId, {
      color: { dark: "#000000", light: "#ffffff" },
      width: 300,
    });

    // Auto-open image if allowed
    if (doOpen) {
      await shell.openPath(filePath);
    }

    console.log("Book QR code generated at:", filePath);
    return filePath;
  } catch (err) {
    console.error("Book QR code generation failed:", err);
    throw err;
  }
}

// --------------------
// TRANSACTION QR CODE
// --------------------
async function generateTransactionQRCode(transactionId) {
  try {
    const qrDir = path.join(qrBaseDir, "QRTransactions");

    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const filePath = path.join(qrDir, `${transactionId}.png`);

    await QRCode.toFile(filePath, transactionId, {
      color: { dark: "#000000", light: "#ffffff" },
      width: 300,
    });

    // Auto-open image
    await shell.openPath(filePath);

    console.log("Transaction QR code generated at:", filePath);
    return filePath;
  } catch (err) {
    console.error("Transaction QR code generation failed:", err);
    throw err;
  }
}

module.exports = {
  generateBookQRCode,
  generateTransactionQRCode,
};
