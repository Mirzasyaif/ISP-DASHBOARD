/**
 * Test script untuk OpenClaw webhook dengan signature yang valid
 */

const crypto = require('crypto');
const axios = require('axios');

const webhookSecret = process.env.OPENCLAW_WEBHOOK_SECRET || 'isp-dashboard-secret-2026';
const webhookUrl = 'http://localhost:3001/api/openclaw/webhook';

function generateSignature(body) {
    return crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');
}

async function testWebhook() {
    const testData = {
        type: "message",
        data: {
            phoneNumber: "6285236022073",
            messageType: "text",
            content: "MENU",
            messageId: "test_123"
        }
    };
    
    const body = JSON.stringify(testData);
    const signature = generateSignature(body);
    
    console.log('Testing OpenClaw Webhook...');
    console.log('Body:', body);
    console.log('Signature:', signature);
    console.log('\nSending request...\n');
    
    try {
        const response = await axios.post(webhookUrl, testData, {
            headers: {
                'Content-Type': 'application/json',
                'X-OpenClaw-Signature': signature
            }
        });
        
        console.log('✅ Success!');
        console.log('Response:', response.data);
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

// Test different commands
async function testCommands() {
    const commands = ['MENU', 'INFO', 'CEK', 'RIWAYAT', 'PAKET', 'STATUS', 'TAGIHAN', 'JADWAL'];
    
    for (const cmd of commands) {
        console.log(`\n=== Testing command: ${cmd} ===`);
        
        const testData = {
            type: "message",
            data: {
                phoneNumber: "6285236022073",
                messageType: "text",
                content: cmd,
                messageId: `test_${Date.now()}`
            }
        };
        
        const body = JSON.stringify(testData);
        const signature = generateSignature(body);
        
        try {
            const response = await axios.post(webhookUrl, testData, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-OpenClaw-Signature': signature
                }
            });
            
            console.log(`✅ ${cmd}: Success`);
        } catch (error) {
            console.error(`❌ ${cmd}:`, error.response?.data || error.message);
        }
        
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// Run tests
if (process.argv[2] === 'all') {
    testCommands();
} else {
    testWebhook();
}