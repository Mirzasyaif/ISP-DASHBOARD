// isp-dashboard/backend/services/receiptService.js
// Service untuk generate struk pembayaran dalam bentuk gambar

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(number);
}

function formatDateIndo(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function generateInvoiceNumber(monthYear) {
  const [year, month] = monthYear.split("-");
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}${month}-${randomNum}`;
}

async function generateReceiptImage(data) {
  const { customerName, username, amount, monthYear, paymentDate, invoiceNumber } = data;
  const width = 400;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  ctx.fillStyle = '#2563EB';
  ctx.fillRect(20, 20, width - 40, 80);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MAHAPTA NET', width / 2, 60);

  ctx.font = '14px Arial';
  ctx.fillText('Internet Service Provider', width / 2, 85);

  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 120);
  ctx.lineTo(width - 30, 120);
  ctx.stroke();

  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('BUKTI PEMBAYARAN', width / 2, 150);

  ctx.fillStyle = '#6B7280';
  ctx.font = '12px Arial';
  ctx.fillText(invoiceNumber, width / 2, 170);

  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 185);
  ctx.lineTo(width - 30, 185);
  ctx.stroke();

  let yPos = 220;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Nama Pelanggan:', 40, yPos);
  ctx.fillStyle = '#1F2937';
  ctx.font = '14px Arial';
  ctx.fillText(customerName, 40, yPos + 20);

  yPos += 50;
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Username:', 40, yPos);
  ctx.fillStyle = '#1F2937';
  ctx.font = '14px Arial';
  ctx.fillText(username, 40, yPos + 20);

  yPos += 50;
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Periode Bayar:', 40, yPos);
  ctx.fillStyle = '#1F2937';
  ctx.font = '14px Arial';
  ctx.fillText(monthYear, 40, yPos + 20);

  yPos += 50;
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Tanggal Bayar:', 40, yPos);
  ctx.fillStyle = '#1F2937';
  ctx.font = '14px Arial';
  ctx.fillText(formatDateIndo(paymentDate), 40, yPos + 20);

  yPos += 50;
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Jumlah:', 40, yPos);
  ctx.fillStyle = '#2563EB';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(formatRupiah(amount), 40, yPos + 25);

  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 520);
  ctx.lineTo(width - 30, 520);
  ctx.stroke();

  ctx.fillStyle = '#6B7280';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Terima kasih atas pembayaran Anda!', width / 2, 545);
  ctx.fillText('Layanan internet Anda tetap aktif.', width / 2, 565);

  return canvas.toBuffer('image/png');
}

module.exports = {
  formatRupiah,
  formatDateIndo,
  generateInvoiceNumber,
  generateReceiptImage
};
