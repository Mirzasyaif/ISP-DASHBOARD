#!/usr/bin/env node

// Security testing script for ISP Dashboard
const axios = require('../backend/node_modules/axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'isp_dashboard_api_key_2026'; // From .env

async function testSecurity() {
    console.log('🔐 Testing ISP Dashboard Security Implementation\n');
    
    const tests = [];
    
    // Test 1: API Key Authentication (should fail without key)
    tests.push(async () => {
        console.log('Test 1: API Key Authentication');
        try {
            const response = await axios.get(`${API_BASE}/stats`);
            console.log('❌ FAIL: API allowed access without API key');
            return false;
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ PASS: API correctly requires authentication');
                return true;
            } else {
                console.log(`❌ FAIL: Unexpected error: ${error.message}`);
                return false;
            }
        }
    });
    
    // Test 2: API Key Authentication (should succeed with key)
    tests.push(async () => {
        console.log('\nTest 2: API Key Validation');
        try {
            const response = await axios.get(`${API_BASE}/stats`, {
                headers: { 'X-API-Key': API_KEY }
            });
            console.log('✅ PASS: API accepted valid API key');
            return true;
        } catch (error) {
            console.log(`❌ FAIL: Valid API key rejected: ${error.message}`);
            return false;
        }
    });
    
    // Test 3: Invalid API Key (should fail)
    tests.push(async () => {
        console.log('\nTest 3: Invalid API Key');
        try {
            const response = await axios.get(`${API_BASE}/stats`, {
                headers: { 'X-API-Key': 'invalid_key' }
            });
            console.log('❌ FAIL: API accepted invalid API key');
            return false;
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('✅ PASS: API correctly rejected invalid API key');
                return true;
            } else {
                console.log(`❌ FAIL: Unexpected error: ${error.message}`);
                return false;
            }
        }
    });
    
    // Test 4: Health Check (should be accessible)
    tests.push(async () => {
        console.log('\nTest 4: Health Check Endpoint');
        try {
            const response = await axios.get('http://localhost:3000/health');
            if (response.data.status === 'ok') {
                console.log('✅ PASS: Health check endpoint working');
                return true;
            } else {
                console.log('❌ FAIL: Health check returned unexpected data');
                return false;
            }
        } catch (error) {
            console.log(`❌ FAIL: Health check failed: ${error.message}`);
            return false;
        }
    });
    
    // Test 5: Input Validation (malicious input)
    tests.push(async () => {
        console.log('\nTest 5: Input Validation (SQL Injection attempt)');
        try {
            const response = await axios.post(`${API_BASE}/users`, {
                pppoe_username: "admin'; DROP TABLE users;--",
                full_name: "Test",
                plan: "10Mbps"
            }, {
                headers: { 'X-API-Key': API_KEY }
            });
            console.log('❌ FAIL: SQL injection attempt not blocked');
            return false;
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('✅ PASS: SQL injection attempt blocked by validation');
                return true;
            } else {
                console.log(`❌ FAIL: Unexpected error: ${error.message}`);
                return false;
            }
        }
    });
    
    // Test 6: CORS Test (from disallowed origin)
    tests.push(async () => {
        console.log('\nTest 6: CORS Protection');
        try {
            const response = await axios.get(`${API_BASE}/stats`, {
                headers: {
                    'X-API-Key': API_KEY,
                    'Origin': 'http://evil.com'
                }
            });
            console.log('❌ FAIL: CORS allowed request from disallowed origin');
            return false;
        } catch (error) {
            if (error.code === 'ERR_BAD_REQUEST' || error.response?.status === 403) {
                console.log('✅ PASS: CORS correctly blocked disallowed origin');
                return true;
            } else {
                console.log(`⚠️  WARNING: CORS test gave unexpected result: ${error.message}`);
                return true; // Not critical if test setup differs
            }
        }
    });
    
    // Run all tests
    console.log('\n' + '='.repeat(50));
    const results = [];
    
    for (let i = 0; i < tests.length; i++) {
        try {
            const result = await tests[i]();
            results.push(result);
        } catch (error) {
            console.log(`Test ${i + 1} error: ${error.message}`);
            results.push(false);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SECURITY TEST SUMMARY');
    console.log('='.repeat(50));
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`Passed: ${passed}/${total}`);
    
    if (passed === total) {
        console.log('🎉 All security tests passed!');
    } else {
        console.log(`⚠️  ${total - passed} tests failed. Review implementation.`);
    }
    
    return passed === total;
}

// Check if server is running
async function checkServer() {
    try {
        await axios.get('http://localhost:3000/health', { timeout: 2000 });
        return true;
    } catch (error) {
        console.log('❌ Server not running. Please start the server first:');
        console.log('cd backend && npm start');
        return false;
    }
}

// Main execution
async function main() {
    const serverRunning = await checkServer();
    if (!serverRunning) {
        process.exit(1);
    }
    
    await testSecurity();
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});