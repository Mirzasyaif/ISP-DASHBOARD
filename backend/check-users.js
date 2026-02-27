const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');
const db = new Database(dbPath);

const paymentUsers = [
    '1770220602143',
    '1770220599121', 
    '1770220599044'
];

console.log('=== PAYMENT USERS DETAILS ===');
const stmt = db.prepare('SELECT id, name, pppoe_username, monthly_fee, last_paid_month FROM clients WHERE id = ?');
paymentUsers.forEach(id => {
    const user = stmt.get(id);
    console.log(`ID: ${user.id} | Name: ${user.name} | PPPoE: ${user.pppoe_username} | Fee: ${user.monthly_fee} | Last paid: ${user.last_paid_month}`);
});

// Also check which users have last_paid_month = '2026-02'
console.log('\n=== ALL USERS WITH LAST_PAID_MONTH = 2026-02 ===');
const paidUsers = db.prepare('SELECT id, name, pppoe_username FROM clients WHERE last_paid_month = ?').all('2026-02');
paidUsers.forEach(u => console.log(` ${u.id} | ${u.name} | ${u.pppoe_username}`));

db.close();