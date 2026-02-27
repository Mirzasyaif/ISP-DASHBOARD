const Database = require('better-sqlite3');
const path = require('path');

// Path to SQLite database (same as used in migration script)
const dbPath = path.join(__dirname, 'data', 'database.sqlite');

try {
    const db = new Database(dbPath);
    // Delete all expense transactions
    const deleteStmt = db.prepare(`DELETE FROM transactions WHERE type = 'expense'`);
    const info = deleteStmt.run();
    console.log(`✅ Deleted ${info.changes} expense rows from transactions table`);
    db.close();
} catch (error) {
    console.error('❌ Error clearing expenses:', error);
    process.exit(1);
}