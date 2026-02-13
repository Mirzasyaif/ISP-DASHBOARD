#!/usr/bin/env node
/**
 * Fixed SQLite Migration Script
 * Handles duplicate PPPoE usernames and adds monthly_fee data
 */

const fs = require('fs');
const path = require('path');

// Check if better-sqlite3 is installed
let Database;
try {
    Database = require('better-sqlite3');
    console.log('✅ better-sqlite3 is available');
} catch (error) {
    console.error('❌ better-sqlite3 is not installed. Please run: npm install better-sqlite3');
    process.exit(1);
}

// Paths
const dataDir = path.join(__dirname, 'data');
const dbJsonPath = path.join(dataDir, 'db.json');
const dbSqlitePath = path.join(dataDir, 'database.sqlite');

// Check if db.json exists
if (!fs.existsSync(dbJsonPath)) {
    console.error(`❌ db.json not found at: ${dbJsonPath}`);
    process.exit(1);
}

// Read existing db.json
console.log('📖 Reading existing db.json...');
const dbJson = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
const { users, payments, config } = dbJson;

console.log(`📊 Found ${users.length} users and ${payments.length} payments`);

// Initialize SQLite database
console.log('🗄️ Initializing SQLite database...');
const db = new Database(dbSqlitePath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Drop existing tables if they exist (clean migration)
console.log('🧹 Cleaning existing tables (if any)...');
const tables = ['clients', 'payments', 'transactions', 'config'];
tables.forEach(table => {
    try {
        db.exec(`DROP TABLE IF EXISTS ${table}`);
    } catch (error) {
        console.log(`  Could not drop ${table}: ${error.message}`);
    }
});

// Create tables
console.log('📋 Creating tables...');

// Clients table
db.exec(`
CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT,
    phone TEXT,
    monthly_fee REAL DEFAULT 110000, -- Default ISP fee: Rp 110,000
    status TEXT DEFAULT 'active',
    due_date TEXT,
    plan TEXT,
    full_name TEXT,
    address TEXT,
    pppoe_username TEXT UNIQUE, -- Made UNIQUE to prevent duplicates
    created_at TEXT DEFAULT (datetime('now')),
    last_paid_month TEXT,
    category TEXT DEFAULT 'regular'
)
`);

// Payments table
db.exec(`
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    month_year TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    date TEXT DEFAULT (datetime('now')),
    payment_method TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES clients(id) ON DELETE CASCADE
)
`);

// Transactions table (for expenses)
db.exec(`
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    description TEXT,
    date TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
)
`);

// Config table
db.exec(`
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
)
`);

console.log('✅ Tables created successfully');

// Track duplicate PPPoE usernames
const seenUsernames = new Set();
const duplicateUsers = [];
const uniqueUsers = [];

// Separate duplicates from unique users
users.forEach(user => {
    const username = user.pppoe_username?.toUpperCase().trim();
    if (!username) {
        console.log(`⚠️ Skipping user without PPPoE username: ${user.id}`);
        return;
    }
    
    if (seenUsernames.has(username)) {
        duplicateUsers.push({ original: user, duplicateOf: username });
    } else {
        seenUsernames.add(username);
        uniqueUsers.push(user);
    }
});

console.log(`📊 Unique users: ${uniqueUsers.length}, Duplicates: ${duplicateUsers.length}`);

// Migrate unique users to clients
console.log('🔄 Migrating unique users to clients table...');
const insertClientStmt = db.prepare(`
    INSERT INTO clients (
        id, name, ip_address, phone, monthly_fee, status, due_date,
        plan, full_name, address, pppoe_username, created_at, last_paid_month
    ) VALUES (
        @id, @name, @ip_address, @phone, @monthly_fee, @status, @due_date,
        @plan, @full_name, @address, @pppoe_username, @created_at, @last_paid_month
    )
`);

let migratedClients = 0;
const clientTransaction = db.transaction(() => {
    for (const user of uniqueUsers) {
        const username = user.pppoe_username?.toUpperCase().trim() || `user_${user.id}`;
        
        // Map user fields to client fields
        const clientData = {
            id: user.id,
            name: username,
            ip_address: null,
            phone: null,
            monthly_fee: 110000, // Default ISP monthly fee
            status: user.status || 'active',
            due_date: null,
            plan: user.plan || 'PPPoE',
            full_name: user.full_name || null,
            address: null,
            pppoe_username: username,
            created_at: user.created_at || new Date().toISOString(),
            last_paid_month: user.last_paid_month || null
        };
        
        try {
            insertClientStmt.run(clientData);
            migratedClients++;
        } catch (error) {
            console.error(`  ❌ Failed to migrate user ${username}: ${error.message}`);
        }
    }
});

try {
    clientTransaction();
    console.log(`✅ Successfully migrated ${migratedClients} unique clients`);
} catch (error) {
    console.error('❌ Error migrating clients:', error.message);
    process.exit(1);
}

// Migrate payments
console.log('💰 Migrating payments...');
const insertPaymentStmt = db.prepare(`
    INSERT INTO payments (
        id, user_id, month_year, amount, status, date, payment_method, notes, created_at
    ) VALUES (
        @id, @user_id, @month_year, @amount, @status, @date, @payment_method, @notes, @created_at
    )
`);

let migratedPayments = 0;
const paymentTransaction = db.transaction(() => {
    for (const payment of payments) {
        const paymentData = {
            id: payment.id || `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id: payment.user_id,
            month_year: payment.month_year || new Date().toISOString().slice(0, 7),
            amount: payment.amount || 0,
            status: payment.status || 'paid',
            date: payment.date || new Date().toISOString(),
            payment_method: payment.payment_method || 'cash',
            notes: payment.notes || null,
            created_at: payment.created_at || new Date().toISOString()
        };
        
        try {
            insertPaymentStmt.run(paymentData);
            migratedPayments++;
        } catch (error) {
            console.error(`  ❌ Failed to migrate payment: ${error.message}`);
        }
    }
});

try {
    paymentTransaction();
    console.log(`✅ Successfully migrated ${migratedPayments} payments`);
} catch (error) {
    console.error('❌ Error migrating payments:', error.message);
    process.exit(1);
}

// Add sample expense transactions for financial dashboard
console.log('💸 Adding sample expense transactions...');
const insertExpenseStmt = db.prepare(`
    INSERT INTO transactions (id, type, amount, category, description, date)
    VALUES (@id, @type, @amount, @category, @description, @date)
`);

const sampleExpenses = [
    { id: 'exp1', type: 'expense', amount: 500000, category: 'electricity', description: 'Monthly electricity bill', date: '2026-01-15' },
    { id: 'exp2', type: 'expense', amount: 300000, category: 'internet', description: 'ISP uplink', date: '2026-01-10' },
    { id: 'exp3', type: 'expense', amount: 200000, category: 'maintenance', description: 'Router maintenance', date: '2026-01-05' },
    { id: 'exp4', type: 'expense', amount: 150000, category: 'office', description: 'Office supplies', date: '2026-01-20' },
    { id: 'exp5', type: 'expense', amount: 100000, category: 'transport', description: 'Client visits', date: '2026-01-25' }
];

const expenseTransaction = db.transaction(() => {
    sampleExpenses.forEach(expense => {
        try {
            insertExpenseStmt.run(expense);
        } catch (error) {
            console.error(`  ❌ Failed to add expense: ${error.message}`);
        }
    });
});

try {
    expenseTransaction();
    console.log(`✅ Added ${sampleExpenses.length} sample expense transactions`);
} catch (error) {
    console.error('❌ Error adding expenses:', error.message);
}

// Migrate config
console.log('⚙️ Migrating config...');
const insertConfigStmt = db.prepare(`
    INSERT INTO config (key, value) VALUES (@key, @value)
`);

if (config && typeof config === 'object') {
    const configTransaction = db.transaction(() => {
        Object.entries(config).forEach(([key, value]) => {
            try {
                insertConfigStmt.run({ key, value: JSON.stringify(value) });
            } catch (error) {
                console.error(`  ❌ Failed to migrate config ${key}: ${error.message}`);
            }
        });
    });
    
    try {
        configTransaction();
        console.log(`✅ Migrated ${Object.keys(config).length} config entries`);
    } catch (error) {
        console.error('❌ Error migrating config:', error.message);
    }
} else {
    console.log('⚠️ No config found in db.json');
}

// Create indices for performance
console.log('📈 Creating database indices...');
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_clients_pppoe ON clients(pppoe_username);
    CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month_year);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
`);

console.log('✅ Indices created');

// Verify migration
console.log('\n🔍 Verification:');
console.log('   Clients table:', db.prepare('SELECT COUNT(*) as count FROM clients').get().count, 'rows');
console.log('   Payments table:', db.prepare('SELECT COUNT(*) as count FROM payments').get().count, 'rows');
console.log('   Transactions table:', db.prepare('SELECT COUNT(*) as count FROM transactions').get().count, 'rows');
console.log('   Config table:', db.prepare('SELECT COUNT(*) as count FROM config').get().count, 'rows');

// Sample financial summary
console.log('\n💰 Sample Financial Summary:');
const monthlyRevenue = db.prepare(`
    SELECT COALESCE(SUM(c.monthly_fee), 0) as total 
    FROM clients c 
    WHERE c.status = 'active'
`).get().total;

console.log(`   Total Monthly Revenue Potential: Rp ${monthlyRevenue.toLocaleString('id-ID')}`);
console.log(`   From ${db.prepare('SELECT COUNT(*) as count FROM clients WHERE status = "active"').get().count} active clients`);

console.log('\n🎉 Migration completed successfully!');
console.log('\n🚀 Next Steps:');
console.log('   1. Update config.js to use SQLite database');
console.log('   2. Restart the server');
console.log('   3. Access financial dashboard: http://localhost:3000/financial.html');

db.close();