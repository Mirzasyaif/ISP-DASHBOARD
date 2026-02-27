const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // Add if needed

const openclawConfig = {
    apiKey: process.env.OPENCLAW_API_KEY,
    webhookSecret: process.env.OPENCLAW_WEBHOOK_SECRET,
    phoneNumber: process.env.OPENCLAW_PHONE_NUMBER,
    adminPhone: process.env.ADMIN_PHONE_NUMBER,
    apiUrl: process.env.OPENCLAW_API_URL || 'https://api.openclaw.io/v1'
};

function validateWebhookSignature(signature, body) {
    if (!openclawConfig.webhookSecret) {
        console.warn('[OpenClaw] Webhook secret not configured, skipping validation');
        return true;
    }
    const expectedSignature = require('crypto')
        .createHmac('sha256', openclawConfig.webhookSecret)
        .update(body)
        .digest('hex');
    return signature === expectedSignature;
}

async function analyzePaymentProof(imagePath) {
    try {
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Image file not found: ${imagePath}`);
        }
        // Use Tesseract for OCR
        const { execSync } = require('child_process');
        const text = execSync(`tesseract "${imagePath}" stdout -l ind --psm 6`, { encoding: 'utf8' }).trim();
        console.log('[Tesseract] Extracted text:', text);
        
        // Simple parsing for BCA transfer
        const amountMatch = text.match(/IDR\s*([0-9,]+)/i) || text.match(/Rp\s*([0-9,]+)/i);
        const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
        const senderMatch = text.match(/NAMA PEMENIKAH\s*(.+)/i) || text.match(/NAMA\s*(.+)/i);
        const destMatch = text.match(/REK Tujuan\s*(\d+)/i);
        
        const ocrResult = {
            amount: amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : null,
            date: dateMatch ? dateMatch[0] : null,
            senderName: senderMatch ? senderMatch[1].trim() : null,
            senderAccount: null, // Not always visible
            destinationAccount: destMatch ? destMatch[1] : null,
            bank: 'BCA', // Assume from image pattern
            reference: text.match(/No\. referensi\s*(\d+)/i)?.[1] || null
        };
        
        console.log('[OpenClaw] OCR analysis completed:', ocrResult);
        return ocrResult;
    } catch (error) {
        console.error('[OpenClaw] Error analyzing payment proof:', error.message);
        throw new Error(`OCR analysis failed: ${error.message}`);
    }
}

function validatePayment(ocrResult, paymentData) {
    const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        extractedData: {}
    };
    validation.extractedData = {
        amount: ocrResult.amount || null,
        date: ocrResult.date || null,
        senderAccount: ocrResult.senderAccount || ocrResult.account_number || null,
        senderName: ocrResult.senderName || ocrResult.account_name || null,
        destinationAccount: ocrResult.destinationAccount || ocrResult.to_account || null,
        bank: ocrResult.bank || ocrResult.bank_name || null,
        reference: ocrResult.reference || ocrResult.transaction_id || null
    };
    if (validation.extractedData.amount && paymentData.amount) {
        const transferAmount = parseFloat(validation.extractedData.amount);
        const expectedAmount = parseFloat(paymentData.amount);
        if (Math.abs(transferAmount - expectedAmount) > 1000) {
            validation.isValid = false;
            validation.errors.push(`Jumlah transfer tidak sesuai. Dikirim: Rp ${transferAmount.toLocaleString('id-ID')}, Tagihan: Rp ${expectedAmount.toLocaleString('id-ID')}`);
        }
    } else {
        validation.warnings.push('Jumlah transfer tidak dapat dibaca dari bukti transfer');
    }
    if (validation.extractedData.date) {
        const transferDate = new Date(validation.extractedData.date);
        const currentDate = new Date();
        const daysDiff = Math.floor((currentDate - transferDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
            validation.warnings.push(`Bukti transfer sudah ${daysDiff} hari. Mohon konfirmasi manual.`);
        }
    }
    const validAccounts = [
        { bank: 'BCA', number: '3330190816' },
        { bank: 'DANA', number: '085236022073' }
    ];
    const accountMatch = validAccounts.find(acc => 
        validation.extractedData.destinationAccount === acc.number || 
        validation.extractedData.bank === acc.bank
    );
    if (!accountMatch) {
        validation.warnings.push('Rekening tujuan tidak dapat diverifikasi secara otomatis');
    }
    return validation;
}

module.exports = {
    validateWebhookSignature,
    analyzePaymentProof,
    validatePayment,
    openclawConfig
};