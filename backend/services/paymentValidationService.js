/**
 * Payment Validation Service
 * Service untuk validasi pembayaran dari WhatsApp
 */

const db = require('../models/db-sqlite');
const { analyzePaymentProof, validatePayment } = require('./openclawService');

/**
 * Proses bukti transfer dari WhatsApp (Simplified - No Image Download)
 * @param {Object} data - Data dari webhook OpenClaw
 * @returns {Promise<Object>} Hasil proses
 */
async function processPaymentProof(data) {
    try {
        const { phoneNumber, imageUrl, messageId } = data;
        
        // Cari user berdasarkan nomor WA
        const user = await findUserByPhone(phoneNumber);
        if (!user) {
            return {
                success: false,
                message: 'User tidak ditemukan dengan nomor WA ini'
            };
        }
        
        // Skip image download - hanya simpan info dasar
        const currentMonthYear = getCurrentMonthYear();
        
        // Simpan ke database tanpa gambar
        const proofId = await savePaymentProof({
            user_id: user.id,
            phone_number: phoneNumber,
            image_path: null, // Tidak download gambar
            ocr_result: null, // Tidak ada OCR
            validation: { isValid: true, errors: [], warnings: [] }, // Auto-validasi
            status: 'pending_approval',
            message_id: messageId,
            amount: user.monthly_fee,
            month_year: currentMonthYear
        });
        
        return {
            success: true,
            proofId,
            user,
            validation: { isValid: true, errors: [], warnings: [] },
            ocrResult: null
        };
    } catch (error) {
        console.error('[PaymentValidation] Error processing payment proof:', error);
        throw error;
    }
}

/**
 * Cari user berdasarkan nomor WA
 * @param {string} phoneNumber - Nomor WA
 * @returns {Promise<Object|null>} Data user
 */
async function findUserByPhone(phoneNumber) {
    try {
        // Normalize nomor WA
        let normalizedPhone = phoneNumber.replace(/\D/g, '');
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '62' + normalizedPhone.substring(1);
        }
        
        const query = `
            SELECT * FROM clients 
            WHERE phone_number = ? OR phone = ?
            LIMIT 1
        `;
        
        const result = await db.get(query, [normalizedPhone, normalizedPhone]);
        return result;
    } catch (error) {
        console.error('[PaymentValidation] Error finding user by phone:', error);
        return null;
    }
}

/**
 * Download gambar dari URL
 * @param {string} imageUrl - URL gambar
 * @param {string} messageId - ID pesan untuk nama file
 * @returns {Promise<string>} Path gambar yang didownload
 */
async function downloadImage(imageUrl, messageId) {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');
    
    const uploadsDir = path.join(__dirname, '../../uploads/payment_proofs');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const imagePath = path.join(uploadsDir, `${messageId}.jpg`);
    
    const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(imagePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(imagePath));
        writer.on('error', reject);
    });
}

/**
 * Simpan bukti pembayaran ke database (Simplified - No Image Required)
 * @param {Object} data - Data bukti pembayaran
 * @returns {Promise<string>} ID bukti pembayaran
 */
async function savePaymentProof(data) {
    try {
        const proofId = `PROOF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const query = `
            INSERT INTO payment_proofs (
                id, user_id, phone_number, image_path, 
                ocr_result, validation, status, message_id,
                amount, month_year, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        await db.run(query, [
            proofId,
            data.user_id,
            data.phone_number,
            data.image_path,
            JSON.stringify(data.ocr_result),
            JSON.stringify(data.validation),
            data.status,
            data.message_id,
            data.amount,
            data.month_year
        ]);
        
        return proofId;
    } catch (error) {
        console.error('[PaymentValidation] Error saving payment proof:', error);
        throw error;
    }
}

/**
 * Dapatkan bulan dan tahun saat ini
 * @returns {string} Format YYYY-MM
 */
function getCurrentMonthYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Update status bukti pembayaran
 * @param {string} proofId - ID bukti pembayaran
 * @param {string} status - Status baru
 * @param {string} approvedBy - Yang menyetujui
 * @returns {Promise<void>}
 */
async function updatePaymentProofStatus(proofId, status, approvedBy) {
    try {
        const query = `
            UPDATE payment_proofs 
            SET status = ?, approved_by = ?, updated_at = datetime('now')
            WHERE id = ?
        `;
        
        await db.run(query, [status, approvedBy, proofId]);
    } catch (error) {
        console.error('[PaymentValidation] Error updating payment proof status:', error);
        throw error;
    }
}

module.exports = {
    processPaymentProof,
    findUserByPhone,
    updatePaymentProofStatus
};
