// Test actual WhatsApp sending
const { sendBillingNotification } = require('./controllers/whatsappGowaController');

// Test user data (using your number for testing)
const testUser = {
    pppoe_username: 'TEST_ACTUAL',
    name: 'Admin Test',
    full_name: 'Admin Mahapta Net',
    monthly_fee: 150000,
    due_date: '2026-02-10',
    phone_number: '+6285236022073', // Your number for testing
    phone: null
};

async function testActualSend() {
    console.log('Testing actual WhatsApp sending...');
    console.log(`Target: ${testUser.phone_number}`);
    console.log(`User: ${testUser.full_name}`);
    
    try {
        // Test H-3 notification
        console.log('\n=== Sending H-3 notification ===');
        const resultH3 = await sendBillingNotification(testUser, 'H-3');
        console.log(`H-3 result: ${resultH3 ? '✅ Success' : '❌ Failed'}`);
        
        // Wait 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test H-0 notification
        console.log('\n=== Sending H-0 notification ===');
        const resultH0 = await sendBillingNotification(testUser, 'H-0');
        console.log(`H-0 result: ${resultH0 ? '✅ Success' : '❌ Failed'}`);
        
        // Wait 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test D+1 notification
        console.log('\n=== Sending D+1 notification ===');
        const resultD1 = await sendBillingNotification(testUser, 'D+1');
        console.log(`D+1 result: ${resultD1 ? '✅ Success' : '❌ Failed'}`);
        
        console.log('\n=== Summary ===');
        console.log(`Total sent: ${[resultH3, resultH0, resultD1].filter(Boolean).length}/3`);
        
        if (resultH3 && resultH0 && resultD1) {
            console.log('✅ All tests passed! WhatsApp controller is working.');
        } else {
            console.log('⚠️ Some tests failed. Check logs above.');
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error(error.stack);
    }
}

// Run test
testActualSend().catch(error => {
    console.error('Unhandled error:', error);
});