const db = require('./models/db-sqlite');

async function checkUsers() {
    try {
        await db.initDB();
        
        console.log('=== CHECKING USERS IN DATABASE ===\n');
        
        // Check Anin
        const anin = await db.getClientByUsername('anin');
        console.log('ANIN:');
        console.log(JSON.stringify(anin, null, 2));
        
        // Check Agus
        const agus = await db.getClientByUsername('agus');
        console.log('\nAGUS:');
        console.log(JSON.stringify(agus, null, 2));
        
        // Also check with different variations
        console.log('\n=== SEARCHING FOR VARIATIONS ===\n');
        
        const variations = ['anin', 'agus', 'Anin', 'Agus', 'ANIN', 'AGUS'];
        
        for (const variation of variations) {
            const user = await db.getClientByUsername(variation);
            if (user) {
                console.log(`Found "${variation}":`, user.pppoe_username, '-', user.full_name);
            }
        }
        
        // Get all users to see what's in the database
        console.log('\n=== ALL USERS IN DATABASE ===\n');
        const allUsers = await db.getAllClients();
        console.log(`Total users: ${allUsers.length}`);
        
        // Filter for names containing 'anin' or 'agus'
        const filtered = allUsers.filter(u => 
            (u.pppoe_username && u.pppoe_username.toLowerCase().includes('anin')) ||
            (u.pppoe_username && u.pppoe_username.toLowerCase().includes('agus')) ||
            (u.full_name && u.full_name.toLowerCase().includes('anin')) ||
            (u.full_name && u.full_name.toLowerCase().includes('agus'))
        );
        
        console.log('\nUsers matching "anin" or "agus":');
        filtered.forEach(u => {
            console.log(`- ${u.pppoe_username} (${u.full_name}) - Phone: ${u.phone_number || 'N/A'}`);
        });
        
        db.closeDB();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUsers();