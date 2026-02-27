const express = require("express");
const router = express.Router();
const { validateWebhookSignature, openclawConfig } = require("../services/openclawService");
const { processPaymentProof, updatePaymentProofStatus, findUserByPhone } = require("../services/paymentValidationService");
const db = require("../models/db-sqlite");
const csService = require("../services/openclawCSService");

router.post("/webhook", async (req, res) => {
    try {
        const signature = req.headers["x-openclaw-signature"];
        const body = JSON.stringify(req.body);
        
        if (!validateWebhookSignature(signature, body)) {
            return res.status(401).json({ success: false, message: "Invalid signature" });
        }
        
        const { type, data } = req.body;
        
        if (type === "message") {
            await handleIncomingMessage(data);
        } else if (type === "approval_response") {
            await handleApprovalResponse(data);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error("[OpenClaw Webhook] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/approval", async (req, res) => {
    try {
        const { proofId, action, adminPhone } = req.body;
        
        if (!proofId || !action || !adminPhone) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        
        const status = action === "approve" ? "approved" : "rejected";
        await updatePaymentProofStatus(proofId, status, adminPhone);
        
        if (action === "approve") {
            await createPaymentRecord(proofId);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

async function handleIncomingMessage(data) {
    const { phoneNumber, messageType, content, imageUrl, messageId } = data;
    
    if (messageType === "image" && imageUrl) {
        const result = await processPaymentProof({ phoneNumber, imageUrl, messageId });
        
        if (result.success) {
            await sendApprovalNotification(result);
            await sendCustomerAcknowledgement(result.user, result.proofId);
        } else {
            await sendErrorMessage(phoneNumber, result.message);
        }
    } else {
        console.log(`[Aixa Agent] Text message from ${phoneNumber}: ${content}`);
        // Process text messages - check for payment status inquiries
        await processTextMessage(phoneNumber, content);
    }
}

/**
 * Process text messages from customers
 * Check for payment status inquiries and respond with actual data
 */
async function processTextMessage(phoneNumber, content) {
    try {
        // Normalize phone number (remove +62 prefix and add it back)
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        
        // Search for user by phone number
        const user = await findUserByPhone(normalizedPhone);
        
        if (!user) {
            // User not found, send generic response
            const message = `Maaf, nomor Anda tidak terdaftar di sistem kami. Mohon hubungi admin di +6285236022073 untuk verifikasi. 😊`;
            await sendMessage(phoneNumber, message);
            return;
        }
        
        // Check if the message is asking about payment status
        const isPaymentInquiry = isAskingAboutPayment(content);
        
        if (isPaymentInquiry) {
            // Extract month from content if specified
            const requestedMonth = extractMonthFromContent(content);
            // Get payment status for requested month or current month
            const paymentStatus = await getPaymentStatus(user, requestedMonth);
            await sendMessage(phoneNumber, paymentStatus);
        } else {
            // For other inquiries, let Aixa handle it (generic response)
            const message = `Halo ${user.full_name || user.name}! 👋\n\nUntuk informasi pembayaran bulan ini, silakan ketik "cek pembayaran" atau "status pembayaran".\n\nUntuk bantuan lainnya, hubungi admin di +6285236022073. 😊`;
            await sendMessage(phoneNumber, message);
        }
    } catch (error) {
        console.error('[Process Text Message] Error:', error);
        const message = `Maaf, terjadi kesalahan saat memproses pesan Anda. Mohon hubungi admin di +6285236022073. 😊`;
        await sendMessage(phoneNumber, message);
    }
}

/**
 * Normalize phone number to standard format
 * @param {string} phoneNumber - Phone number to normalize
 * @returns {string} Normalized phone number
 */
function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-digit characters
    let normalized = phoneNumber.replace(/\D/g, '');
    
    // If starts with 0, replace with 62
    if (normalized.startsWith('0')) {
        normalized = '62' + normalized.substring(1);
    }
    
    // Ensure starts with 62
    if (!normalized.startsWith('62')) {
        normalized = '62' + normalized;
    }
    
    return normalized;
}

/**
 * Check if message is asking about payment status
 * @param {string} content - Message content
 * @returns {boolean} True if asking about payment
 */
function isAskingAboutPayment(content) {
    if (!content) return false;
    
    const paymentKeywords = [
        'pembayaran', 'bayar', 'tagihan', 'cek', 'status', 
        'payment', 'bill', 'sudah bayar', 'belum bayar',
        'lunas', 'jatuh tempo', 'due'
    ];
    
    // Add month names in Indonesian and English
    const monthNames = [
        'januari', 'februari', 'maret', 'april', 'mei', 'juni',
        'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    const lowerContent = content.toLowerCase();
    
    // Check for payment keywords OR month names
    return paymentKeywords.some(keyword => lowerContent.includes(keyword)) ||
           monthNames.some(month => lowerContent.includes(month));
}

/**
 * Extract month from message content
 * @param {string} content - Message content
 * @returns {string|null} Month in YYYY-MM format or null if not found
 */
function extractMonthFromContent(content) {
    if (!content) return null;
    
    const lowerContent = content.toLowerCase();
    
    // Indonesian month names
    const idMonths = {
        'januari': 0, 'februari': 1, 'maret': 2, 'april': 3,
        'mei': 4, 'juni': 5, 'juli': 6, 'agustus': 7,
        'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
    };
    
    // English month names
    const enMonths = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11
    };
    
    // Try to find month name in content
    for (const [monthName, monthIndex] of Object.entries(idMonths)) {
        if (lowerContent.includes(monthName)) {
            // Determine year - if month is in the future, use previous year
            const now = new Date();
            let year = now.getFullYear();
            if (monthIndex > now.getMonth()) {
                year = year - 1;
            }
            return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
        }
    }
    
    for (const [monthName, monthIndex] of Object.entries(enMonths)) {
        if (lowerContent.includes(monthName)) {
            // Determine year - if month is in the future, use previous year
            const now = new Date();
            let year = now.getFullYear();
            if (monthIndex > now.getMonth()) {
                year = year - 1;
            }
            return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
        }
    }
    
    // No month found, return null
    return null;
}

/**
 * Get payment status for user
 * @param {Object} user - User object
 * @param {string} requestedMonth - Optional month in YYYY-MM format
 * @returns {string} Payment status message
 */
async function getPaymentStatus(user, requestedMonth = null) {
    try {
        // Use requested month or current month
        const monthYear = requestedMonth || new Date().toISOString().slice(0, 7);
        const payment = await db.getPaymentByUserAndMonth(user.id, monthYear);
        
        const status = payment ? "✅ SUDAH BAYAR" : "❌ BELUM BAYAR";
        const paymentDate = payment ? payment.paid_at?.split('T')[0] : "-";
        
        return `📊 *STATUS PEMBAYARAN*\n\n` +
               `Nama: ${user.full_name || user.name}\n` +
               `WiFi: ${user.pppoe_username}\n` +
               `Periode: ${monthYear}\n` +
               `Status: ${status}\n` +
               `Tanggal: ${paymentDate}\n` +
               `Tagihan: Rp ${(user.monthly_fee || 0).toLocaleString('id-ID')}`;
    } catch (error) {
        console.error('[Get Payment Status] Error:', error);
        return `❌ Maaf, terjadi kesalahan saat mengambil status pembayaran. Mohon hubungi admin.`;
    }
}

/**
 * Send error message to user
 * @param {string} phoneNumber - Phone number
 * @param {string} message - Error message
 */
async function sendErrorMessage(phoneNumber, message) {
    await csService.sendWhatsAppMessage(phoneNumber, `❌ *TERJADI KESALAHAN*\n\n${message}\n\nMohon coba lagi atau hubungi admin.`);
}

/**
 * Send approval notification to admin
 * @param {Object} result - Payment proof result
 */
async function sendApprovalNotification(result) {
    const { user, proofId } = result;
    const adminPhone = openclawConfig.adminPhone;
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    
    const message = `📋 *REQUEST APPROVAL PEMBAYARAN*` + 
        `\n\nCustomer: ${user.full_name || user.name} (${user.pppoe_username})` + 
        `\nNomor WA: ${user.phone_number}` + 
        `\nJumlah: Rp ${(user.monthly_fee || 0).toLocaleString("id-ID")}` + 
        `\nPeriode: ${currentMonthYear}` + 
        `\n\nID: ${proofId}` + 
        `\n\nReply: "APPROVE ${proofId}" atau "REJECT ${proofId}"`;
    
    await csService.sendWhatsAppMessage(adminPhone, message);
}

/**
 * Send customer acknowledgement
 * @param {Object} user - User object
 * @param {string} proofId - Payment proof ID
 */
async function sendCustomerAcknowledgement(user, proofId) {
    const message = `✅ *BUKTI TRANSFER DITERIMA*` + 
        `\n\nHalo ${user.full_name || user.name},` + 
        `\n\nBukti transfer Anda telah diterima dan sedang diverifikasi.` + 
        `\n\nID: ${proofId}` + 
        `\n\nTerima kasih!`;
    
    await csService.sendWhatsAppMessage(user.phone_number, message);
}

/**
 * Create payment record after approval
 * @param {string} proofId - Payment proof ID
 */
async function createPaymentRecord(proofId) {
    try {
        const proof = await db.get("SELECT * FROM payment_proofs WHERE id = ?", [proofId]);
        if (!proof) return;
        
        // Get user information
        const user = await db.get("SELECT * FROM clients WHERE id = ?", [proof.user_id]);
        if (!user) {
            console.error("Error creating payment record: User not found for proof", proofId);
            return;
        }
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        
        await db.run(
            `INSERT INTO payments (user_id, pppoe_username, amount, payment_date, month_year, proof_id, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user.id, user.pppoe_username, proof.amount, new Date().toISOString(), currentMonthYear, proofId, 'paid']
        );
        
        // Update client payment status
        await db.updateClientPaymentStatus(user.id, currentMonthYear, 'paid');
        
        console.log(`[Payment Record] Created for user ${user.pppoe_username}, proof ${proofId}`);
    } catch (error) {
        console.error("Error creating payment record:", error);
    }
}

/**
 * Handle approval response
 * @param {Object} data - Approval response data
 */
async function handleApprovalResponse(data) {
    const { proofId, action, adminPhone } = data;
    const status = action === "approve" ? "approved" : "rejected";
    
    await updatePaymentProofStatus(proofId, status, adminPhone);
    
    if (action === "approve") {
        await createPaymentRecord(proofId);
    }
    
    await notifyCustomer(proofId, status);
}

/**
 * Notify customer about payment status
 * @param {string} proofId - Payment proof ID
 * @param {string} status - Payment status
 */
async function notifyCustomer(proofId, status) {
    try {
        const proof = await db.get("SELECT * FROM payment_proofs WHERE id = ?", [proofId]);
        if (!proof) return;
        
        const user = await db.get("SELECT * FROM clients WHERE id = ?", [proof.user_id]);
        if (!user) return;
        
        let message;
        if (status === 'approved') {
            message = `✅ *PEMBAYARAN DITERIMA*

Halo ${user.full_name || user.name},

Pembayaran Anda telah diterima dan diverifikasi.

Nomor WiFi: ${user.pppoe_username}
Jumlah: Rp ${proof.amount.toLocaleString('id-ID')}
Periode: ${new Date().toISOString().slice(0, 7)}

Terima kasih!`;
        } else {
            message = `❌ *PEMBAYARAN DITOLAK*

Halo ${user.full_name || user.name},

Mohon maaf, pembayaran Anda ditolak.

Silakan kirim ulang bukti transfer yang valid.

Terima kasih.`;
        }
        
        await csService.sendWhatsAppMessage(user.phone_number, message);
    } catch (error) {
        console.error("Error notifying customer:", error);
    }
}

/**
 * Send message to user (wrapper for csService.sendWhatsAppMessage)
 * @param {string} phoneNumber - Phone number
 * @param {string} message - Message content
 */
async function sendMessage(phoneNumber, message) {
    await csService.sendWhatsAppMessage(phoneNumber, message);
}

module.exports = router;
