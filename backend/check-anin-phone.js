const { initDB, getUserByUsername } = require('./models/db-sqlite.js');

async function checkAninPhone() {
    try {
        await initDB();
        
        const user = await getUserByUsername('ANIN');
        
        if (!user) {
            console.log('❌ User ANIN not found in database');
            process.exit(0);
        }
        
        console.log('✅ User ANIN found:');
        console.log(JSON.stringify({
            id: user.id,
            pppoe_username: user.pppoe_username,
            full_name: user.full_name,
            name: user.name,
            phone: user.phone,
            phone_number: user.phone_number
        }, null, 2));
        
        // Check what phone number would be used
        const phone = user.phone_number || user.phone || null;
        console.log('\n📱 Phone number analysis:');
        console.log(`   Raw phone: "${phone}"`);
        
        if (phone) {
            let targetPhone = phone.trim();
            if (targetPhone.startsWith('0')) {
                targetPhone = '+62' + targetPhone.substring(1);
            } else if (!targetPhone.startsWith('+')) {
                targetPhone = '+62' + targetPhone;
            }
            console.log(`   Formatted for WhatsApp: "${targetPhone}"`);
        } else {
            console.log('   ⚠️  No phone number available!');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkAninPhone();