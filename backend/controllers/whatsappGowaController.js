const axios = require('axios');

// GOWA Configuration
const GOWA_API_URL = process.env.GOWA_API_URL || 'http://localhost:3000';
const GOWA_SESSION_NAME = process.env.GOWA_SESSION_NAME || 'Isp';
const GOWA_DEVICE_ID = process.env.GOWA_DEVICE_ID || 'Isp';
const GOWA_USERNAME = process.env.GOWA_USERNAME || '';
const GOWA_PASSWORD = process.env.GOWA_PASSWORD || '';

/**
 * Send WhatsApp message using GOWA API
 * @param {string} targetPhone - Phone number with country code (e.g., +628123456789)
 * @param {string} message - Message content
 * @returns {Promise<boolean>} Success status
 */
async function sendWhatsAppMessage(targetPhone, message) {
    try {
        console.log(`[GOWA API] Sending to ${targetPhone}`);
        
        const headers = {
            'Content-Type': 'application/json',
            'X-Device-Id': GOWA_DEVICE_ID
        };
        
        // Add Basic Auth if credentials are provided
        if (GOWA_USERNAME && GOWA_PASSWORD) {
            const auth = Buffer.from(`${GOWA_USERNAME}:${GOWA_PASSWORD}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }
        
        const response = await axios.post(
            `${GOWA_API_URL}/send/message`,
            {
                phone: targetPhone.replace('+', '') + '@s.whatsapp.net',
                message: message
            },
            { headers, timeout: 10000 }
        );
        
        if (response.data && response.data.code === 'SUCCESS') {
            console.log(`[GOWA SUCCESS] Message sent to ${targetPhone}`);
            console.log(`[GOWA SUCCESS] Message ID: ${response.data.results?.message_id}`);
            return true;
        } else {
            console.warn(`[GOWA WARN] API returned non-success:`, response.data);
            return false;
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`[GOWA ERROR] Cannot connect to GOWA API at ${GOWA_API_URL}`);
            console.error(`[GOWA ERROR] Make sure GOWA service is running`);
        } else if (error.code === 'ETIMEDOUT') {
            console.error(`[GOWA ERROR] Timeout connecting to GOWA API`);
        } else {
            console.error(`[GOWA ERROR] Failed to send message:`, error.message);
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
 * Send billing notification (H-3, H-0, D+1)
 * @param {object} user - User object
 * @param {string} status - Notification status (H-3, H-0, D+1)
 * @returns {Promise<boolean>} Success status
 */
async function sendBillingNotification(user, status) {
    const phone = getUserPhone(user);
    if (!phone) {
        console.warn(`[WhatsApp SKIP] User ${user.pppoe_username} skipped. No phone number available.`);
        return false;
    }
    
    const targetPhone = formatPhoneNumber(phone);
    const formattedFee = formatRupiah(user.monthly_fee);
    const fullName = user.full_name || user.name || user.pppoe_username;
    const dueDate = user.due_date || 'tanggal belum ditetapkan';
    
    let subject;
    let messageText;

    switch (status) {
        case 'H-3':
            subject = '⚠️ PENGINGAT TAGIHAN: 3 Hari Lagi';
            messageText = `*${subject}*\n\nHalo *${fullName}*,\n\nIni adalah pengingat bahwa tagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}* akan jatuh tempo dalam *3 hari* (pada tanggal *${dueDate}*).\n\nMohon segera lakukan pembayaran untuk menghindari pemutusan layanan.\n\n💳 *Metode Pembayaran:*\n• Rek BCA: 3330190816 a.n. Mirza Maulana\n• Dana: 085236022073\n\nAbaikan pesan ini jika sudah melakukan pembayaran. Terima kasih atas kerjasama Anda!`;
            break;
        case 'H-0':
            subject = '🔔 JATUH TEMPO: Hari Ini';
            messageText = `*${subject}*\n\nHalo *${fullName}*,\n\nHari ini adalah tanggal jatuh tempo tagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}*\n\nPembayaran diharapkan diterima hari ini.\n\n💳 *Metode Pembayaran:*\n• Rek BCA: 3330190816 a.n. Mirza Maulana\n• Dana: 085236022073\n\nAbaikan pesan ini jika sudah melakukan pembayaran. Terima kasih!`;
            break;
        case 'D+1':
            subject = '🚨 TAGIHAN TERLAMBAT';
            messageText = `*${subject}*\n\nHalo *${fullName}*,\n\nTagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}* telah *melewati jatuh tempo* (*${dueDate}*).\n\nMohon segera lakukan pembayaran. Jika layanan Anda terputus, pembayaran harus diverifikasi untuk mengaktifkannya kembali.\n\n💳 *Metode Pembayaran:*\n• Rek BCA: 3330190816 a.n. Mirza Maulana\n• Dana: 085236022073\n\nAbaikan pesan ini jika sudah melakukan pembayaran. Terima kasih!`;
            break;
        default:
            console.error(`[WhatsApp ERROR] Unknown notification status: ${status}`);
            return false;
    }

    return await sendWhatsAppMessage(targetPhone, messageText);
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
    sendWhatsAppMessage,
    sendBillingNotification,
    sendPaymentConfirmation
};
