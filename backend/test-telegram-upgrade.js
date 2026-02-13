#!/usr/bin/env node
/**
 * Test script for Telegram Bot Pro UX Upgrade
 */

const { parseRupiah, formatRupiah, validatePriceInput } = require('./utils/currencyParser');

console.log('🔍 Testing Telegram Bot Pro UX Upgrade\n');

// Test 1: Currency Parsing
console.log('💰 Test 1: Currency Parsing');
const testCases = [
    '150.000',
    '150k',
    '150K',
    'Rp150000',
    '150rb',
    '150 ribu',
    'Rp 150.000',
    '1.500.000',
    '2,500k',
    'invalid'
];

testCases.forEach(test => {
    const parsed = parseRupiah(test);
    const formatted = formatRupiah(parsed);
    const validation = validatePriceInput(test);
    
    console.log(`  "${test}" → ${parsed} → ${formatted}`);
    console.log(`    Valid: ${validation.valid}, Message: ${validation.message}`);
});

// Test 2: Database functions (simulated)
console.log('\n🗄️ Test 2: Database Interface');
const db = require('./models/db');

console.log(`  Database type: ${db.getDatabaseType()}`);
console.log(`  Functions available:`);
console.log(`    - searchUsersByNameOrIP: ${typeof db.searchUsersByNameOrIP === 'function' ? '✅' : '❌'}`);
console.log(`    - createOrUpdateUser: ${typeof db.createOrUpdateUser === 'function' ? '✅' : '❌'}`);
console.log(`    - getOperationalExpenses: ${typeof db.getOperationalExpenses === 'function' ? '✅' : '❌'}`);
console.log(`    - addOperationalExpense: ${typeof db.addOperationalExpense === 'function' ? '✅' : '❌'}`);

// Test 3: Command validation
console.log('\n🤖 Test 3: Command Structure');
const commands = [
    { command: 'keuangan', description: 'Cek laporan pendapatan & profit' },
    { command: 'tagihan', description: 'List client yang belum bayar' },
    { command: 'bayar', description: 'Input pembayaran (Auto-Search)' },
    { command: 'import_clients', description: 'Import data massal' },
    { command: 'set_harga', description: 'Koreksi harga bulanan client' },
    { command: 'catat_keluar', description: 'Catat pengeluaran operasional' },
    { command: 'start', description: 'Menu utama bot' },
    { command: 'status', description: 'Status dashboard' },
    { command: 'userinfo', description: 'Informasi user' }
];

commands.forEach(cmd => {
    console.log(`  /${cmd.command.padEnd(15)} - ${cmd.description}`);
});

// Test 4: Import format validation
console.log('\n📥 Test 4: Import Format Examples');
const importExamples = [
    'Budi, 1.1.1.1, 150k',
    'Susi, 2.2.2.2, 200.000',
    'Joko, 3.3.3.3, 250rb',
    'Invalid IP, 999.999.999.999, 100k',
    'Missing fee, 4.4.4.4,'
];

importExamples.forEach(example => {
    const parts = example.split(',').map(p => p.trim());
    const ipValid = parts[1] ? /^(\d{1,3}\.){3}\d{1,3}$/.test(parts[1]) : false;
    const feeValid = parts[2] ? parseRupiah(parts[2]) > 0 : false;
    
    console.log(`  "${example}"`);
    console.log(`    IP valid: ${ipValid ? '✅' : '❌'}, Fee valid: ${feeValid ? '✅' : '❌'}`);
});

// Test 5: Expense categories
console.log('\n💸 Test 5: Expense Categories');
const categories = ['listrik', 'internet', 'sewa', 'gaji', 'perawatan', 'lainnya'];
categories.forEach(cat => {
    console.log(`  ${cat}`);
});

console.log('\n🎉 Upgrade Testing Complete!');
console.log('\n📋 Next Steps:');
console.log('1. Restart the server: npm start');
console.log('2. Check bot status: GET /api/telegram/status');
console.log('3. Test currency parsing: GET /api/telegram/test-currency?text=150k');
console.log('4. Open Telegram and type /start to see new command menu');