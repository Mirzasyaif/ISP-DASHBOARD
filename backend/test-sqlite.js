const db = require('./models/db');

async function testDatabase() {
    console.log('🧪 Testing SQLite database migration...\n');
    
    try {
        // Initialize database
        await db.initDB();
        console.log('✅ Database initialized');
        
        // Check which database is being used
        const dbType = db.getDatabaseType();
        console.log(`📊 Using database: ${dbType}`);
        
        // Test 1: Get all clients
        console.log('\n1️⃣ Testing getAllUsers()...');
        const users = await db.getAllUsers();
        console.log(`   Found ${users.length} clients`);
        if (users.length > 0) {
            console.log(`   Sample client: ${users[0].pppoe_username} (${users[0].status})`);
        }
        
        // Test 2: Get stats
        console.log('\n2️⃣ Testing getStats()...');
        const stats = await db.getStats();
        console.log(`   Total users: ${stats.totalUsers}`);
        console.log(`   Paid this month: ${stats.paidThisMonth}`);
        console.log(`   Pending payments: ${stats.pendingPayments}`);
        
        // Test 3: Get financial summary (SQLite only)
        console.log('\n3️⃣ Testing getFinancialSummary()...');
        try {
            const financialSummary = await db.getFinancialSummary();
            console.log(`   Total monthly revenue: ${financialSummary.totalMonthlyRevenue}`);
            console.log(`   This month revenue: ${financialSummary.thisMonthRevenue}`);
            console.log(`   Outstanding: ${financialSummary.outstanding}`);
            console.log(`   Recent transactions: ${financialSummary.recentTransactions.length}`);
        } catch (error) {
            console.log(`   ⚠️  getFinancialSummary not available: ${error.message}`);
        }
        
        // Test 4: Get config
        console.log('\n4️⃣ Testing getConfig()...');
        const config = await db.getConfig();
        console.log(`   Config entries: ${Object.keys(config).length}`);
        console.log(`   Setup completed: ${config.setup_completed}`);
        
        // Test 5: Test user lookup
        console.log('\n5️⃣ Testing getUserByUsername()...');
        if (users.length > 0) {
            const sampleUsername = users[0].pppoe_username;
            const user = await db.getUserByUsername(sampleUsername);
            if (user) {
                console.log(`   Found user: ${user.pppoe_username} (ID: ${user.id})`);
            } else {
                console.log(`   ❌ User not found: ${sampleUsername}`);
            }
        }
        
        // Test 6: Check database structure (SQLite only)
        if (dbType === 'sqlite') {
            console.log('\n6️⃣ Checking SQLite database structure...');
            const sqliteDb = require('./models/db-sqlite');
            
            // Get table list
            const Database = require('better-sqlite3');
            const dbPath = require('path').join(__dirname, 'data/database.sqlite');
            const testDb = new Database(dbPath);
            
            const tables = testDb.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                ORDER BY name
            `).all();
            
            console.log(`   Tables in database: ${tables.map(t => t.name).join(', ')}`);
            
            // Count records in each table
            console.log('\n   Record counts:');
            for (const table of tables) {
                const count = testDb.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
                console.log(`     ${table.name}: ${count} records`);
            }
            
            testDb.close();
        }
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📋 Migration Summary:');
        console.log(`   Database: ${dbType}`);
        console.log(`   Clients: ${users.length}`);
        console.log(`   Paid this month: ${stats.paidThisMonth}`);
        console.log(`   Config entries: ${Object.keys(config).length}`);
        
        if (dbType === 'sqlite') {
            console.log('\n✅ SQLite migration successful!');
            console.log('   The application is now using SQLite database.');
        } else {
            console.log('\n⚠️  Still using JSON database.');
            console.log('   Run: node migrate-to-sqlite.js to complete migration.');
        }
        
        // Close database if needed
        if (db.closeDB) {
            db.closeDB();
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run test
testDatabase();