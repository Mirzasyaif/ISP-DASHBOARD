const axios = require('axios');
require('dotenv').config();

const openclawConfig = {
    apiKey: process.env.OPENCLAW_API_KEY,
    apiUrl: process.env.OPENCLAW_API_URL || 'http://127.0.0.1:18789',
    phoneNumber: process.env.OPENCLAW_PHONE_NUMBER,
    adminPhone: process.env.ADMIN_PHONE_NUMBER
};

console.log('='.repeat(60));
console.log('OPENCLAW WEBHOOK DIAGNOSTIC TOOL');
console.log('='.repeat(60));
console.log();

// Step 1: Check OpenClaw API connection
console.log('📡 Step 1: Checking OpenClaw API connection...');
console.log(`   API URL: ${openclawConfig.apiUrl}`);
console.log(`   API Key: ${openclawConfig.apiKey ? openclawConfig.apiKey.substring(0, 10) + '...' : 'NOT SET'}`);
console.log();

// Step 2: Check current webhook configuration
console.log('📡 Step 2: Checking current webhook configuration...');
console.log('   NOTE: You need to manually check your OpenClaw dashboard');
console.log('   Expected webhook URL: http://YOUR_SERVER_IP:3001/api/openclaw/webhook');
console.log();

// Step 3: Test sending a message
console.log('📡 Step 3: Testing message sending capability...');
async function testSendMessage() {
    try {
        const testMessage = `🧪 *TEST MESSAGE*\n\nThis is a test from ISP Dashboard.\n\nIf you receive this, the API connection is working!`;
        
        const response = await axios.post(
            `${openclawConfig.apiUrl}/messages`,
            {
                channel: 'whatsapp',
                recipient: openclawConfig.adminPhone,
                content: testMessage
            },
            {
                headers: {
                    'Authorization': `Bearer ${openclawConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        console.log('   ✅ Message sent successfully!');
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
        console.log('   ❌ Failed to send message');
        console.log(`   Error: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
}

// Step 4: Display webhook setup instructions
console.log();
console.log('📡 Step 4: WEBHOOK SETUP INSTRUCTIONS');
console.log('='.repeat(60));
console.log();
console.log('To fix the CS not responding to MENU command:');
console.log();
console.log('1. Login to your OpenClaw dashboard');
console.log('2. Go to Settings → Webhooks');
console.log('3. Add/Update webhook URL:');
console.log(`   URL: http://YOUR_PUBLIC_IP:3001/api/openclaw/webhook`);
console.log('   Secret: isp-dashboard-secret-2026');
console.log('   Events: message, approval_response');
console.log();
console.log('4. Make sure your backend server is running:');
console.log('   cd backend && npm start');
console.log();
console.log('5. Test by sending "MENU" to your CS number');
console.log('   Expected response: CS menu with options');
console.log();
console.log('='.repeat(60));
console.log();

// Run the test
testSendMessage().then(() => {
    console.log();
    console.log('✅ Diagnostic complete!');
    console.log();
}).catch(err => {
    console.error('❌ Diagnostic failed:', err.message);
});
