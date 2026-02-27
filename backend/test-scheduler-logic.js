// Test scheduler logic without node-cron dependency
const db = require('./models/db');

// Mock sendBillingNotification
const mockSendBillingNotification = async (user, status) => {
    console.log(`[MOCK] Would send ${status} notification to ${user.full_name} (${user.pppoe_username})`);
    console.log(`  Phone: ${user.phone_number || 'No phone'}, Due: ${user.due_date}, Fee: ${user.monthly_fee}`);
    return true;
};

// Utility function from scheduler.js
function getFormattedDate(dateOffsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + dateOffsetDays);
    return date.toISOString().split('T')[0];
}

async function testSchedulerLogic() {
    console.log('Testing scheduler logic...');
    
    try {
        // Initialize database
        await db.initDB();
        console.log('Database initialized');
        
        // Test H-3 (3 days from now)
        const datePlus3 = getFormattedDate(3);
        console.log(`\n=== Testing H-3 (due date: ${datePlus3}) ===`);
        
        const usersHMinus3 = await db.getUsersForDueDate(datePlus3);
        console.log(`Found ${usersHMinus3.length} users for due date ${datePlus3}`);
        
        for (const user of usersHMinus3.slice(0, 3)) { // Limit to 3 for demo
            console.log(`- ${user.full_name} (${user.pppoe_username}): Due ${user.due_date}, Phone: ${user.phone_number || 'N/A'}`);
            await mockSendBillingNotification(user, 'H-3');
        }
        
        // Test H-0 (today)
        const dateToday = getFormattedDate(0);
        console.log(`\n=== Testing H-0 (due date: ${dateToday}) ===`);
        
        const usersToday = await db.getUsersForDueDate(dateToday);
        console.log(`Found ${usersToday.length} users for due date ${dateToday}`);
        
        for (const user of usersToday.slice(0, 3)) { // Limit to 3 for demo
            console.log(`- ${user.full_name} (${user.pppoe_username}): Due ${user.due_date}, Phone: ${user.phone_number || 'N/A'}`);
            await mockSendBillingNotification(user, 'H-0');
        }
        
        console.log('\n✅ Test completed successfully');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        // Close database if needed
        if (db.closeDB) {
            await db.closeDB();
        }
    }
}

// Run test
testSchedulerLogic();