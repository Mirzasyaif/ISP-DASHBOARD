const db = require('./models/db');
const { sendPaymentConfirmation } = require('./controllers/whatsappWahaController');

async function testWahaIntegration() {
    try {
        await db.initDB();
        console.log('✅ Database initialized\n');

        // Cari user CEPI
        const cepi = await db.getClientByUsername('CEPI');
        
        if (!cepi) {
            console.log('❌ User CEPI tidak ditemukan di database');
            return;
        }

        console.log('📋 Data User CEPI dari database:');
        console.log('========================================');
        console.log(`ID: ${cepi.id}`);
        console.log(`Username: ${cepi.pppoe_username}`);
        console.log(`Full Name: ${cepi.full_name || 'N/A'}`);
        console.log(`Phone: ${cepi.phone || 'KOSONG'}`);
        console.log(`Phone Number: ${cepi.phone_number || 'KOSONG'}`);
        console.log('========================================\n');

        // Cek fungsi getUserPhone
        const phone = cepi.phone_number || cepi.phone;
        console.log(`📱 Phone yang akan digunakan: ${phone || 'NULL'}`);
        
        if (!phone) {
            console.log('❌ ERROR: Nomor HP tidak tersedia!');
            console.log('💡 Solusi: Update nomor HP di database');
            await db.closeDB();
            return;
        }

        // Test kirim pesan WhatsApp via WAHA
        console.log('\n📤 Mencoba mengirim pesan WhatsApp via WAHA ke CEPI...\n');
        console.log('📌 WAHA Configuration:');
        console.log(`   URL: ${process.env.WAHA_API_URL || 'http://localhost:3000'}`);
        console.log(`   Session: ${process.env.WAHA_SESSION_NAME || 'isp-dashboard'}\n`);
        
        const result = await sendPaymentConfirmation(cepi, {
            amount: 110000,
            month_year: '2026-02',
            payment_method: 'manual',
            transaction_id: 'TEST-WAHA-' + Date.now()
        });

        if (result) {
            console.log('\n✅ Pesan WhatsApp berhasil dikirim ke CEPI via WAHA!');
            console.log('💡 Cek WhatsApp di nomor +6285749556441');
        } else {
            console.log('\n❌ Gagal mengirim pesan WhatsApp ke CEPI via WAHA');
            console.log('💡 Pastikan:');
            console.log('   1. WAHA service berjalan di http://localhost:3000');
            console.log('   2. Session "isp-dashboard" sudah dibuat dan terhubung');
            console.log('   3. WhatsApp di HP sudah scan QR code');
        }

        await db.closeDB();
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testWahaIntegration();