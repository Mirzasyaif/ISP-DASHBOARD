const db = require('./models/db-sqlite');

async function checkCepiPhone() {
    try {
        await db.initDB();
        console.log('✅ Database initialized\n');

        // Cari user CEPI
        const cepi = await db.getClientByUsername('CEPI');
        
        if (!cepi) {
            console.log('❌ User CEPI tidak ditemukan di database');
            return;
        }

        console.log('📋 Data User CEPI:');
        console.log('========================================');
        console.log(`ID: ${cepi.id}`);
        console.log(`Username: ${cepi.pppoe_username}`);
        console.log(`Full Name: ${cepi.full_name || 'N/A'}`);
        console.log(`Phone: ${cepi.phone || 'KOSONG'}`);
        console.log(`Phone Number: ${cepi.phone_number || 'KOSONG'}`);
        console.log(`Address: ${cepi.address || 'N/A'}`);
        console.log(`Plan: ${cepi.plan || 'N/A'}`);
        console.log(`Monthly Fee: ${cepi.monthly_fee || 0}`);
        console.log(`Status: ${cepi.status || 'N/A'}`);
        console.log('========================================\n');

        // Cek apakah nomor HP tersedia
        const hasPhone = cepi.phone_number || cepi.phone;
        
        if (!hasPhone) {
            console.log('⚠️  User CEPI TIDAK memiliki nomor HP!');
            console.log('💡 Solusi: Update nomor HP dengan perintah:');
            console.log('   node update-cepi-phone.js <nomor_hp>\n');
        } else {
            console.log('✅ User CEPI memiliki nomor HP:', hasPhone);
        }

        await db.closeDB();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkCepiPhone();