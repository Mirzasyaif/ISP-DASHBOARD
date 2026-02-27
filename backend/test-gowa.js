require('dotenv').config();
const { sendWhatsAppMessage, sendBillingNotification, sendPaymentConfirmation } = require('./controllers/whatsappGowaController');

// Test configuration
const TEST_PHONE = process.env.TEST_PHONE || '+6285236022073'; // Default to admin phone

console.log('='.repeat(60));
console.log('GOWA Integration Test');
console.log('='.repeat(60));
console.log(`GOWA API URL: ${process.env.GOWA_API_URL}`);
console.log(`GOWA Session: ${process.env.GOWA_SESSION_NAME}`);
console.log(`Test Phone: ${TEST_PHONE}`);
console.log('='.repeat(60));

// Test 1: Send simple text message
async function testSimpleMessage() {
    console.log('\n[TEST 1] Sending simple text message...');
    try {
        const result = await sendWhatsAppMessage(
            TEST_PHONE,
            '🧪 *Test Message from ISP Dashboard*\n\nIni adalah test pesan dari GOWA integration. Jika Anda menerima pesan ini, integrasi berhasil!'
        );
        if (result) {
            console.log('✅ Test 1 PASSED: Simple message sent successfully');
        } else {
            console.log('❌ Test 1 FAILED: Could not send simple message');
        }
        return result;
    } catch (error) {
        console.error('❌ Test 1 ERROR:', error.message);
        return false;
    }
}

// Test 2: Send billing notification (H-3)
async function testBillingNotification() {
    console.log('\n[TEST 2] Sending billing notification (H-3)...');
    try {
        const testUser = {
            pppoe_username: 'test_user',
            full_name: 'Test User',
            phone_number: TEST_PHONE.replace('+', ''), // Remove + for phone_number field
            monthly_fee: 150000,
            due_date: '2026-02-27'
        };
        
        const result = await sendBillingNotification(testUser, 'H-3');
        if (result) {
            console.log('✅ Test 2 PASSED: Billing notification sent successfully');
        } else {
            console.log('❌ Test 2 FAILED: Could not send billing notification');
        }
        return result;
    } catch (error) {
        console.error('❌ Test 2 ERROR:', error.message);
        return false;
    }
}

// Test 3: Send payment confirmation
async function testPaymentConfirmation() {
    console.log('\n[TEST 3] Sending payment confirmation...');
    try {
        const testUser = {
            pppoe_username: 'test_user',
            full_name: 'Test User',
            phone_number: TEST_PHONE.replace('+', '')
        };
        
        const testPayment = {
            amount: 150000,
            month_year: 'Februari 2026',
            payment_method: 'Transfer Bank BCA',
            transaction_id: 'TEST-001'
        };
        
        const result = await sendPaymentConfirmation(testUser, testPayment);
        if (result) {
            console.log('✅ Test 3 PASSED: Payment confirmation sent successfully');
        } else {
            console.log('❌ Test 3 FAILED: Could not send payment confirmation');
        }
        return result;
    } catch (error) {
        console.error('❌ Test 3 ERROR:', error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('\n🚀 Starting GOWA integration tests...\n');
    
    const results = {
        test1: await testSimpleMessage(),
        test2: await testBillingNotification(),
        test3: await testPaymentConfirmation()
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Test 1 (Simple Message): ${results.test1 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 2 (Billing Notification): ${results.test2 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 3 (Payment Confirmation): ${results.test3 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('='.repeat(60));
    
    const allPassed = Object.values(results).every(r => r === true);
    if (allPassed) {
        console.log('\n🎉 All tests PASSED! GOWA integration is working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Please check the error messages above.');
        console.log('\nTroubleshooting tips:');
        console.log('1. Make sure GOWA service is running on your VPS');
        console.log('2. Check GOWA_API_URL in .env file');
        console.log('3. Verify GOWA_SESSION_NAME matches your session name');
        console.log('4. Ensure the WhatsApp session is connected in GOWA');
    }
    
    process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
    console.error('\n❌ Fatal error running tests:', error);
    process.exit(1);
});
