const fs = require('fs');
const path = require('path');

// Check if better-sqlite3 is installed
let Database;
try {
    Database = require('better-sqlite3');
    console.log('✅ better-sqlite3 is available');
} catch (error) {
    console.error('❌ better-sqlite3 is not installed. Please run: npm install better-sqlite3');
    console.error('Error:', error.message);
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

// Create tables
console.log('📋 Creating tables...');

// Clients table (formerly users)
db.exec(`
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT,
    phone TEXT,
    monthly_fee REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    due_date TEXT,
    plan TEXT,
    full_name TEXT,
    address TEXT,
    pppoe_username TEXT UNIQUE,
    created_at TEXT,
    last_paid_month TEXT
)
`);

// Transactions table
db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    description TEXT
)
`);

// Payments table
db.exec(`
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    month_year TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    paid_at TEXT,
    payment_method TEXT,
    FOREIGN KEY (user_id) REFERENCES clients(id) ON DELETE CASCADE
)
`);

// Config table
db.exec(`
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
)
`);

// Create index for faster lookups
db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_month_year ON payments(month_year)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_pppoe_username ON clients(pppoe_username)`);

console.log('✅ Tables created successfully');

// Migrate users to clients
console.log('🔄 Migrating users to clients table...');
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
const transaction = db.transaction(() => {
    for (const user of users) {
        // Map user fields to client fields
        const clientData = {
            id: user.id,
            name: user.pppoe_username, // pppoe_username becomes name
            ip_address: null, // Not available in current data
            phone: null, // Not available in current data
            monthly_fee: 0, // Default value
            status: user.status || 'active',
            due_date: null, // Not available
            plan: user.plan,
            full_name: user.full_name || null,
            address: null, // Not available
            pppoe_username: user.pppoe_username,
            created_at: user.created_at,
            last_paid_month: user.last_paid_month || null
        };
        
        insertClientStmt.run(clientData);
        migratedClients++;
    }
});

try {
    transaction();
    console.log(`✅ Successfully migrated ${migratedClients} clients`);
} catch (error) {
    console.error('❌ Error migrating clients:', error.message);
    process.exit(1);
}

// Migrate payments
console.log('💰 Migrating payments...');
const insertPaymentStmt = db.prepare(`
    INSERT INTO payments (
        id, user_id, month_year, amount, status, paid_at, payment_method
    ) VALUES (
        @id, @user_id, @month_year, @amount, @status, @paid_at, @payment_method
    )
`);

let migratedPayments = 0;
const paymentTransaction = db.transaction(() => {
    for (const payment of payments) {
        insertPaymentStmt.run({
            id: payment.id,
            user_id: payment.user_id,
            month_year: payment.month_year,
            amount: payment.amount,
            status: payment.status,
            paid_at: payment.paid_at,
            payment_method: payment.payment_method
        });
        migratedPayments++;
        
        // Also create a transaction record for each payment
        const insertTransactionStmt = db.prepare(`
            INSERT INTO transactions (id, date, type, amount, category, description)
            VALUES (@id, @date, @type, @amount, @category, @description)
        `);
        
        insertTransactionStmt.run({
            id: `tx_${payment.id}`,
            date: payment.paid_at || new Date().toISOString(),
            type: 'IN',
            amount: payment.amount,
            category: 'subscription',
            description: `Payment from client ${payment.user_id} for ${payment.month_year}`
        });
    }
});

try {
    paymentTransaction();
    console.log(`✅ Successfully migrated ${migratedPayments} payments`);
} catch (error) {
    console.error('❌ Error migrating payments:', error.message);
    process.exit(1);
}

// Migrate config
console.log('⚙️ Migrating config...');
const insertConfigStmt = db.prepare(`
    INSERT OR REPLACE INTO config (key, value) VALUES (@key, @value)
`);

const configTransaction = db.transaction(() => {
    for (const [key, value] of Object.entries(config)) {
        insertConfigStmt.run({
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value)
        });
    }
});

try {
    configTransaction();
    console.log(`✅ Successfully migrated ${Object.keys(config).length} config entries`);
} catch (error) {
    console.error('❌ Error migrating config:', error.message);
    process.exit(1);
}

// Verify migration
console.log('\n🔍 Verifying migration...');
const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
const paymentCount = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get().count;

console.log(`📊 Database now contains:`);
console.log(`   ${clientCount} clients (was ${users.length})`);
console.log(`   ${paymentCount} payments (was ${payments.length})`);
console.log(`   ${configCount} config entries`);

// Create backup of db.json
const backupPath = dbJsonPath + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(dbJsonPath, backupPath);
console.log(`\n💾 Original db.json backed up to: ${backupPath}`);

// Create a flag file to indicate migration has been run
const migrationFlagPath = path.join(dataDir, '.migrated-to-sqlite');
fs.writeFileSync(migrationFlagPath, `Migrated to SQLite on ${new Date().toISOString()}\n`);
console.log(`\n✅ Migration completed successfully!`);
console.log(`📁 Database file: ${dbSqlitePath}`);
console.log(`\n⚠️  Important: Update your application to use the new SQLite database.`);
console.log(`   The original db.json has been kept as a backup.`);

db.close();