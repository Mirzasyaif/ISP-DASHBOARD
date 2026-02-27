const axios = require('axios');

require('dotenv').config();

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:8080';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

console.log('🧪 TEST OPENCLAW API ENDPOINTS');
console.log('================================\n');

async function testEndpoint(endpoint, method = 'GET', data = null) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (OPENCLAW_API_KEY) {
            headers['Authorization'] = `Bearer ${OPENCLAW_API_KEY}`;
        }
        
        const config = {
            headers,
            timeout: 5000
        };
        
        let response;
        if (method === 'POST') {
            response = await axios.post(`${OPENCLAW_API_URL}${endpoint}`, data, config);
        } else {
            response = await axios.get(`${OPENCLAW_API_URL}${endpoint}`, config);
        }
        
        console.log(`✅ ${method} ${endpoint}`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        
        // Cek jika response adalah JSON
        if (response.headers['content-type']?.includes('application/json')) {
            console.log(`   Response:`, JSON.stringify(response.data, null, 2));
        } else {
            console.log(`   Response: (HTML/Text, length: ${response.data?.length || 0})`);
        }
        
        return { success: true, data: response.data };
    } catch (error) {
        console.log(`❌ ${method} ${endpoint}`);
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
    
    // Test berbagai endpoint yang mungkin
    const endpoints = [
        { path: '/api/health', method: 'GET' },
        { path: '/api/status', method: 'GET' },
        { path: '/api/sessions', method: 'GET' },
        { path: '/api/messages', method: 'GET' },
        { path: '/messages', method: 'GET' },
        { path: '/api/send', method: 'POST', data: {
            channel: 'whatsapp',
            recipient: '+6285749556441',
            content: 'Test pesan dari ISP Dashboard'
        }},
        { path: '/messages', method: 'POST', data: {
            channel: 'whatsapp',
            recipient: '+6285749556441',
            content: 'Test pesan dari ISP Dashboard'
        }}
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\n🔍 Testing: ${endpoint.method} ${endpoint.path}`);
        await testEndpoint(endpoint.path, endpoint.method, endpoint.data);
    }
    
    console.log('\n================================');
    console.log('📋 TEST SELESAI');
    console.log('================================\n');
    console.log('💡 Catatan:');
    console.log('   - Cari endpoint yang mengembalikan JSON response');
    console.log('   - Endpoint yang berhasil akan digunakan untuk mengirim pesan');
}

main();
