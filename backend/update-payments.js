const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');
console.log('Opening database:', dbPath);

const db = new Database(dbPath);

// Get all payments with amount 0
const zeroPayments = db.prepare('SELECT p.id, p.user_id, p.month_year, c.monthly_fee FROM payments p JOIN clients c ON p.user_id = c.id WHERE p.amount = 0').all();

console.log(`Found ${zeroPayments.length} payments with amount 0:`);
zeroPayments.forEach(p => {
    console.log(` - ${p.id} | user ${p.user_id} | ${p.month_year} | fee: ${p.monthly_fee}`);
});

// Update each payment amount to monthly_fee
const updateStmt = db.prepare('UPDATE payments SET amount = ? WHERE id = ?');
const updateTransaction = db.transaction((payments) => {
    for (const p of payments) {
        updateStmt.run(p.monthly_fee, p.id);
    }
});

try {
    updateTransaction(zeroPayments);
    console.log(`✅ Updated ${zeroPayments.length} payments`);
} catch (error) {
    console.error('❌ Error updating payments:', error.message);
}

// Verify updates
console.log('\n=== PAYMENTS AFTER UPDATE ===');
const payments = db.prepare('SELECT id, user_id, month_year, amount, status FROM payments').all();
payments.forEach(p => console.log(` ${p.id} | user: ${p.user_id} | ${p.month_year} | amount: ${p.amount} | ${p.status}`));

// Calculate total inflow for February 2026
const febInflow = db.prepare('SELECT SUM(amount) as total FROM payments WHERE month_year = ?').get('2026-02');
console.log(`\nTotal inflow February 2026: ${febInflow.total || 0}`);

db.close();