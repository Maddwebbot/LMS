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

// --------------------
// BOOK QR CODE
// --------------------
async function generateBookQRCode(bookId) {
  try {
    const qrDir = path.join(qrBaseDir, "QRBooks");

    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const filePath = path.join(qrDir, `${bookId}.png`);

    await QRCode.toFile(filePath, bookId, {
      color: { dark: "#000000", light: "#ffffff" },
      width: 300,
    });

    // Auto-open image
    await shell.openPath(filePath);

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
