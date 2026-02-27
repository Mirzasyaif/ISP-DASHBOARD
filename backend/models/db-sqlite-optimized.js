// isp-dashboard/backend/models/db-sqlite-optimized.js
// OPTIMIZED VERSION: Using better-sqlite3 for better performance

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data/database.sqlite');

// Initialize database connection
let db;

// Prepared statement cache for better performance
const statementCache = new Map();

/**
 * Get or create a prepared statement (cached)
 * @param {string} sql - SQL query
 * @returns {object} Prepared statement
 */
function getStatement(sql) {
    if (!statementCache.has(sql)) {
        statementCache.set(sql, db.prepare(sql));
    }
    return statementCache.get(sql);
}

async function initDB() {
    try {
        // Ensure database file exists
        if (!fs.existsSync(dbPath)) {
            console.error(`❌ Database file not found: ${dbPath}`);
            console.log('⚠️  Running setup script to create database...');
            throw new Error('Database file not found. Run setup-sqlite.js first.');
        }

        // Open database with better-sqlite3 (synchronous, faster)
        db = new Database(dbPath, { 
            verbose: process.env.NODE_ENV === 'development' ? console.log : null
        });

        // Enable WAL mode for better concurrent access
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.pragma('synchronous = NORMAL'); // Faster than FULL, still safe
        db.pragma('cache_size = -64000'); // 64MB cache
        db.pragma('temp_store = MEMORY'); // Store temp tables in memory

        // Test connection
        const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log(`✅ SQLite database initialized (better-sqlite3). Found ${result.length} tables.`);

        // Ensure required schema columns exist
        await ensureSchema();

        return;
    } catch (error) {
        console.error('❌ Error initializing SQLite database:', error.message);
        throw error;
    }
}

function ensureSchema() {
    // Attempt to add columns; ignore errors if they already exist
    const columns = [
        "ALTER TABLE clients ADD COLUMN phone_number TEXT",
        "ALTER TABLE clients ADD COLUMN due_date TEXT",
        "ALTER TABLE clients ADD COLUMN payment_status TEXT DEFAULT 'pending'",
        "ALTER TABLE clients ADD COLUMN last_paid_month TEXT",
        "ALTER TABLE payments ADD COLUMN paid_at TEXT",
        "ALTER TABLE payments ADD COLUMN payment_method TEXT",
        "ALTER TABLE payments ADD COLUMN invoice_number TEXT",
        "ALTER TABLE payment_proofs ADD COLUMN amount INTEGER",
        "ALTER TABLE payment_proofs ADD COLUMN month_year TEXT"
    ];

    columns.forEach(sql => {
        try {
            db.exec(sql);
        } catch (e) {
            // Column already exists, ignore
        }
    });

    // Create tables if not exist
    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id TEXT PRIMARY KEY,
            order_id TEXT UNIQUE NOT NULL,
            user_id TEXT NOT NULL,
            month_year TEXT NOT NULL,
            amount INTEGER NOT NULL,
            payment_method TEXT,
            status TEXT DEFAULT 'pending',
            snap_token TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES clients(id)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_proofs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            phone_number TEXT,
            image_path TEXT,
            ocr_result TEXT,
            validation TEXT,
            status TEXT DEFAULT 'pending_approval',
            message_id TEXT,
            approved_by TEXT,
            amount INTEGER,
            month_year TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES clients(id)
        )
    `);

    // Create indexes for better query performance
    try {
        db.exec("CREATE INDEX IF NOT EXISTS idx_clients_pppoe ON clients(pppoe_username)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_clients_due_date ON clients(due_date)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_payments_user_month ON payments(user_id, month_year)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_payments_status ON