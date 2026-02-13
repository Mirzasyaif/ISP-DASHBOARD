// Test WhatsApp controller implementation
const { sendBillingNotification, getUserPhone } = require('./controllers/whatsappController');

// Test data
const testUsers = [
    {
        pppoe_username: 'TEST001',
        name: 'John Doe',
        full_name: 'John Doe',
        monthly_fee: 150000,
        due_date: '2026-02-10',
        phone_number: '+6281234567890', // Valid WhatsApp number
        phone: null
    },
    {
        pppoe_username: 'TEST002',
        name: 'Jane Smith',
        full_name: null,
        monthly_fee: 200000,
        due_date: '2026-02-07', // Today
        phone_number: null,
        phone: '081234567891' // Local format
    },
    {
        pppoe_username: 'TEST003',
        name: 'No Phone User',
        monthly_fee: 100000,
        due_date: '2026-02-05', // Yesterday
        phone_number: null,
        phone: null
    }
];

async function testWhatsAppController() {
    console.log('Testing WhatsApp Controller...\n');
    
    // Test 1: Test getUserPhone function
    console.log('=== Test 1: Phone number extraction ===');
    testUsers.forEach(user => {
        const phone = getUserPhone(user);
        console.log(`${user.pppoe_username}: ${phone || 'No phone'}`);
    });
    
    console.log('\n=== Test 2: Send notifications (DRY RUN - will not actually send) ===');
    console.log('NOTE: To actually send, remove the return statement in sendBillingNotification\n');
    
    // Dry run: modify sendBillingNotification to not actually send
    // For now, just test the logic
    const statuses = ['H-3', 'H-0', 'D+1'];
    
    for (const user of testUsers) {
        for (const status of statuses) {
            const phone = getUserPhone(user);
            if (phone) {
                console.log(`\n--- Would send ${status} to ${user.name} (${phone}) ---`);
                console.log(`Fee: Rp ${user.monthly_fee}, Due: ${user.due_date}`);
                
                // We'll test actual send for the first user only (to avoid spamming)
                if (user.pppoe_username === 'TEST001') {
                    try {
                        // Comment out actual sending for testing
                        // const result = await sendBillingNotification(user, status);
                        // console.log(`Result: ${result ? 'Success' : 'Failed'}`);
                        console.log(`[DRY RUN] Would send ${status} notification`);
                    } catch (error) {
                        console.error(`Error: ${error.message}`);
                    }
                }
            } else {
                console.log(`\n--- SKIP ${status} for ${user.name}: No phone number ---`);
            }
        }
    }
    
    console.log('\n=== Test 3: Actual send test (comment in code to enable) ===');
    console.log('To actually test sending, edit this test file and uncomment the sendBillingNotification call.');
    
    console.log('\n✅ Test completed (dry run)');
}

// Run test
testWhatsAppController().catch(error => {
    console.error('❌ Test failed:', error);
});