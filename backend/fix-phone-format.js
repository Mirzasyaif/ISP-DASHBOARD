/**
 * Script untuk mengupdate format nomor telepon dari 08... ke 628...
 */

const db = require('./models/db-sqlite');

async function fixPhoneNumbers() {
    try {
        await db.initDB();
        
        const users = await db.getAllClients();
        console.log(`Total users: ${users.length}`);
        
        let updated = 0;
        let skipped = 0;
        
        for (const user of users) {
            if (!user.phone_number) {
                skipped++;
                continue;
            }
            
            let newPhone = user.phone_number;
            
            // Jika format 08..., ubah ke 628...
            if (user.phone_number.startsWith('08')) {
                newPhone = '62' + user.phone_number.substring(1);
            }
            // Jika format +62..., hapus +
            else if (user.phone_number.startsWith('+62')) {
                newPhone = user.phone_number.substring(1);
            }
            
            if (newPhone !== user.phone_number) {
                await db.updateUserPhoneNumber(user.id, newPhone);
                console.log(`✅ Updated: ${user.name} (${user.pppoe_username})`);
                console.log(`   Old: ${user.phone_number}`);
                console.log(`   New: ${newPhone}`);
                updated++;
            } else {
                skipped++;
            }
        }
        
        console.log(`\n=== SUMMARY ===`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped: ${skipped}`);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixPhoneNumbers();