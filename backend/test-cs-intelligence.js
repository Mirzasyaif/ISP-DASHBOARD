/**
 * Test CS Intelligence Agent Integration
 */

const { processMessage } = require('/home/mirza/.openclaw/skills/isp-cs-intelligence/agent');

console.log('=== CS Intelligence Agent Test ===\n');

// Test Case 1: Internet lambat (auto-handle)
console.log('Test 1: Internet Lambat (Auto-Handle)');
console.log('Message: "Internet saya lambat banget"');
const result1 = processMessage("Internet saya lambat banget", {
    full_name: "John Doe",
    phone_number: "6281234567890",
    pppoe_username: "user001"
});
console.log('Action:', result1.action);
console.log('Message:', result1.message);
console.log('Analysis:', JSON.stringify(result1.analysis, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// Test Case 2: Internet mati total (escalate)
console.log('Test 2: Internet Mati Total (Escalate)');
console.log('Message: "INTERNET MATI TOTAL SUDAH 2 JAM!!!"');
const result2 = processMessage("INTERNET MATI TOTAL SUDAH 2 JAM!!!", {
    full_name: "Jane Doe",
    phone_number: "6289876543210",
    pppoe_username: "user002"
});
console.log('Action:', result2.action);
console.log('Customer Message:', result2.message.customer);
console.log('Admin Alert:', result2.message.admin);
console.log('Analysis:', JSON.stringify(result2.analysis, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// Test Case 3: Tagihan (auto-handle)
console.log('Test 3: Tagihan (Auto-Handle)');
console.log('Message: "Saya mau cek tagihan"');
const result3 = processMessage("Saya mau cek tagihan", {
    full_name: "Bob Smith",
    phone_number: "6285555555555",
    pppoe_username: "user003"
});
console.log('Action:', result3.action);
console.log('Message:', result3.message);
console.log('Analysis:', JSON.stringify(result3.analysis, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// Test Case 4: Lupa password (escalate)
console.log('Test 4: Lupa Password (Escalate)');
console.log('Message: "Saya lupa password WiFi saya"');
const result4 = processMessage("Saya lupa password WiFi saya", {
    full_name: "Alice Johnson",
    phone_number: "6287777777777",
    pppoe_username: "user004"
});
console.log('Action:', result4.action);
console.log('Customer Message:', result4.message.customer);
console.log('Admin Alert:', result4.message.admin);
console.log('Analysis:', JSON.stringify(result4.analysis, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

console.log('=== Test Complete ===');