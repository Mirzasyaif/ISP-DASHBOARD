const db = require('./models/db-sqlite');

async function test() {
    try {
        await db.initDB();
        console.log('Database initialized');
        
        const clients = await db.getAllClients();
        console.log(`Total clients: ${clients.length}`);
        
        // Cari user dengan nomor 6285206091996
        const testNumbers = ['6285206091996', '+6285206091996', '085206091996'];
        
        for (const num of testNumbers) {
            const user = clients.find(c => c.phone_number === num || c.phone === num);
            if (user) {
                console.log(`\n✅ User ditemukan dengan nomor: ${num}`);
                console.log('User:', JSON.stringify(user, null, 2));
            }
        }
        
        // Tampilkan semua nomor di database
        console.log('\n\nSemua nomor di database:');
        clients.filter(c => c.phone_number || c.phone).forEach(c => {
            console.log(`- ${c.name || c.full_name}: phone_number="${c.phone_number}", phone="${c.phone}"`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

test();