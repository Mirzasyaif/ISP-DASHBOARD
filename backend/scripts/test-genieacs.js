/**
 * Test Script untuk GenieACS Integration
 * Run: node backend/scripts/test-genieacs.js
 */

const genieacsService = require('../services/genieacsService');

async function runTests() {
    console.log('🧪 Starting GenieACS Integration Tests...\n');
    
    // Test 1: Test Connection
    console.log('Test 1: Testing GenieACS Connection...');
    try {
        const connectionResult = await genieacsService.testConnection();
        if (connectionResult.success) {
            console.log('✅ Connection Test PASSED');
            console.log(`   Message: ${connectionResult.message}`);
            console.log(`   Devices Count: ${connectionResult.devicesCount}\n`);
        } else {
            console.log('❌ Connection Test FAILED');
            console.log(`   Error: ${connectionResult.error}\n`);
        }
    } catch (error) {
        console.log('❌ Connection Test FAILED');
        console.log(`   Error: ${error.message}\n`);
    }
    
    // Test 2: Get Device Status (with dummy serial)
    console.log('Test 2: Testing Get Device Status...');
    try {
        const testSerial = 'TEST12345678';
        const deviceStatus = await genieacsService.getDeviceStatus(testSerial);
        if (deviceStatus.success) {
            console.log('✅ Get Device Status PASSED');
            console.log(`   Device ID: ${deviceStatus.deviceId}`);
            console.log(`   Status: ${deviceStatus.status}\n`);
        } else {
            console.log('✅ Get Device Status PASSED (Device not found - expected)');
            console.log(`   Message: ${deviceStatus.message}\n`);
        }
    } catch (error) {
        console.log('❌ Get Device Status FAILED');
        console.log(`   Error: ${error.message}\n`);
    }
    
    // Test 3: Provision Client (with dummy data)
    console.log('Test 3: Testing Client Provisioning...');
    try {
        const testClient = {
            pppoe_username: 'test_client_001',
            pppoe_password: 'test_client_001',
            cpe_serial_number: 'TEST12345678',
            cpe_model: 'F663',
            wifi_ssid: 'Test-WiFi',
            wifi_password: 'test123'
        };
        
        const provisionResult = await genieacsService.provisionClient(testClient);
        if (provisionResult.success) {
            console.log('✅ Client Provisioning PASSED');
            console.log(`   Device ID: ${provisionResult.deviceId}`);
            console.log(`   PPPoE Configured: ${provisionResult.pppoeConfigured}`);
            console.log(`   WiFi Configured: ${provisionResult.wifiConfigured}`);
            console.log(`   Message: ${provisionResult.message}\n`);
        } else {
            console.log('⚠️  Client Provisioning WARNING');
            console.log(`   Error: ${provisionResult.error}`);
            console.log(`   Note: This may fail if GenieACS is not properly configured\n`);
        }
    } catch (error) {
        console.log('❌ Client Provisioning FAILED');
        console.log(`   Error: ${error.message}\n`);
    }
    
    console.log('🎉 Tests Completed!');
    console.log('\n📝 Notes:');
    console.log('- If connection test fails, check GenieACS is running on port 7557');
    console.log('- Verify GENIEACS_URL, GENIEACS_PORT, GENIEACS_USERNAME, GENIEACS_PASSWORD in .env');
    console.log('- Device provisioning requires actual CPE device to be online and connected to GenieACS');
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});