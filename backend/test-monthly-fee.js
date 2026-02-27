#!/usr/bin/env node

/**
 * Test monthly fee updates
 */

const db = require('./models/db');

async function testMonthlyFee() {
    console.log('🧪 Testing Monthly Fee Updates\n');
    
    try {
        await db.initDB();
        console.log(`✅ Database type: ${db.getDatabaseType()}`);
        
        // Get all users
        const users = await db.getAllUsers();
        console.log(`📊 Total users: ${users.length}`);
        
        // Count users with monthly_fee > 0
        const usersWithFee = users.filter(u => u.monthly_fee > 0);
        const usersWithoutFee = users.filter(u => !u.monthly_fee || u.monthly_fee === 0);
        
        console.log(`💰 Users with fee: ${usersWithFee.length}`);
        console.log(`❌ Users without fee: ${usersWithoutFee.length}`);
        
        if (usersWithFee.length > 0) {
            // Show fee statistics
            const totalFee = usersWithFee.reduce((sum, user) => sum + user.monthly_fee, 0);
            const avgFee = Math.round(totalFee / usersWithFee.length);
            const minFee = Math.min(...usersWithFee.map(u => u.monthly_fee));
            const maxFee = Math.max(...usersWithFee.map(u => u.monthly_fee));
            
            console.log(`\n📈 Fee Statistics:`);
            console.log(`   • Total monthly revenue: Rp ${totalFee.toLocaleString('id-ID')}`);
            console.log(`   • Average fee: Rp ${avgFee.toLocaleString('id-ID')}`);
            console.log(`   • Min fee: Rp ${minFee.toLocaleString('id-ID')}`);
            console.log(`   • Max fee: Rp ${maxFee.toLocaleString('id-ID')}`);
            
            // Show sample users
            console.log(`\n👤 Sample users with fees:`);
            usersWithFee.slice(0, 5).forEach(user => {
                console.log(`   • ${user.pppoe_username}: Rp ${user.monthly_fee.toLocaleString('id-ID')}`);
            });
        }
        
        if (usersWithoutFee.length > 0) {
            console.log(`\n⚠️  Users without fee (first 5):`);
            usersWithoutFee.slice(0, 5).forEach(user => {
                console.log(`   • ${user.pppoe_username}: ${user.monthly_fee || 'not set'}`);
            });
        }
        
        // Test search function
        console.log(`\n🔍 Testing searchUsersByNameOrIP:`);
        const searchResults = await db.searchUsersByNameOrIP('a');
        console.log(`   Found ${searchResults.length} users matching "a"`);
        if (searchResults.length > 0) {
            console.log(`   Sample: ${searchResults[0].pppoe_username} (Rp ${searchResults[0].monthly_fee?.toLocaleString('id-ID') || '0'})`);
        }
        
        // Test findUserByNameOrIP
        console.log(`\n🔍 Testing findUserByNameOrIP:`);
        const singleResult = await db.findUserByNameOrIP('a');
        if (singleResult) {
            console.log(`   Found: ${singleResult.pppoe_username} (Rp ${singleResult.monthly_fee?.toLocaleString('id-ID') || '0'})`);
        }
        
        console.log('\n✅ Test completed successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run test
if (require.main === module) {
    testMonthlyFee().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {
    testMonthlyFee
};