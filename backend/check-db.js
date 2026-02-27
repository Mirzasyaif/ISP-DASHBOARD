const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');
console.log('Opening database:', dbPath);

const db = new Database(dbPath);

console.log('=== TABLES ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log(' -', t.name));

console.log('\n=== CLIENTS (first 5) ===');
const clients = db.prepare('SELECT id, name, monthly_fee, last_paid_month FROM clients LIMIT 5').all();
clients.forEach(c => console.log(` ${c.id} | ${c.name} | fee: ${c.monthly_fee} | last_paid: ${c.last_paid_month}`));

console.log('\n=== PAYMENTS ===');
const payments = db.prepare('SELECT id, user_id, month_year, amount, status FROM payments').all();
payments.forEach(p => console.log(` ${p.id} | user: ${p.user_id} | ${p.month_year} | amount: ${p.amount} | ${p.status}`));

console.log('\n=== TRANSACTIONS (expenses/income) ===');
const transactions = db.prepare('SELECT id, type, amount, category, date FROM transactions').all();
transactions.forEach(t => console.log(` ${t.id} | ${t.type} | ${t.amount} | ${t.category} | ${t.date}`));

console.log('\n=== SUMMARY ===');
console.log('Total clients:', db.prepare('SELECT COUNT(*) as count FROM clients').get().count);
console.log('Total payments:', db.prepare('SELECT COUNT(*) as count FROM payments').get().count);
console.log('Total transactions:', db.prepare('SELECT COUNT(*) as count FROM transactions').get().count);

// Check payments with amount 0
const zeroPayments = db.prepare('SELECT COUNT(*) as count FROM payments WHERE amount = 0').get().count;
console.log(`Payments with amount 0: ${zeroPayments}`);

db.close();