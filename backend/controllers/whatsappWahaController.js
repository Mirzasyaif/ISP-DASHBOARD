const axios = require('axios');

// WAHA Configuration
const WAHA_API_URL = process.env.WAHA_API_URL || 'http://localhost:3000';
const WAHA_SESSION_NAME = process.env.WAHA_SESSION_NAME || 'isp-dashboard';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';

/**
 * Send WhatsApp message using WAHA API
 * @param {string} targetPhone - Phone number with country code (e.g., +628123456789)
 * @param {string} message - Message content
 * @returns {Promise<boolean>} Success status
 */
async function sendWhatsAppMessage(targetPhone, message) {
    try {
        console.log(`[WAHA API] Sending to ${targetPhone}`);
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add API key if configured
        if (WAHA_API_KEY) {
            headers['X-Api-Key'] = WAHA_API_KEY;
        }
        
        const response = await axios.post(
            `${WAHA_API_URL}/api/sendText`,
            {
                session: WAHA_SESSION_NAME,
                chatId: targetPhone,
                text: message
            },
            { headers, timeout: 10000 }
        );
        
        if (response.data && response.data.success) {
            console.log(`[WAHA SUCCESS] Message sent to ${targetPhone}`);
            return true;
        } else {
            console.warn(`[WAHA WARN] API returned non-success:`, response.data);
            return false;
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`[WAHA ERROR] Cannot connect to WAHA API at ${WAHA_API_URL}`);
            console.error(`[WAHA ERROR] Make sure WAHA service is running`);
        } else if (error.code === 'ETIMEDOUT') {
            console.error(`[WAHA ERROR] Timeout connecting to WAHA API`);
        } else {
            console.error(`[WAHA ERROR] Failed to send message:`, error.message);
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

function getUserPhone(user) {
    return user.phone_number || user.phone || null;
}

function formatRupiah(number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(number);
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
