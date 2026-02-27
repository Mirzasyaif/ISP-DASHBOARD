const axios = require('axios');

require('dotenv').config();

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:8080';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

console.log('🧪 TEST OPENCLAW SEND API');
console.log('=========================\n');

async function testSendAPI(endpoint, payload) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (OPENCLAW_API_KEY) {
            headers['Authorization'] = `Bearer ${OPENCLAW_API_KEY}`;
        }
        
        console.log(`📤 Testing: ${endpoint}`);
        console.log(`   Payload:`, JSON.stringify(payload, null, 2));
        
        const response = await axios.post(
            `${OPENCLAW_API_URL}${endpoint}`,
            payload,
            { headers, timeout: 10000 }
        );
        
        console.log(`✅ SUCCESS`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        
        if (response.headers['content-type']?.includes('application/json')) {
            console.log(`   Response:`, JSON.stringify(response.data, null, 2));
        } else {
            console.log(`   Response: (HTML/Text)`);
        }
        
        return { success: true, data: response.data };
    } catch (error) {
        console.log(`❌ FAILED`);
        console.log(`   Error: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data:`, error.response.data);
        }
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('📌 Konfigurasi:');
    console.log(`   URL: ${OPENCLAW_API_URL}`);
    console.log(`   API Key: ${OPENCLAW_API_KEY ? '✅' : '❌'}\n`);
    
    // Test berbagai endpoint dan payload yang mungkin
    const testCases = [
        {
            endpoint: '/api/messages/send',
            payload: {
                channel: 'whatsapp',
                recipient: '+6285749556441',
                content: 'Test pesan dari ISP Dashboard'
            }
        },
        {
            endpoint: '/api/send',
            payload: {
                channel: 'whatsapp',
                recipient: '+6285749556441',
                content: 'Test pesan dari ISP Dashboard'
            }
        },
        {
            endpoint: '/messages/send',
            payload: {
                channel: 'whatsapp',
                recipient: '+6285749556441',
                content: 'Test pesan dari ISP Dashboard'
            }
        },
        {
            endpoint: '/send',
            payload: {
                channel: 'whatsapp',
                recipient: '+6285749556441',
                content: 'Test pesan dari ISP Dashboard'
            }
        },
        {
            endpoint: '/api/v1/messages',
            payload: {
                channel: 'whatsapp',
                recipient: '+6285749556441',
                content: 'Test pesan dari ISP Dashboard'
            }
        },
        {
            endpoint: '/api/v1/send',
            payload: {
                channel: 'whatsapp',
                recipient: '+6285749556441',
                content: 'Test pesan dari ISP Dashboard'
            }
        },
        {
            endpoint: '/gateway/send',
            payload: {
                channel: 'whatsapp',
                recipient: '+6285749556441',
                content: 'Test pesan dari ISP Dashboard'
            }
        },
        {
            endpoint: '/api/gateway/send',
            payload: {
                channel: 'whatsapp',
                recipient: '+6285749556441',
                content: 'Test pesan dari ISP Dashboard'
            }
        }
    ];
    
    let successCount = 0;
    
    for (const testCase of testCases) {
        console.log('\n' + '='.repeat(50));
        const result = await testSendAPI(testCase.endpoint, testCase.payload);
        if (result.success) {
            successCount++;
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 HASIL: ${successCount}/${testCases.length} endpoint berhasil`);
    
    if (successCount === 0) {
        console.log('\n⚠️  Tidak ada endpoint yang berhasil!');
        console.log('💡 Rekomendasi:');
        console.log('   1. Cek dokumentasi OpenClaw untuk endpoint yang benar');
        console.log('   2. Gunakan WAHA sebagai alternatif (sudah disiapkan)');
        console.log('   3. Cek apakah perlu install OpenClaw Gateway terpisah');
    } else {
        console.log('\n✅ Ditemukan endpoint yang berhasil!');
        console.log('💡 Gunakan endpoint tersebut untuk mengirim pesan');
    }
}

main();
