const db = require("../models/db-sqlite");

async function getUserByPhoneNumber(phoneNumber) {
    try {
        const allClients = await db.getAllClients();
        return allClients.find(c => c.phone_number === phoneNumber || c.phone === phoneNumber);
    } catch (error) {
        console.error("Error getting user by phone:", error);
        return null;
    }
}

async function sendWhatsAppMessage(phoneNumber, message) {
    try {
        const axios = require('axios');
        const openclawService = require('./openclawService');
        await axios.post(`${openclawService.openclawConfig.apiUrl}/messages`, {
            channel: 'whatsapp', recipient: phoneNumber, content: message
        }, {
            headers: { 'Authorization': `Bearer ${openclawService.openclawConfig.apiKey}`, 'Content-Type': 'application/json' }
        });
        console.log(`[WhatsApp] Sent to ${phoneNumber}`);
    } catch (error) {
        console.error('[WhatsApp] Error:', error);
    }
}

async function sendMenu(phoneNumber) {
    await sendWhatsAppMessage(phoneNumber, `📋 *MENU BANTUAN CS*\n\n👤 INFO - Info akun\n📊 CEK - Status pembayaran\n📜 RIWAYAT - Riwayat 6 bulan\n📦 PAKET - Info paket\n🔌 STATUS - Status layanan\n💰 TAGIHAN - Tagihan bulan ini\n📅 JADWAL - Jadwal pembayaran\n📝 LAPOR [pesan] - Lapor kendala\n📸 Kirim gambar bukti transfer`);
}

async function sendUserInfo(phoneNumber) {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) return await sendWhatsAppMessage(phoneNumber, "❌ Akun tidak ditemukan. Hubungi admin.");
    const statusIcon = user.status === 'active' ? '🟢' : '🔴';
    await sendWhatsAppMessage(phoneNumber, `👤 *INFO AKUN*\n${statusIcon} Status: ${user.status.toUpperCase()}\nNama: ${user.full_name || user.name}\nWiFi: ${user.pppoe_username}\nPaket: ${user.plan || '-'}\nBiaya: Rp ${(user.monthly_fee || 0).toLocaleString('id-ID')}/bulan`);
}

async function sendPaymentStatus(phoneNumber) {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) return await sendWhatsAppMessage(phoneNumber, "❌ Akun tidak ditemukan.");
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    const payment = await db.getPaymentByUserAndMonth(user.id, currentMonthYear);
    const status = payment ? "✅ SUDAH BAYAR" : "❌ BELUM BAYAR";
    const paymentDate = payment ? payment.paid_at?.split('T')[0] : "-";
    await sendWhatsAppMessage(phoneNumber, `📊 *STATUS PEMBAYARAN*\nNama: ${user.full_name || user.name}\nWiFi: ${user.pppoe_username}\nPeriode: ${currentMonthYear}\nStatus: ${status}\nTanggal: ${paymentDate}\nTagihan: Rp ${(user.monthly_fee || 0).toLocaleString('id-ID')}`);
}

async function sendPaymentHistory(phoneNumber) {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) return await sendWhatsAppMessage(phoneNumber, "❌ Akun tidak ditemukan.");
    const payments = await db.getPaymentsByUserId(user.id);
    let historyText = "📜 *RIWAYAT PEMBAYARAN*\n\n";
    if (payments.length === 0) {
        historyText += "Belum ada riwayat pembayaran.";
    } else {
        payments.slice(0, 6).forEach(p => {
            const status = p.status === 'paid' ? '✅' : '❌';
            const date = p.paid_at?.split('T')[0] || '-';
            historyText += `${status} ${p.month_year}: Rp ${p.amount?.toLocaleString('id-ID')} (${date})\n`;
        });
    }
    await sendWhatsAppMessage(phoneNumber, historyText);
}

async function sendPackageInfo(phoneNumber) {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) return await sendWhatsAppMessage(phoneNumber, "❌ Akun tidak ditemukan.");
    await sendWhatsAppMessage(phoneNumber, `📦 *INFO PAKET*\n\nNama: ${user.full_name || user.name}\nWiFi: ${user.pppoe_username}\nPaket: ${user.plan || '-'}\nBiaya: Rp ${(user.monthly_fee || 0).toLocaleString('id-ID')}/bulan\nStatus: ${user.status?.toUpperCase() || '-'}`);
}

async function sendServiceStatus(phoneNumber) {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) return await sendWhatsAppMessage(phoneNumber, "❌ Akun tidak ditemukan.");
    const statusIcon = user.status === 'active' ? '🟢' : '🔴';
    await sendWhatsAppMessage(phoneNumber, `🔌 *STATUS LAYANAN*\n\n${statusIcon} Status: ${user.status?.toUpperCase() || '-'}\nWiFi: ${user.pppoe_username}\n\n${user.status === 'active' ? 'Layanan Anda aktif dan berjalan normal.' : 'Layanan Anda sedang tidak aktif. Silakan hubungi admin.'}`);
}

async function sendBillInfo(phoneNumber) {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) return await sendWhatsAppMessage(phoneNumber, "❌ Akun tidak ditemukan.");
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    await sendWhatsAppMessage(phoneNumber, `💰 *TAGIHAN BULAN INI*\n\nNama: ${user.full_name || user.name}\nWiFi: ${user.pppoe_username}\nPeriode: ${currentMonthYear}\nTagihan: Rp ${(user.monthly_fee || 0).toLocaleString('id-ID')}\n\nSilakan transfer ke rekening yang tersedia dan kirim bukti transfer.`);
}

async function sendPaymentSchedule(phoneNumber) {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) return await sendWhatsAppMessage(phoneNumber, "❌ Akun tidak ditemukan.");
    await sendWhatsAppMessage(phoneNumber, `📅 *JADWAL PEMBAYARAN*\n\nNama: ${user.full_name || user.name}\nWiFi: ${user.pppoe_username}\nBiaya: Rp ${(user.monthly_fee || 0).toLocaleString('id-ID')}/bulan\n\nSilakan lakukan pembayaran setiap tanggal 1-10 setiap bulan.\n\nTerima kasih!`);
}

async function handleReport(phoneNumber, message) {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) return await sendWhatsAppMessage(phoneNumber, "❌ Akun tidak ditemukan.");
    
    // Send report to admin
    const openclawService = require('./openclawService');
    const adminMessage = `📝 *LAPORAN KENDALA*\n\nDari: ${user.full_name || user.name} (${user.pppoe_username})\nNomor: ${phoneNumber}\n\nPesan:\n${message}\n\nWaktu: ${new Date().toLocaleString('id-ID')}`;
    await sendWhatsAppMessage(openclawService.openclawConfig.adminPhone, adminMessage);
    
    // Acknowledge to user
    await sendWhatsAppMessage(phoneNumber, `✅ *LAPORAN DITERIMA*\n\nTerima kasih ${user.full_name || user.name},\n\nLaporan Anda telah diterima dan akan segera kami proses.\n\nID Tiket: ${Date.now()}\n\nMohon tunggu balasan dari kami.`);
}

module.exports = {
    getUserByPhoneNumber,
    sendWhatsAppMessage,
    sendMenu,
    sendUserInfo,
    sendPaymentStatus,
    sendPaymentHistory,
    sendPackageInfo,
    sendServiceStatus,
    sendBillInfo,
    sendPaymentSchedule,
    handleReport
};
