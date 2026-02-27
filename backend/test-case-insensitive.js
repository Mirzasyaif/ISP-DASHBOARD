/**
 * Test script untuk memastikan semua command CS case-insensitive
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

async function testCommand(command, phoneNumber = "6285236022073") {
    const testData = {
        type: "message",
        data: {
            phoneNumber: phoneNumber,
            messageType: "text",
            content: command,
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
        
        return { success: true, command, response: response.data };
    } catch (error) {
        return { success: false, command, error: error.response?.data || error.message };
    }
}

async function runTests() {
    console.log('=== Testing Case-Insensitive Commands ===\n');
    
    // Test berbagai case untuk setiap command
    const testCases = [
        // MENU
        { command: 'MENU', expected: true },
        { command: 'menu', expected: true },
        { command: 'Menu', expected: true },
        { command: 'mEnU', expected: true },
        { command: 'MENU ', expected: true }, // dengan spasi
        
        // INFO
        { command: 'INFO', expected: true },
        { command: 'info', expected: true },
        { command: 'Info', expected: true },
        
        // CEK
        { command: 'CEK', expected: true },
        { command: 'cek', expected: true },
        { command: 'Cek', expected: true },
        
        // RIWAYAT
        { command: 'RIWAYAT', expected: true },
        { command: 'riwayat', expected: true },
        { command: 'Riwayat', expected: true },
        
        // PAKET
        { command: 'PAKET', expected: true },
        { command: 'paket', expected: true },
        { command: 'Paket', expected: true },
        
        // STATUS
        { command: 'STATUS', expected: true },
        { command: 'status', expected: true },
        { command: 'Status', expected: true },
        
        // TAGIHAN
        { command: 'TAGIHAN', expected: true },
        { command: 'tagihan', expected: true },
        { command: 'Tagihan', expected: true },
        
        // JADWAL
        { command: 'JADWAL', expected: true },
        { command: 'jadwal', expected: true },
        { command: 'Jadwal', expected: true },
        
        // LAPOR
        { command: 'LAPOR internet lambat', expected: true },
        { command: 'lapor internet lambat', expected: true },
        { command: 'Lapor internet lambat', expected: true },
        { command: 'lApOr internet lambat', expected: true },
        
        // HELP (alias untuk MENU)
        { command: 'HELP', expected: true },
        { command: 'help', expected: true },
        { command: 'Help', expected: true },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const result = await testCommand(testCase.command);
        
        if (result.success === testCase.expected) {
            console.log(`✅ PASS: "${testCase.command}"`);
            passed++;
        } else {
            console.log(`❌ FAIL: "${testCase.command}"`);
            console.log(`   Expected: ${testCase.expected}, Got: ${result.success}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            failed++;
        }
        
        // Delay antar test
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total: ${testCases.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed === 0) {
        console.log(`\n🎉 Semua command case-insensitive!`);
    } else {
        console.log(`\n⚠️ Ada ${failed} test yang gagal`);
    }
}

runTests();
