const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the SQLite database file (same as used by the app)
const dbPath = path.join(__dirname, 'data', 'database.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('❌ Failed to open database:', err.message);
        process.exit(1);
    }
    console.log('✅ Database opened successfully');
});

db.serialize(() => {
    // Ensure the expenses table exists (create if missing)
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        recorded_by TEXT,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Delete all rows in the expenses table
    const deleteStmt = `DELETE FROM expenses`;
    db.run(deleteStmt, function(err) {
        if (err) {
            console.error('❌ Error deleting expense rows:', err.message);
        } else {
            console.log(`✅ Deleted ${this.changes} expense rows from expenses table`);
        }
    });
});

db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err.message);
    } else {
        console.log('✅ Database connection closed');
    }
});