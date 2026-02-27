const db = require('./models/db-sqlite');
const { sendPaymentConfirmation } = require('./controllers/whatsappController');
const whatsappState = require('./utils/whatsappState');

(async () => {
    try {
        console.log('=== WhatsApp Notification Test for CEPI ===\n');
        
        // Initialize database
        await db.initDB();
        
        // Check WhatsApp state
        console.log('1. WhatsApp State:');
        console.log('   Enabled:', whatsappState.isEnabled());
        console.log('   Status:', whatsappState.getStatusString());
        console.log('   State:', JSON.stringify(whatsappState.getState(), null, 2));
        console.log();
        
        // Get user data
        console.log('2. User Data:');
        const user = await db.getClientByUsername('CEPI');
        if (!user) {
            console.log('   ❌ User CEPI not found!');
            await db.closeDB();
            return;
        }
        console.log('   Username:', user.pppoe_username);
        console.log('   Full Name:', user.full_name || user.name);
        console.log('   Phone:', user.phone);
        console.log('   Phone Number:', user.phone_number);
        console.log('   Monthly Fee:', user.monthly_fee);
        console.log();
        
        // Test phone number formatting
        console.log('3. Phone Number Formatting:');
        const phone = user.phone_number || user.phone;
        console.log('   Raw phone:', phone);
        
        let targetPhone = phone.trim();
        if (targetPhone.startsWith('0')) {
            targetPhone = '+62' + targetPhone.substring(1);
        } else if (targetPhone.startsWith('62')) {
            targetPhone = '+' + targetPhone;
        } else if (!targetPhone.startsWith('+')) {
            targetPhone = '+62' + targetPhone;
        }
        console.log('   Formatted phone:', targetPhone);
        console.log();
        
        // Test sending WhatsApp notification
        console.log('4. Testing WhatsApp Notification:');
        const paymentData = {
            amount: user.monthly_fee,
            month_year: new Date().toISOString().slice(0, 7),
            payment_method: 'telegram',
            transaction_id: 'TEST-' + Date.now()
        };
        
        console.log('   Payment Data:', JSON.stringify(paymentData, null, 2));
        console.log('   Sending...');
        
        const result = await sendPaymentConfirmation(user, paymentData);
        
        console.log();
        console.log('5. Result:');
        console.log('   Success:', result);
        
        if (result) {
            console.log('   ✅ WhatsApp notification sent successfully!');
        } else {
            console.log('   ❌ WhatsApp notification failed!');
            console.log('   Check the logs above for detailed error messages.');
        }
        
        await db.closeDB();
    } catch (error) {
        console.error('Error:', error);
        await db.closeDB();
    }
})();
