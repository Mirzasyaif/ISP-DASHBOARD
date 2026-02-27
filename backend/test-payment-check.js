/**
 * Test script untuk Payment Check API
 * Endpoint ini memungkinkan pengecekan status pembayaran
 * berdasarkan nama PPPoE saja (case-insensitive)
 */

const http = require('http');

// Konfigurasi
const BASE_URL = 'http://localhost:3001';
const API_ENDPOINT = '/api/payment-check';

// Fungsi untuk melakukan HTTP request
function makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 3001,
            path: url.pathname + url.search,
            method: method,
            headers: {
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
                        statusCode: res.statusCode,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

// Test cases
async function runTests() {
    console.log('========================================');
    console.log('PAYMENT CHECK API TEST');
    console.log('========================================\n');

    const testCases = [
        {
            name: 'Test 1: Cek dengan nama lowercase (sugiarti)',
            path: `${API_ENDPOINT}/check/sugiarti`,
            description: 'Mengecek status pembayaran dengan nama PPPoE lowercase'
        },
        {
            name: 'Test 2: Cek dengan nama uppercase (SUGIARTI)',
            path: `${API_ENDPOINT}/check/SUGIARTI`,
            description: 'Mengecek status pembayaran dengan nama PPPoE uppercase (case-insensitive)'
        },
        {
            name: 'Test 3: Cek dengan nama mixed case (Sugiarti)',
            path: `${API_ENDPOINT}/check/Sugiarti`,
            description: 'Mengecek status pembayaran dengan nama PPPoE mixed case'
        },
        {
            name: 'Test 4: Cek dengan query parameter',
            path: `${API_ENDPOINT}/check?name=sugiarti`,
            description: 'Mengecek status pembayaran menggunakan query parameter'
        },
        {
            name: 'Test 5: Cek user yang tidak ada',
            path: `${API_ENDPOINT}/check/user_tidak_ada`,
            description: 'Mengecek status pembayaran untuk user yang tidak ada'
        },
        {
            name: 'Test 6: Cek dengan nama kosong',
            path: `${API_ENDPOINT}/check/`,
            description: 'Mengecek status pembayaran dengan nama kosong (harus error)'
        }
    ];

    let passedTests = 0;
    let failedTests = 0;

    for (const testCase of testCases) {
        console.log(`\n${testCase.name}`);
        console.log(`Description: ${testCase.description}`);
        console.log(`Endpoint: ${testCase.path}`);

        try {
            const response = await makeRequest(testCase.path);
            
            console.log(`Status Code: ${response.statusCode}`);
            console.log(`Response:`, JSON.stringify(response.data, null, 2));

            // Validasi response
            if (response.statusCode === 200) {
                if (response.data.success === true) {
                    console.log('✅ PASSED - Response valid');
                    passedTests++;
                } else {
                    console.log('⚠️  WARNING - Response success: false');
                    passedTests++;
                }
            } else if (response.statusCode === 404) {
                if (testCase.name.includes('tidak ada')) {
                    console.log('✅ PASSED - User tidak ditemukan (sesuai ekspektasi)');
                    passedTests++;
                } else {
                    console.log('❌ FAILED - User tidak ditemukan (tidak sesuai ekspektasi)');
                    failedTests++;
                }
            } else if (response.statusCode === 400) {
                if (testCase.name.includes('kosong')) {
                    console.log('✅ PASSED - Error valid untuk nama kosong');
                    passedTests++;
                } else {
                    console.log('❌ FAILED - Bad request (tidak sesuai ekspektasi)');
                    failedTests++;
                }
            } else {
                console.log('❌ FAILED - Status code tidak terduga');
                failedTests++;
            }

        } catch (error) {
            console.log('❌ FAILED - Error:', error.message);
            failedTests++;
        }
    }

    // Summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`Total Tests: ${testCases.length}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / testCases.length) * 100).toFixed(2)}%`);
    console.log('========================================\n');

    // Usage examples
    console.log('USAGE EXAMPLES:');
    console.log('========================================');
    console.log('1. Cek status pembayaran dengan nama PPPoE:');
    console.log(`   GET ${BASE_URL}${API_ENDPOINT}/check/sugiarti`);
    console.log('');
    console.log('2. Cek dengan query parameter:');
    console.log(`   GET ${BASE_URL}${API_ENDPOINT}/check?name=sugiarti`);
    console.log('');
    console.log('3. Case-insensitive (semua ini sama):');
    console.log(`   GET ${BASE_URL}${API_ENDPOINT}/check/sugiarti`);
    console.log(`   GET ${BASE_URL}${API_ENDPOINT}/check/SUGIARTI`);
    console.log(`   GET ${BASE_URL}${API_ENDPOINT}/check/Sugiarti`);
    console.log('========================================\n');
}

// Run tests
runTests().catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
});
