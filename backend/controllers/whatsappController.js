// isp-dashboard/backend/controllers/whatsappController.js
// IMPLEMENTASI: Menggunakan child_process untuk memanggil OpenClaw CLI

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Utility function to format rupiah
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

/**
 * Helper: Cari nomor telepon dari user (coba phone_number dulu, lalu phone)
 */
function getUserPhone(user) {
    // Prioritas: phone_number > phone > null
    return user.phone_number || user.phone || null;
}

/**
 * Fungsi untuk mengirim notifikasi billing via WhatsApp
 * Menggunakan OpenClaw CLI melalui child_process
 * @param {Object} user - Data pelanggan
 * @param {string} status - Status notifikasi ('H-3', 'H-0', 'D+1')
 */
async function sendBillingNotification(user, status) {
    const phone = getUserPhone(user);
    if (!phone) {
        console.warn(`[WhatsApp SKIP] User ${user.pppoe_username} skipped. No phone number available.`);
        return false;
    }
    
    // Normalize phone number: tambahkan +62 jika perlu
    let targetPhone = phone.trim();
    if (targetPhone.startsWith('0')) {
        targetPhone = '+62' + targetPhone.substring(1);
    } else if (!targetPhone.startsWith('+')) {
        targetPhone = '+62' + targetPhone;
    }
    
    const formattedFee = formatRupiah(user.monthly_fee);
    const fullName = user.full_name || user.name || user.pppoe_username;
    const dueDate = user.due_date || 'tanggal belum ditetapkan';
    
    let subject;
    let messageText;

    switch (status) {
        case 'H-3':
            subject = '⚠️ PENGINGAT TAGIHAN: 3 Hari Lagi';
            messageText = 
                `*${subject}*\n\n` +
                `Halo *${fullName}*,\n\n` +
                `Ini adalah pengingat bahwa tagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}* akan jatuh tempo dalam *3 hari* (pada tanggal *${dueDate}*).\n\n` +
                `Mohon segera lakukan pembayaran untuk menghindari pemutusan layanan. Terima kasih atas kerjasama Anda!`;
            break;
        case 'H-0':
            subject = '🔔 JATUH TEMPO: Hari Ini';
            messageText = 
                `*${subject}*\n\n` +
                `Halo *${fullName}*,\n\n` +
                `Hari ini adalah tanggal jatuh tempo tagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}*.\n\n` +
                `Pembayaran diharapkan diterima hari ini. Terima kasih!`;
            break;
        case 'D+1':
            subject = '🚨 TAGIHAN TERLAMBAT';
            messageText = 
                `*${subject}*\n\n` +
                `Halo *${fullName}*,\n\n` +
                `Tagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}* telah *melewati jatuh tempo* (*${dueDate}*).\n\n` +
                `Mohon segera lakukan pembayaran. Jika layanan Anda terputus, pembayaran harus diverifikasi untuk mengaktifkannya kembali.`;
            break;
        default:
            console.error(`[WhatsApp ERROR] Unknown notification status: ${status}`);
            return false;
    }

    try {
        console.log(`[WhatsApp SEND] Sending ${status} notification to ${targetPhone} for ${user.pppoe_username}`);
        
        // Escape quotes and special characters untuk shell command
        const escapedMessage = messageText.replace(/'/g, "'\"'\"'");
        
        // Gunakan OpenClaw CLI untuk mengirim pesan
        // Asumsi: openclaw CLI tersedia di PATH
        const command = `openclaw message send --channel whatsapp --target "${targetPhone}" --message '${escapedMessage}'`;
        
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
        
        if (stderr && stderr.trim()) {
            console.warn(`[WhatsApp WARN] stderr: ${stderr}`);
        }
        
        console.log(`[WhatsApp SUCCESS] Notification sent to ${targetPhone}.`);
        return true;
    } catch (error) {
        console.error(`[WhatsApp ERROR] Failed to send notification to ${targetPhone}:`, error.message);
        if (error.stdout) console.error(`stdout: ${error.stdout}`);
        if (error.stderr) console.error(`stderr: ${error.stderr}`);
        return false;
    }
}

module.exports = {
    sendBillingNotification,
    getUserPhone // export untuk testing
};