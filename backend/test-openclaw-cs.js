const crypto = require('crypto');
const axios = require('axios');

const config = {
    webhookUrl: 'http://localhost:3001/api/openclaw/webhook',
    webhookSecret: 'isp-dashboard-secret-2026',
    testPhoneNumber: '628984850868'
};

function generateSignature(body) {
    return crypto
        .createHmac('sha256', config.webhookSecret)
        .update(body)
        .digest('hex');
}

async function testCommand(command) {
    const payload = {
        type: 'message',
        data: {
            phoneNumber: config.testPhoneNumber,
            messageType: 'text',
            content: command,
            messageId: `test_${Date.now()}`
        }
    };

    const body = JSON.stringify(payload);
    const signature = generateSignature(body);

    console.log(`\n📤 Testing command: ${command}`);
    console.log(`📝 Payload:`, JSON.stringify(payload, null, 2));
    console.log(`🔐 Signature: ${signature}`);

    try {
        const response = await axios.post(config.webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-OpenClaw-Signature': signature
            }
        });

        console.log(`✅ Response:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`❌ Error:`, error.response?.data || error.message);
        return null;
    }
}

async function main() {
    console.log('🧪 OpenClaw CS Test Suite');
    console.log('='.repeat(50));

    const commands = ['MENU', 'INFO', 'CEK', 'RIWAYAT', 'PAKET', 'STATUS', 'TAGIHAN', 'JADWAL'];

    for (const cmd of commands) {
        await testCommand(cmd);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✨ Test completed!');
}

main().catch(console.error);