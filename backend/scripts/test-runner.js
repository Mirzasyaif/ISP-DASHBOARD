#!/usr/bin/env node

/**
 * Simple Test Runner for ISP Dashboard
 * Run tests without full Jest installation
 */

console.log('📋 ISP Dashboard Test Runner\n');

const tests = [
  {
    name: 'Currency Parser Tests',
    file: '../utils/currencyParser.js',
    tests: [
      () => {
        const { parseRupiah, formatRupiah } = require('../utils/currencyParser');
        const result = parseRupiah('150.000');
        return result === 150000 ? '✅ PASS' : `❌ FAIL: got ${result}`;
      },
      () => {
        const { parseRupiah } = require('../utils/currencyParser');
        const result = parseRupiah('150k');
        return result === 150000 ? '✅ PASS' : `❌ FAIL: got ${result}`;
      },
      () => {
        const { formatRupiah } = require('../utils/currencyParser');
        const result = formatRupiah(150000);
        return result === 'Rp150.000' ? '✅ PASS' : `❌ FAIL: got "${result}"`;
      }
    ]
  },
  {
    name: 'Database Function Tests',
    file: '../models/simple-db.js',
    tests: [
      () => {
        try {
          const { getClients } = require('../models/simple-db');
          const clients = getClients();
          return Array.isArray(clients) ? '✅ PASS' : '❌ FAIL: not array';
        } catch (error) {
          return `❌ ERROR: ${error.message}`;
        }
      }
    ]
  }
];

let passed = 0;
let failed = 0;

tests.forEach(testSuite => {
  console.log(`\n🧪 ${testSuite.name}`);
  console.log(`📄 File: ${testSuite.file}`);
  
  testSuite.tests.forEach((testFunc, index) => {
    try {
      const result = testFunc();
      console.log(`  Test ${index + 1}: ${result}`);
      if (result.startsWith('✅')) passed++;
      else failed++;
    } catch (error) {
      console.log(`  Test ${index + 1}: ❌ ERROR: ${error.message}`);
      failed++;
    }
  });
});

console.log('\n📊 Summary:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!');
} else {
  console.log('\n⚠️ Some tests failed.');
}

// Also check if Jest is available
console.log('\n🔧 Test Framework Status:');
try {
  require.resolve('jest');
  console.log('✅ Jest framework available');
} catch {
  console.log('⚠️ Jest not installed. To install: npm install --save-dev jest supertest');
}

console.log('\n📋 Next Steps:');
console.log('1. Install Jest: npm install --save-dev jest supertest');
console.log('2. Run tests: npm test');
console.log('3. Add more test files in __tests__/ directory');