const express = require("express");
const router = express.Router();
const db = require("../models/db-sqlite");

/**
 * Get user status by PPPoE username
 * This endpoint is designed to be called by OpenClaw without shell execution
 */
router.get("/:username", async (req, res) => {
    try {
        const { username } = req.params;
        
        // Search for user (case-insensitive)
        const user = await db.getUserByUsername(username);
        
        if (!user) {
            return res.json({
                success: false,
                message: `User "${username}" tidak ditemukan`,
                data: null
            });
        }
        
        // Get payment status for current month
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const payment = await db.getPaymentByUserAndMonth(user.id, currentMonthYear);
        
        const status = payment ? "✅ SUDAH BAYAR" : "❌ BELUM BAYAR";
        const paymentDate = payment ? payment.payment_date : "-";
        
        const response = {
            success: true,
            message: `Status user "${username}" berhasil diambil`,
            data: {
                nama: user.full_name || user.name,
                nomor_wifi: user.pppoe_username,
                biaya_bulanan: user.monthly_fee,
                periode: currentMonthYear,
                status_pembayaran: status,
                tanggal_bayar: paymentDate,
                status_akun: user.status,
                paket: user.plan,
                due_date: user.due_date,
                nomor_hp: user.phone_number
            }
        };
        
        res.json(response);
    } catch (error) {
        console.error("[User Status] Error:", error);
        res.status(500).json({
            success: false,
            message: `Terjadi kesalahan: ${error.message}`,
            data: null
        });
    }
});

module.exports = router;