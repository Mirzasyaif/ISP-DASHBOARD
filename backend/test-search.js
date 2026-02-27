const db = require('./models/db-sqlite');

async function testSearch() {
    try {
        console.log('Initializing database...');
        await db.initDB();
        console.log('Database initialized.');
        
        console.log('Testing database search for "Agus"...');
        
        // Test 1: Search for Agus
        const results = await db.searchUsersByNameOrIP('agus');
        console.log('\nSearch results for "Agus":');
        console.log(JSON.stringify(results, null, 2));
        
        // Test 2: Get all users
        const allUsers = await db.getAllUsers();
        console.log('\n\nTotal users in database:', allUsers.length);
        
        // Test 3: Check if Agus exists
        const agusUsers = allUsers.filter(u => 
            u.name && u.name.toLowerCase().includes('agus') ||
            u.pppoe_username && u.pppoe_username.toLowerCase().includes('agus')
        );
        console.log('\nUsers with "Agus" in name or username:');
        console.log(JSON.stringify(agusUsers, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testSearch();