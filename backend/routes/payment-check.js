const express = require('express');
const router = express.Router();
const db = require('../models/db-sqlite');

/**
 * Cek status pembayaran berdasarkan nama PPPoE
 * Endpoint ini tidak memerlukan nomor HP, hanya nama PPPoE
 * Pencarian bersifat case-insensitive
 */
router.get('/check/:name', async (req, res) => {
    try {
        const { name } = req.params;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Nama PPPoE harus diisi' 
            });
        }
        
        // Cari user berdasarkan nama PPPoE (case-insensitive)
        const user = await db.getClientByUsername(name.trim());
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: `User dengan nama "${name}" tidak ditemukan` 
            });
        }
        
        // Cek status pembayaran bulan ini
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const payments = await db.getPaymentsByUserId(user.id);
        const hasPaid = payments.some(p => p.month_year === currentMonthYear && p.status === 'paid');
        
        // Format response yang user-friendly
        const response = {
            success: true,
            data: {
                user: {
                    id: user.id,
                    pppoe_username: user.pppoe_username,
                    name: user.full_name || user.name || user.pppoe_username,
                    phone: user.phone_number || user.phone || 'Tidak ada nomor HP',
                    plan: user.plan || 'Tidak ada paket',
                    monthly_fee: user.monthly_fee || 0,
                    address: user.address || 'Tidak ada alamat',
                    status: user.status || 'unknown'
                },
                billing: {
                    month_year: currentMonthYear,
                    month_name: getMonthName(currentMonthYear),
                    amount: user.monthly_fee || 0,
                    status: hasPaid ? 'LUNAS' : 'BELUM LUNAS',
                    status_code: hasPaid ? 'paid' : 'pending',
                    due_date: user.due_date || 'Belum ditetapkan',
                    last_paid_month: user.last_paid_month || 'Belum ada pembayaran'
                }
            },
            message: hasPaid 
                ? `Pembayaran bulan ${getMonthName(currentMonthYear)} untuk ${user.pppoe_username} sudah LUNAS`
                : `Pembayaran bulan ${getMonthName(currentMonthYear)} untuk ${user.pppoe_username} BELUM LUNAS`
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('[PAYMENT CHECK ERROR]', error);
        res.status(500).json({ 
            success: false, 
            message: 'Terjadi kesalahan saat mengecek status pembayaran',
            error: error.message 
        });
    }
});

/**
 * Cek status pembayaran dengan query parameter
 * Contoh: GET /api/payment/check?name=sugiarti
 */
router.get('/check', async (req, res) => {
    try {
        const { name } = req.query;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Parameter "name" harus diisi' 
            });
        }
        
        // Cari user berdasarkan nama PPPoE (case-insensitive)
        const user = await db.getClientByUsername(name.trim());
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: `User dengan nama "${name}" tidak ditemukan` 
            });
        }
        
        // Cek status pembayaran bulan ini
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const payments = await db.getPaymentsByUserId(user.id);
        const hasPaid = payments.some(p => p.month_year === currentMonthYear && p.status === 'paid');
        
        // Format response yang user-friendly
        const response = {
            success: true,
            data: {
                user: {
                    id: user.id,
                    pppoe_username: user.pppoe_username,
                    name: user.full_name || user.name || user.pppoe_username,
                    phone: user.phone_number || user.phone || 'Tidak ada nomor HP',
                    plan: user.plan || 'Tidak ada paket',
                    monthly_fee: user.monthly_fee || 0,
                    address: user.address || 'Tidak ada alamat',
                    status: user.status || 'unknown'
                },
                billing: {
                    month_year: currentMonthYear,
                    month_name: getMonthName(currentMonthYear),
                    amount: user.monthly_fee || 0,
                    status: hasPaid ? 'LUNAS' : 'BELUM LUNAS',
                    status_code: hasPaid ? 'paid' : 'pending',
                    due_date: user.due_date || 'Belum ditetapkan',
                    last_paid_month: user.last_paid_month || 'Belum ada pembayaran'
                }
            },
            message: hasPaid 
                ? `Pembayaran bulan ${getMonthName(currentMonthYear)} untuk ${user.pppoe_username} sudah LUNAS`
                : `Pembayaran bulan ${getMonthName(currentMonthYear)} untuk ${user.pppoe_username} BELUM LUNAS`
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('[PAYMENT CHECK ERROR]', error);
        res.status(500).json({ 
            success: false, 
            message: 'Terjadi kesalahan saat mengecek status pembayaran',
            error: error.message 
        });
    }
});

/**
 * Helper function untuk mendapatkan nama bulan dalam Bahasa Indonesia
 */
function getMonthName(monthYear) {
    const [year, month] = monthYear.split('-');
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

module.exports = router;
