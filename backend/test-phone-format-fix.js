const { initDB, getUserByUsername } = require('./models/db-sqlite.js');

function formatPhoneNumber(phone) {
    let targetPhone = phone.trim();
    if (targetPhone.startsWith('0')) {
        targetPhone = '+62' + targetPhone.substring(1);
    } else if (targetPhone.startsWith('62')) {
        targetPhone = '+' + targetPhone;
    } else if (!targetPhone.startsWith('+')) {
        targetPhone = '+62' + targetPhone;
    }
    return targetPhone;
}

async function testPhoneFormatting() {
    try {
        await initDB();
        
        const user = await getUserByUsername('ANIN');
        
        if (!user) {
            console.log('❌ User ANIN not found in database');
            process.exit(0);
        }
        
        const phone = user.phone_number || user.phone || null;
        
        console.log('📱 Testing phone number formatting:');
        console.log(`   Raw phone: "${phone}"`);
        console.log(`   Formatted: "${formatPhoneNumber(phone)}"`);
        
        // Test various formats
        console.log('\n🧪 Testing various phone number formats:');
        const testCases = [
            '085236022073',  // Starts with 0
            '6285236022073',  // Starts with 62 (ANIN's case)
            '+6285236022073', // Already has +62
            '85236022073',    // No prefix
        ];
        
        testCases.forEach(testPhone => {
            console.log(`   "${testPhone}" → "${formatPhoneNumber(testPhone)}"`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testPhoneFormatting();