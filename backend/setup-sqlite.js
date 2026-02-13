const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up SQLite database for ISP Dashboard\n');

// Check and install better-sqlite3 if needed
function installBetterSqlite3() {
    try {
        require.resolve('better-sqlite3');
        console.log('✅ better-sqlite3 is already installed');
        return true;
    } catch (error) {
        console.log('📦 Installing better-sqlite3...');
        try {
            execSync('npm install better-sqlite3 --no-fund --no-audit --loglevel=error', {
                cwd: __dirname,
                stdio: 'inherit'
            });
            console.log('✅ better-sqlite3 installed successfully');
            return true;
        } catch (installError) {
            console.error('❌ Failed to install better-sqlite3:', installError.message);
            return false;
        }
    }
}

// Create database schema
function createDatabaseSchema() {
    console.log('\n🗄️ Creating database schema...');
    
    const dataDir = path.join(__dirname, 'data');
    const dbSqlitePath = path.join(dataDir, 'database.sqlite');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load better-sqlite3
    const Database = require('better-sqlite3');
    const db = new Database(dbSqlitePath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Drop tables if they exist (for clean setup)
    console.log('🧹 Cleaning up existing tables (if any)...');
    const tables = ['clients', 'payments', 'transactions', 'config'];
    tables.forEach(table => {
        try {
            db.exec(`DROP TABLE IF EXISTS ${table}`);
        } catch (error) {
            // Ignore errors if tables don't exist
        }
    });
    
    // Create clients table
    console.log('📋 Creating clients table...');
    db.exec(`
        CREATE TABLE clients (
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
    
    // Create transactions table
    console.log('📋 Creating transactions table...');
    db.exec(`
        CREATE TABLE transactions (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            description TEXT
        )
    `);
    
    // Create payments table
    console.log('📋 Creating payments table...');
    db.exec(`
        CREATE TABLE payments (
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
    
    // Create config table
    console.log('📋 Creating config table...');
    db.exec(`
        CREATE TABLE config (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);
    
    // Create indexes
    console.log('📊 Creating indexes...');
    db.exec(`CREATE INDEX idx_payments_user_id ON payments(user_id)`);
    db.exec(`CREATE INDEX idx_payments_month_year ON payments(month_year)`);
    db.exec(`CREATE INDEX idx_clients_pppoe_username ON clients(pppoe_username)`);
    
    // Insert sample config
    console.log('⚙️ Inserting default configuration...');
    const insertConfig = db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`);
    
    const defaultConfig = {
        'setup_completed': 'false',
        'mikrotik_ip': '192.168.1.1',
        'mikrotik_user': 'admin',
        'mikrotik_pass': 'password',
        'mikrotik_port': '8728',
        'telegram_token': '',
        'telegram_admin_id': '',
        'port': '3000',
        'database_version': '1.0'
    };
    
    Object.entries(defaultConfig).forEach(([key, value]) => {
        insertConfig.run(key, value);
    });
    
    // Insert sample data for testing
    console.log('🧪 Inserting sample data for testing...');
    
    // Sample client
    const insertClient = db.prepare(`
        INSERT INTO clients (
            id, name, ip_address, phone, monthly_fee, status, plan,
            pppoe_username, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const sampleClient = {
        id: 'sample_' + Date.now(),
        name: 'Sample User',
        ip_address: '192.168.1.100',
        phone: '+628123456789',
        monthly_fee: 100000,
        status: 'active',
        plan: '10Mbps',
        pppoe_username: 'sample_user',
        created_at: new Date().toISOString()
    };
    
    insertClient.run(
        sampleClient.id,
        sampleClient.name,
        sampleClient.ip_address,
        sampleClient.phone,
        sampleClient.monthly_fee,
        sampleClient.status,
        sampleClient.plan,
        sampleClient.pppoe_username,
        sampleClient.created_at
    );
    
    // Sample transaction
    const insertTransaction = db.prepare(`
        INSERT INTO transactions (id, date, type, amount, category, description)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insertTransaction.run(
        'tx_sample_' + Date.now(),
        new Date().toISOString(),
        'IN',
        100000,
        'subscription',
        'Sample payment'
    );
    
    db.close();
    
    console.log('\n✅ Database schema created successfully!');
    console.log(`📁 Database file: ${dbSqlitePath}`);
    console.log('\n📝 Database contains:');
    console.log('   - clients table with sample user');
    console.log('   - payments table (empty)');
    console.log('   - transactions table with sample transaction');
    console.log('   - config table with default settings');
    
    return dbSqlitePath;
}

// Main execution
async function main() {
    try {
        // Install better-sqlite3 if needed
        if (!installBetterSqlite3()) {
            console.error('❌ Cannot proceed without better-sqlite3');
            process.exit(1);
        }
        
        // Create database schema
        createDatabaseSchema();
        
        console.log('\n🎉 Setup completed!');
        console.log('\nNext steps:');
        console.log('1. Run the migration script to import existing data:');
        console.log('   node migrate-to-sqlite.js');
        console.log('2. Update your application to use SQLite instead of JSON');
        console.log('3. Test the new database connection');
        
    } catch (error) {
        console.error('❌ Error during setup:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { createDatabaseSchema };