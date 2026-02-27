#!/usr/bin/env node

/**
 * Script untuk testing smart price parsing
 */

const { parseRupiah, formatRupiah, validatePriceInput } = require('../utils/currencyParser');

console.log('🧪 Testing Smart Price Parser\n');

const testCases = [
    // Format standar
    { input: '150.000', expected: 150000 },
    { input: '150,000', expected: 150000 },
    { input: 'Rp150000', expected: 150000 },
    { input: 'Rp 150.000', expected: 150000 },
    { input: '150 ribu', expected: 150000 },
    
    // Format singkat
    { input: '150k', expected: 150000 },
    { input: '150rb', expected: 150000 },
    { input: '150K', expected: 150000 },
    
    // Format dengan spasi
    { input: '150 000', expected: 150000 },
    { input: 'Rp 150 000', expected: 150000 },
    
    // Format dengan kata
    { input: 'seratus lima puluh ribu', expected: 150000 },
    { input: '150 ribu rupiah', expected: 150000 },
    
    // Format kombinasi
    { input: 'Rp150.000', expected: 150000 },
    { input: 'Rp 150,000', expected: 150000 },
    { input: '150.000 ribu', expected: 150000 },
    
    // Format dengan desimal (jika ada)
    { input: '150.500', expected: 150500 },
    { input: '150,500', expected: 150500 },
    
    // Format besar
    { input: '1.000.000', expected: 1000000 },
    { input: '1 juta', expected: 1000000 },
    { input: '1jt', expected: 1000000 },
    
    // Format campuran
    { input: 'Rp 1.500.000', expected: 1500000 },
    { input: '1,5 juta', expected: 1500000 },
    { input: '1.5jt', expected: 1500000 },
];

console.log('📝 Testing parseRupiah() function:\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    const result = parseRupiah(test.input);
    const formatted = formatRupiah(result);
    const validation = validatePriceInput(test.input);
    
    const isCorrect = result === test.expected;
    const status = isCorrect ? '✅' : '❌';
    
    console.log(`${status} Test ${index + 1}:`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Expected: ${formatRupiah(test.expected)} (${test.expected})`);
    console.log(`   Got: ${formatted} (${result})`);
    console.log(`   Validation: ${validation.valid ? '✅ Valid' : '❌ Invalid'} - ${validation.message}`);
    console.log('');
    
    if (isCorrect) {
        passed++;
    } else {
        failed++;
    }
});

console.log('\n📊 Test Results:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${Math.round((passed / testCases.length) * 100)}%\n`);

// Test edge cases
console.log('🔍 Testing Edge Cases:\n');

const edgeCases = [
    { input: '', expected: 0, description: 'Empty string' },
    { input: 'abc', expected: 0, description: 'Non-numeric string' },
    { input: 'Rp', expected: 0, description: 'Only currency symbol' },
    { input: '0', expected: 0, description: 'Zero' },
    { input: '-150000', expected: 0, description: 'Negative number' },
    { input: '10000000', expected: 10000000, description: '10 million (max test)' },
    { input: '10000001', expected: 10000001, description: 'Above 10 million' },
];

edgeCases.forEach((test) => {
    const result = parseRupiah(test.input);
    const validation = validatePriceInput(test.input);
    
    console.log(`📌 ${test.description}:`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Parsed: ${formatRupiah(result)}`);
    console.log(`   Validation: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
    if (!validation.valid) {
        console.log(`   Message: ${validation.message}`);
    }
    console.log('');
});

// Test formatRupiah function
console.log('💰 Testing formatRupiah() function:\n');

const formatTests = [
    { amount: 150000, expected: 'Rp150.000' },
    { amount: 1500, expected: 'Rp1.500' },
    { amount: 1500000, expected: 'Rp1.500.000' },
    { amount: 0, expected: 'Rp0' },
    { amount: -1000, expected: 'Rp0' },
    { amount: 999999999, expected: 'Rp999.999.999' },
];

formatTests.forEach((test) => {
    const result = formatRupiah(test.amount);
    const isCorrect = result === test.expected;
    const status = isCorrect ? '✅' : '❌';
    
    console.log(`${status} ${formatRupiah(test.amount)}`);
    if (!isCorrect) {
        console.log(`   Expected: ${test.expected}`);
    }
});

console.log('\n🎉 Smart Price Parser Testing Complete!');
console.log('\n📋 Usage in Telegram Bot:');
console.log('1. /bayar username - Smart payment confirmation');
console.log('2. /set_harga username amount - Price correction');
console.log('3. Supports formats: 150.000, 150k, Rp150000, 150rb');