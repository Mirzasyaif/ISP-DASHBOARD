const { sendBillingNotification } = require('./controllers/whatsappGowaController');

// Test user data
const testUser = {
    pppoe_username: 'test_user',
    full_name: 'Mirza Maulana',
    phone_number: '6285236022073',
    monthly_fee: 150000,
    due_date: '2026-02-28',
    status: 'active'
};

async function testNotification() {
    console.log('=== Testing Billing Notification ===\n');
    console.log('Sending to:', testUser.phone_number);
    console.log('User:', testUser.full_name);
    console.log('Amount:', testUser.monthly_fee);
    console.log('Due Date:', testUser.due_date);
    console.log('\n--- Sending H-3 Notification ---\n');
    
    try {
        const result = await sendBillingNotification(testUser, 'H-3');
        if (result) {
            console.log('✅ Notification sent successfully!');
        } else {
            console.log('❌ Failed to send notification');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testNotification();