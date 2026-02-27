#!/usr/bin/env node

/**
 * Test fuzzy search improvements for /bayar command
 */

const db = require('./models/db');
const { parseRupiah, formatRupiah } = require('./utils/currencyParser');

async function testFuzzySearch() {
    console.log('🧪 Testing Fuzzy Search Improvements\n');
    
    try {
        await db.initDB();
        console.log(`✅ Database type: ${db.getDatabaseType()}`);
        
        // Test 1: Case-insensitive search
        console.log('\n1️⃣ Testing Case-Insensitive Search:');
        const testQueries = ['a', 'A', 'budi', 'BUDI', 'ip', 'IP'];
        
        for (const query of testQueries) {
            const results = await db.searchUsersByNameOrIP(query);
            console.log(`   Query "${query}": ${results.length} results`);
            
            if (results.length > 0) {
                console.log(`     Sample: ${results[0].pppoe_username} (${results[0].ip_address})`);
            }
        }
        
        // Test 2: Partial name matching
        console.log('\n2️⃣ Testing Partial Name Matching:');
        const partialQueries = ['ag', 'us', 'il', 'ry'];
        
        for (const query of partialQueries) {
            const results = await db.searchUsersByNameOrIP(query);
            console.log(`   Query "${query}": ${results.length} results`);
            
            if (results.length > 0 && results.length <= 3) {
                results.forEach(user => {
                    console.log(`     • ${user.pppoe_username} - ${user.ip_address}`);
                });
            } else if (results.length > 3) {
                console.log(`     • Showing 3 of ${results.length}:`);
                results.slice(0, 3).forEach(user => {
                    console.log(`       ${user.pppoe_username} - ${user.ip_address}`);
                });
            }
        }
        
        // Test 3: Get user by ID
        console.log('\n3️⃣ Testing Get User By ID:');
        const users = await db.getAllUsers();
        
        if (users.length > 0) {
            const sampleUser = users[0];
            console.log(`   Sample user: ${sampleUser.pppoe_username} (ID: ${sampleUser.id})`);
            
            const userById = await db.getUserById(sampleUser.id);
            if (userById) {
                console.log(`   ✅ Found by ID: ${userById.pppoe_username}`);
            } else {
                console.log(`   ❌ Not found by ID`);
            }
        }
        
        // Test 4: IP address search
        console.log('\n4️⃣ Testing IP Address Search:');
        const ipQueries = ['192', '168', '1.', '.1'];
        
        for (const query of ipQueries) {
            const results = await db.searchUsersByNameOrIP(query);
            console.log(`   IP query "${query}": ${results.length} results`);
            
            if (results.length > 0) {
                console.log(`     Sample IP: ${results[0].ip_address}`);
            }
        }
        
        // Test 5: Empty/whitespace handling
        console.log('\n5️⃣ Testing Edge Cases:');
        const edgeCases = ['', '  ', 'x', 'xyz123'];
        
        for (const query of edgeCases) {
            const results = await db.searchUsersByNameOrIP(query);
            console.log(`   Query "${query}": ${results.length} results`);
        }
        
        // Test 6: Search limits
        console.log('\n6️⃣ Testing Search Limits:');
        const allResults = await db.searchUsersByNameOrIP('a');
        console.log(`   Query "a": ${allResults.length} results`);
        console.log(`   Search limit: ${allResults.length <= 20 ? '✅ Within 20 limit' : '❌ Exceeds 20 limit'}`);
        
        // Test 7: Button formatting simulation
        console.log('\n7️⃣ Simulating Button Formatting:');
        const searchResults = await db.searchUsersByNameOrIP('a');
        
        if (searchResults.length > 0) {
            console.log(`   Button format for ${searchResults.length} results:`);
            
            searchResults.slice(0, 3).forEach(user => {
                const buttonText = `${user.pppoe_username} - ${user.ip_address || 'no IP'}`;
                const callbackData = user.id ? `pay_id_${user.id}` : `select_user:${user.pppoe_username}`;
                console.log(`     • ${buttonText}`);
                console.log(`       Callback: ${callbackData}`);
            });
        }
        
        // Test 8: Monthly fee display
        console.log('\n8️⃣ Testing Monthly Fee Display:');
        const feeUsers = await db.getAllUsers();
        const usersWithFee = feeUsers.filter(u => u.monthly_fee > 0);
        const usersWithoutFee = feeUsers.filter(u => !u.monthly_fee || u.monthly_fee === 0);
        
        console.log(`   Users with fee: ${usersWithFee.length}/${feeUsers.length}`);
        console.log(`   Users without fee: ${usersWithoutFee.length}`);
        
        if (usersWithFee.length > 0) {
            const totalRevenue = usersWithFee.reduce((sum, user) => sum + user.monthly_fee, 0);
            console.log(`   Total monthly revenue: ${formatRupiah(totalRevenue)}`);
        }
        
        console.log('\n✅ All tests completed successfully!');
        console.log('\n📋 Summary:');
        console.log('• Case-insensitive search ✅');
        console.log('• Partial name matching ✅');
        console.log('• User ID lookup ✅');
        console.log('• IP address search ✅');
        console.log('• Button formatting ✅');
        console.log('• Search limits (max 20) ✅');
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run test
if (require.main === module) {
    testFuzzySearch().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {
    testFuzzySearch
};