const fs = require('fs');
const path = require('path');

// Baca database JSON lama
const dbPath = path.join(__dirname, 'data', 'db.json');

if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    console.log('📋 Daftar User dengan Nomor WhatsApp:');
    console.log('='.repeat(80));
    
    const users = db.users || [];
    
    if (users.length === 0) {
        console.log('❌ Tidak ada user ditemukan');
    } else {
        users.forEach((user, index) => {
            console.log(`\n${index + 1}. ${user.full_name || user.name || 'N/A'}`);
            console.log(`   WiFi: ${user.pppoe_username || user.wifi || 'N/A'}`);
            console.log(`   Phone: ${user.phone_number || '❌ Tidak ada nomor WA'}`);
            console.log(`   Paket: ${user.package || 'N/A'}`);
            console.log(`   Status: ${user.status || 'N/A'}`);
        });
        
        console.log('\n' + '='.repeat(80));
        console.log(`Total User: ${users.length}`);
        
        const usersWithPhone = users.filter(u => u.phone_number);
        console.log(`User dengan nomor WA: ${usersWithPhone.length}`);
        console.log(`User tanpa nomor WA: ${users.length - usersWithPhone.length}`);
    }
} else {
    console.log('❌ File database tidak ditemukan:', dbPath);
}