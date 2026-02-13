/**
 * Utility untuk parsing harga dalam format Rupiah yang fleksibel
 */

/**
 * Parse teks menjadi angka integer Rupiah
 * Mendukung format: "150.000", "150k", "Rp150000", "150 ribu", "150rb"
 * @param {string} text - Teks yang berisi harga
 * @returns {number} - Angka integer (contoh: 150000)
 */
function parseRupiah(text) {
    if (!text || typeof text !== 'string') {
        return 0;
    }
    
    // Normalisasi teks: lowercase, hapus spasi berlebih
    let normalized = text.trim().toLowerCase();
    
    // Cek untuk format "k" atau "rb" (ribu)
    let multiplier = 1;
    if (normalized.includes('k') || normalized.includes('rb') || normalized.includes('ribu')) {
        multiplier = 1000;
        // Hapus suffix
        normalized = normalized.replace(/k$|rb$| ribu$/, '');
    }
    
    // Hapus semua karakter non-digit kecuali titik (.)
    // Tapi hati-hati: titik dalam angka Indonesia adalah pemisah ribu
    let digitsOnly = normalized.replace(/[^\d.]/g, '');
    
    // Jika ada titik, hapus semua titik (karena titik adalah pemisah ribu, bukan desimal)
    if (digitsOnly.includes('.')) {
        digitsOnly = digitsOnly.replace(/\./g, '');
    }
    
    // Konversi ke angka
    const baseValue = parseFloat(digitsOnly) || 0;
    const result = Math.round(baseValue * multiplier);
    
    return result;
}

/**
 * Format angka integer menjadi string Rupiah yang rapi
 * @param {number} amount - Jumlah uang dalam integer
 * @returns {string} - String format Rupiah (contoh: "Rp 150.000")
 */
function formatRupiah(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return 'Rp 0';
    }
    
    // Gunakan Intl.NumberFormat untuk format Indonesia
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
    
    // Hapus spasi setelah "Rp"
    return formatted.replace(/\s/g, '');
}

/**
 * Validasi input harga dari user
 * @param {string} input - Input dari user
 * @returns {object} - {valid: boolean, amount: number, message: string}
 */
function validatePriceInput(input) {
    const amount = parseRupiah(input);
    
    if (amount <= 0) {
        return {
            valid: false,
            amount: 0,
            message: 'Format harga tidak valid. Gunakan format seperti: "150.000", "150k", "Rp150000"'
        };
    }
    
    if (amount > 10000000) { // Batas atas: 10 juta
        return {
            valid: false,
            amount: amount,
            message: 'Jumlah terlalu besar. Maksimal Rp 10.000.000'
        };
    }
    
    return {
        valid: true,
        amount: amount,
        message: `✅ Jumlah yang valid: ${formatRupiah(amount)}`
    };
}

module.exports = {
    parseRupiah,
    formatRupiah,
    validatePriceInput
};