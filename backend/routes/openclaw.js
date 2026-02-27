const express = require("express");
const router = express.Router();
const axios = require("axios");
const { validateWebhookSignature, openclawConfig } = require("../services/openclawService");
const { processPaymentProof, updatePaymentProofStatus } = require("../services/paymentValidationService");
const csService = require("../services/openclawCSService");
const db = require("../models/db-sqlite");
const fs = require("fs");
const path = require("path");

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

/**
 * Sync WhatsApp numbers to OpenClaw allowlist
 * GET /api/openclaw/sync-allowlist
 */
router.get("/sync-allowlist", async (req, res) => {
    try {
        // Get all clients from database
        const clients = await db.getAllClients();
        
        // Filter clients with phone numbers
        const clientsWithPhone = clients.filter(client => {
            const phone = client.phone || client.phone_number;
            return phone && phone.trim() !== '';
        });
        
        // Format phone numbers
        const phoneNumbers = [];
        const phoneDetails = [];
        
        clientsWithPhone.forEach(client => {
            const phone = client.phone || client.phone_number;
            const formatted = formatPhoneNumber(phone);
            
            if (formatted) {
                phoneNumbers.push(formatted);
                phoneDetails.push({
                    name: client.name || client.full_name || client.pppoe_username,
                    pppoe_username: client.pppoe_username,
                    original: phone,
                    formatted: formatted
                });
            }
        });
        
        // Remove duplicates
        const uniquePhoneNumbers = [...new Set(phoneNumbers)];
        
        res.json({
            success: true,
            data: {
                allowFrom: uniquePhoneNumbers,
                details: phoneDetails,
                stats: {
                    totalClients: clients.length,
                    clientsWithPhone: clientsWithPhone.length,
                    uniqueNumbers: uniquePhoneNumbers.length
                },
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("[OpenClaw Sync Allowlist] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Format phone number to OpenClaw standard
 * - Remove non-digit characters
 * - Replace leading 0 with 62
 * - Ensure starts with 62
 */
function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-digit characters
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // If empty after cleaning
    if (!formatted) return null;
    
    // If starts with 0, replace with 62
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substring(1);
    }
    
    // Ensure starts with 62
    if (!formatted.startsWith('62')) {
        formatted = '62' + formatted;
    }
    
    return formatted;
}

async function handleIncomingMessage(data) {
    const { phoneNumber, messageType, content, imageUrl, messageId } = data;
    console.log(`[OpenClaw Webhook] Received message from: ${phoneNumber}, type: ${messageType}, content: ${content}`);
    
    if (messageType === "image" && imageUrl) {
        const result = await processPaymentProof({ phoneNumber, imageUrl, messageId });
        
        if (result.success) {
            await sendApprovalNotification(result);
            await sendCustomerAcknowledgement(result.user, result.proofId);
        } else {
            await csService.sendWhatsAppMessage(phoneNumber, `❌ *TERJADI KESALAHAN*\n\n${result.message}\n\nMohon coba lagi atau hubungi admin.`);
        }
    } else {
        await handleTextMessage(phoneNumber, content);
    }
}

async function handleApprovalResponse(data) {
    const { proofId, action, adminPhone } = data;
    const status = action === "approve" ? "approved" : "rejected";
    
    await updatePaymentProofStatus(proofId, status, adminPhone);
    
    if (action === "approve") {
        await createPaymentRecord(proofId);
    }
    
    await notifyCustomer(proofId, status);
}

async function handleTextMessage(phoneNumber, content) {
    const upperContent = content.toUpperCase().trim();
    
    // Admin commands
    if (phoneNumber === openclawConfig.adminPhone) {
        if (upperContent.startsWith("APPROVE ")) {
            const proofId = upperContent.replace("APPROVE ", "").trim();
            await handleApprovalResponse({ proofId, action: "approve", adminPhone: phoneNumber });
        } else if (upperContent.startsWith("REJECT ")) {
            const proofId = upperContent.replace("REJECT ", "").trim();
            await handleApprovalResponse({ proofId, action: "reject", adminPhone: phoneNumber });
        }
        return;
    }
    
    // Customer commands - Auto-detect by phone number
    if (upperContent === "MENU" || upperContent === "HELP") {
        await csService.sendMenu(phoneNumber);
    } else if (upperContent === "INFO") {
        await csService.sendUserInfo(phoneNumber);
    } else if (upperContent === "CEK") {
        await csService.sendPaymentStatus(phoneNumber);
    } else if (upperContent === "RIWAYAT") {
        await csService.sendPaymentHistory(phoneNumber);
    } else if (upperContent === "PAKET") {
        await csService.sendPackageInfo(phoneNumber);
    } else if (upperContent === "STATUS") {
        await csService.sendServiceStatus(phoneNumber);
    } else if (upperContent === "TAGIHAN") {
        await csService.sendBillInfo(phoneNumber);
    } else if (upperContent === "JADWAL") {
        await csService.sendPaymentSchedule(phoneNumber);
    } else if (upperContent.startsWith("LAPOR ")) {
        const message = content.substring(6).trim();
        await csService.handleReport(phoneNumber, message);
    } else {
        // Default response for unknown commands
        await csService.sendMenu(phoneNumber);
    }
}

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

async function sendCustomerAcknowledgement(user, proofId) {
    const message = `✅ *BUKTI TRANSFER DITERIMA*` + 
        `\n\nHalo ${user.full_name || user.name},` + 
        `\n\nBukti transfer Anda telah diterima dan sedang diverifikasi.` + 
        `\n\nID: ${proofId}` + 
        `\n\nTerima kasih!`;
    
    await csService.sendWhatsAppMessage(user.phone_number, message);
}

async function createPaymentRecord(proofId) {
    try {
        const proof = await db.get("SELECT * FROM payment_proofs WHERE id = ?", [proofId]);
        if (!proof) return;
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        
        await db.run(
            `INSERT INTO payments (pppoe_username, amount, payment_date, month_year, proof_id, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [proof.pppoe_username, proof.amount, new Date().toISOString(), currentMonthYear, proofId, 'paid']
        );
    } catch (error) {
        console.error("Error creating payment record:", error);
    }
}

async function notifyCustomer(proofId, status) {
    try {
        const proof = await db.get("SELECT * FROM payment_proofs WHERE id = ?", [proofId]);
        if (!proof) return;
        
        const user = await db.get("SELECT * FROM users WHERE pppoe_username = ?", [proof.pppoe_username]);
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
 * Check if phone number is in allowlist
 */
async function checkAllowlist(phoneNumber) {
    try {
        const allowlistPath = path.join(__dirname, '../openclaw-allowlist-numbers.json');
        
        if (!fs.existsSync(allowlistPath)) {
            console.warn('[Aixa Agent] Allowlist file not found:', allowlistPath);
            return false;
        }
        
        const allowlistData = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
        const allowFrom = allowlistData.allowFrom || [];
        
        // Format phone number for comparison
        const formattedPhone = formatPhoneNumber(phoneNumber);
        
        return allowFrom.includes(formattedPhone);
    } catch (error) {
        console.error('[Aixa Agent] Error checking allowlist:', error);
        return false;
    }
}

/**
 * Route message to Aixa agent
 */
async function routeToAixaAgent(phoneNumber, message, messageType = 'text') {
    try {
        const response = await axios.post(
            `${openclawConfig.apiUrl}/agents/aixa/message`,
            { phoneNumber, message, messageType, timestamp: new Date().toISOString() },
            { headers: { 'Authorization': `Bearer ${openclawConfig.apiKey}`, 'Content-Type': 'application/json' } }
        );
        console.log('[Aixa Agent] Message routed successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('[Aixa Agent] Error routing message:', error);
        throw error;
    }
}

/**
 * Send direct message without agent routing
 */
async function sendDirectMessage(phoneNumber, message, messageType = 'text') {
    try {
        const response = await axios.post(
            `${openclawConfig.apiUrl}/send`,
            { phoneNumber, message, messageType },
            { headers: { 'Authorization': `Bearer ${openclawConfig.apiKey}`, 'Content-Type': 'application/json' } }
        );
        console.log('[Direct Message] Sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('[Direct Message] Error:', error);
        throw error;
    }
}

/**
 * Send message with agent routing logic
 */
async function sendMessage(phoneNumber, message, messageType = 'text') {
    // Check if number is in allowlist
    const isInAllowlist = await checkAllowlist(phoneNumber);
    
    if (isInAllowlist) {
        // Route to Aixa agent
        console.log(`[sendMessage] Routing to Aixa agent for: ${phoneNumber}`);
        return await routeToAixaAgent(phoneNumber, message, messageType);
    } else {
        // Send directly without agent
        console.log(`[sendMessage] Sending direct message to: ${phoneNumber}`);
        return await sendDirectMessage(phoneNumber, message, messageType);
    }
}

module.exports = router;
