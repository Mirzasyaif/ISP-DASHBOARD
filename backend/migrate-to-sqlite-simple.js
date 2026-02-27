const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

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
const db = new sqlite3.Database(dbSqlitePath);

// Create tables
console.log('📋 Creating tables...');

db.serialize(() => {
    // Clients table (formerly users)
    db.run(`
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
            last_paid_month TEXT,
            phone_number TEXT,
            payment_status TEXT DEFAULT 'pending'
        )
    `);

    // Transactions table
    db.run(`
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
    db.run(`
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
    db.run(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    // Payment transactions table
    db.run(`
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

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_payments_month_year ON payments(month_year)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_clients_pppoe_username ON clients(pppoe_username)`);

    console.log('✅ Tables created successfully');

    // Migrate users to clients
    console.log('🔄 Migrating users to clients table...');
    const insertClientStmt = db.prepare(`
        INSERT OR REPLACE INTO clients (
            id, name, ip_address, phone, monthly_fee, status, due_date,
            plan, full_name, address, pppoe_username, created_at, last_paid_month
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let migratedClients = 0;
    users.forEach(user => {
        insertClientStmt.run(
            user.id,
            user.pppoe_username,
            null, // ip_address
            null, // phone
            user.monthly_fee || 0,
            user.status || 'active',
            null, // due_date
            user.plan,
            user.full_name || null,
            null, // address
            user.pppoe_username,
            user.created_at,
            user.last_paid_month || null
        );
        migratedClients++;
    });
    console.log(`✅ Successfully migrated ${migratedClients} clients`);

    // Migrate payments
    console.log('💰 Migrating payments...');
    const insertPaymentStmt = db.prepare(`
        INSERT OR REPLACE INTO payments (
            id, user_id, month_year, amount, status, paid_at, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let migratedPayments = 0;
    payments.forEach(payment => {
        insertPaymentStmt.run(
            payment.id,
            payment.user_id,
            payment.month_year,
            payment.amount,
            payment.status,
            payment.paid_at,
            payment.payment_method
        );
        migratedPayments++;
        
        // Also create a transaction record for each payment
        const insertTransactionStmt = db.prepare(`
            INSERT OR REPLACE INTO transactions (id, date, type, amount, category, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        insertTransactionStmt.run(
            `tx_${payment.id}`,
            payment.paid_at || new Date().toISOString(),
            'IN',
            payment.amount,
            'subscription',
            `Payment from client ${payment.user_id} for ${payment.month_year}`
        );
    });
    console.log(`✅ Successfully migrated ${migratedPayments} payments`);

    // Migrate config
    console.log('⚙️ Migrating config...');
    const insertConfigStmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)
    `);

    let migratedConfig = 0;
    Object.entries(config).forEach(([key, value]) => {
        insertConfigStmt.run(
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value)
        );
        migratedConfig++;
    });
    console.log(`✅ Successfully migrated ${migratedConfig} config entries`);

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    db.get('SELECT COUNT(*) as count FROM clients', (err, row) => {
        if (err) {
            console.error('Error counting clients:', err);
        } else {
            console.log(`📊 Database now contains:`);
            console.log(`   ${row.count} clients (was ${users.length})`);
        }
    });

    db.get('SELECT COUNT(*) as count FROM payments', (err, row) => {
        if (err) {
            console.error('Error counting payments:', err);
        } else {
            console.log(`   ${row.count} payments (was ${payments.length})`);
        }
    });

    db.get('SELECT COUNT(*) as count FROM config', (err, row) => {
        if (err) {
            console.error('Error counting config:', err);
        } else {
            console.log(`   ${row.count} config entries`);
        }
    });

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
});
