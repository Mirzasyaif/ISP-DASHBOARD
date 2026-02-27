const db = require('./models/db');
const { sendPaymentConfirmation } = require('./controllers/whatsappController');

async function testCepiWhatsApp() {
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

        // Test kirim pesan WhatsApp
        console.log('\n📤 Mencoba mengirim pesan WhatsApp ke CEPI...\n');
        
        const result = await sendPaymentConfirmation(cepi, {
            amount: 110000,
            month_year: '2026-02',
            payment_method: 'manual',
            transaction_id: 'TEST-' + Date.now()
        });

        if (result) {
            console.log('✅ Pesan WhatsApp berhasil dikirim ke CEPI!');
        } else {
            console.log('❌ Gagal mengirim pesan WhatsApp ke CEPI');
        }

        await db.closeDB();
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testCepiWhatsApp();