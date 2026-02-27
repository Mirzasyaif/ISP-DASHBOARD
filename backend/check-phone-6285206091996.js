const db = require('./models/db-sqlite');

async function checkPhone() {
    try {
        await db.initDB();
        
        const phoneNumber = '6285206091996';
        console.log(`Checking for phone number: ${phoneNumber}`);
        
        // Get all clients and filter by phone number
        const allClients = await db.getAllClients();
        const user = allClients.find(c => 
            c.phone_number === phoneNumber || c.phone === phoneNumber
        );
        
        if (user) {
            console.log('✅ User found:');
            console.log(JSON.stringify(user, null, 2));
        } else {
            console.log('❌ User NOT found with phone number:', phoneNumber);
            console.log('\nChecking all clients with phone numbers...');
            
            const clientsWithPhone = allClients.filter(c => c.phone_number || c.phone);
            
            console.log(`\nTotal clients: ${allClients.length}`);
            console.log(`Clients with phone numbers: ${clientsWithPhone.length}`);
            
            if (clientsWithPhone.length > 0) {
                console.log('\nClients with phone numbers:');
                clientsWithPhone.forEach(c => {
                    console.log(`- ${c.name || c.full_name} (${c.pppoe_username}): ${c.phone_number || c.phone}`);
                });
            }
        }
        
        await db.closeDB();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkPhone();