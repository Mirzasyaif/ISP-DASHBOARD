const http = require('http');

// Test API endpoints
const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'test-key'; // This should match your actual API key

const endpoints = [
    { path: '/stats', method: 'GET' },
    { path: '/users', method: 'GET' },
    { path: '/users/with-payment-status', method: 'GET' },
    { path: '/financial-summary', method: 'GET' },
    { path: '/pppoe/secrets', method: 'GET' }
];

async function testEndpoint(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/api${endpoint.path}`,
            method: endpoint.method,
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json'
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        endpoint: endpoint.path,
                        statusCode: res.statusCode,
                        success: res.statusCode === 200,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        endpoint: endpoint.path,
                        statusCode: res.statusCode,
                        success: false,
                        error: 'Invalid JSON response',
                        rawData: data
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject({
                endpoint: endpoint.path,
                error: error.message
            });
        });
        
        req.end();
    });
}

async function runTests() {
    console.log('🌐 Testing API endpoints with SQLite database...\n');
    
    // First, check if server is running
    console.log('1️⃣ Checking if server is running...');
    
    for (const endpoint of endpoints) {
        console.log(`\n🔍 Testing ${endpoint.method} ${endpoint.path}...`);
        try {
            const result = await testEndpoint(endpoint);
            
            if (result.success) {
                console.log(`   ✅ Success (${result.statusCode})`);
                
                // Show some data for stats endpoint
                if (endpoint.path === '/stats') {
                    console.log(`   📊 Stats: ${result.data.totalUsers} users, ${result.data.paidThisMonth} paid`);
                }
                
                // Show some data for financial summary
                if (endpoint.path === '/financial-summary') {
                    console.log(`   💰 Financial: Revenue ${result.data.totalMonthlyRevenue}, Outstanding ${result.data.outstanding}`);
                }
                
                // Show user count
                if (endpoint.path === '/users') {
                    console.log(`   👥 Users: ${Array.isArray(result.data) ? result.data.length : 'N/A'}`);
                }
            } else {
                console.log(`   ❌ Failed (${result.statusCode})`);
                if (result.error) {
                    console.log(`   Error: ${result.error}`);
                }
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.error || error.message}`);
            console.log(`   ℹ️  Make sure the server is running on port 3000`);
            console.log(`   Run: npm start or npm run dev`);
            break;
        }
    }
    
    console.log('\n📋 Summary:');
    console.log('   All API endpoints should be working with SQLite database.');
    console.log('   The /financial-summary endpoint is new and only works with SQLite.');
    console.log('\n🎉 If all tests pass, migration is complete and working!');
}

// Run tests
runTests().catch(console.error);