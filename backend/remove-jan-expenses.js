const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');
const db = new Database(dbPath);

// Count expenses before
const before = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE type = ?').get('expense');
console.log(`Expenses before: ${before.count}`);

// Delete all expense transactions
const deleteStmt = db.prepare('DELETE FROM transactions WHERE type = ?');
const result = deleteStmt.run('expense');
console.log(`Deleted ${result.changes} expense transactions`);

// Verify
const after = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE type = ?').get('expense');
console.log(`Expenses after: ${after.count}`);

// Show remaining transactions
console.log('\n=== REMAINING TRANSACTIONS ===');
const remaining = db.prepare('SELECT id, type, amount, category, date FROM transactions').all();
remaining.forEach(t => console.log(` ${t.id} | ${t.type} | ${t.amount} | ${t.category} | ${t.date}`));

db.close();