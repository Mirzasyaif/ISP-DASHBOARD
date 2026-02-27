// isp-dashboard/backend/controllers/whatsappController-optimized.js
// OPTIMIZED VERSION: Direct API calls instead of child_process

const axios = require('axios');
const { generateReceiptImage } = require("../services/receiptService");
const fs = require("fs");
const path = require("path");
const whatsappState = require('../utils/whatsappState');

// OpenClaw API configuration
const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:8080';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

// Rate limiting configuration
const RATE_LIMIT = {
    maxRequests: 10,      // Max 10 requests per window
    windowMs: 60000,      // 1 minute window
    delayMs: 1000         // 1 second delay between requests
};

// Simple in-memory rate limiter
const rateLimiter = {
    requests: [],
    async wait() {
        const now = Date.now();
        // Remove old requests outside the window
        this.requests = this.requests.filter(time => now - time < RATE_LIMIT.windowMs);
        
        // If at limit, wait
        if (this.requests.length >= RATE_LIMIT.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = RATE_LIMIT.windowMs - (now - oldestRequest) + 100;
            if (waitTime > 0) {
                console.log(`[Rate Limiter] Waiting ${waitTime}ms to respect rate limit`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.delayMs));
        
        // Record this request
        this.requests.push(Date.now());
    }
};

function formatRupiah(number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(number);
}

function getUserPhone(user) {
    return user.phone_number || user.phone || null;
}

/**
 * Send WhatsApp message using OpenClaw API directly (optimized)
 * @param {string} targetPhone - Phone number with country code
 * @param {string} message - Message content
 * @returns {Promise<boolean>} Success status
 */
async function sendWhatsAppMessage(targetPhone, message) {
    try {
        // Check if WhatsApp is enabled
        if (!whatsappState.isEnabled()) {
            console.warn(`[WhatsApp SKIP] WhatsApp is DISABLED. Message not sent to ${targetPhone}`);
            return false;
        }
        
        // Apply rate limiting
        await rateLimiter.wait();
        
        console.log(`[WhatsApp API] Sending to ${targetPhone}`);
        
        // Direct API call instead of child_process
        const response = await axios.post(
            `${OPENCLAW_API_URL}/messages`,
            {
                channel: 'whatsapp',
                recipient: targetPhone,
                content: message
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENCLAW_API_KEY}`
                },
                timeout: 10000 // 10 second timeout (reduced from 30s)
            }
        );
        
        if (response.data && response.data.success) {
            console.log(`[WhatsApp SUCCESS] Message sent to ${targetPhone}`);
            return true;
        } else {
            console.warn(`[WhatsApp WARN] API returned non-success:`, response.data);
            return false;
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`[WhatsApp ERROR] Cannot connect to OpenClaw API at ${OPENCLAW_API_URL}`);
            console.error(`[WhatsApp ERROR] Make sure OpenClaw service is running`);
        } else if (error.code === 'ETIMEDOUT') {
            console.error(`[WhatsApp ERROR] Timeout connecting to OpenClaw API`);
        } else {
            console.error(`[WhatsApp ERROR] Failed to send message:`, error.message);
        }
        return false;
    }
}

/**
 * Format phone number to international format
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone) {
    let targetPhone = phone.trim();
    if (targetPhone.startsWith('0')) {
        targetPhone = '+62' + targetPhone.substring(1);
    } else if (targetPhone.startsWith('62')) {
        targetPhone = '+' + targetPhone;
    } else if (!targetPhone.startsWith('+')) {
        targetPhone = '+62' + targetPhone;
    }
    return targetPhone;
}

/**
 * Send payment confirmation
 * @param {object} user - User object
 * @param {object} paymentData - Payment data
 * @returns {Promise<boolean>} Success status
 */
async function sendPaymentConfirmation(user, paymentData) {
    const phone = getUserPhone(user);
    if (!phone) {
        console.warn(`[WhatsApp SKIP] User ${user.pppoe_username} skipped. No phone number available.`);
        return false;
    }
    
    const targetPhone = formatPhoneNumber(phone);
    const formattedAmount = formatRupiah(paymentData.amount);
    const fullName = user.full_name || user.name || user.pppoe_username;
    const monthYear = paymentData.month_year || 'periode ini';
    const paymentMethod = paymentData.payment_method || 'transfer';
    const transactionId = paymentData.transaction_id || 'N/A';
    
    const paymentDate = paymentData.paid_at || paymentData.created_at || new Date().toISOString().slice(0, 10);
    const formattedDate = new Date(paymentDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const messageText = `✅ *PEMBAYARAN BERHASIL DITERIMA*\n\nHalo *${fullName}*,\n\nPembayaran Anda telah berhasil dikonfirmasi:\n\n💰 *Jumlah:* ${formattedAmount}\n📅 *Periode:* ${monthYear}\n📅 *Tanggal Bayar:* ${formattedDate}\n\nTerima kasih atas pembayaran Anda! Layanan internet Anda tetap aktif.\n\n- Mahapta Net`;

    return await sendWhatsAppMessage(targetPhone, messageText);
}

module.exports = {
    sendPaymentConfirmation
};
