const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');

try {
    const db = new Database(dbPath);
    
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    console.log('Tables in database:');
    tables.forEach(table => {
        console.log(`\n=== ${table.name} ===`);
        const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
        columns.forEach(col => {
            console.log(`  ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
    });
    
    // Sample data from clients table
    console.log('\n=== Sample client data (first 3 rows) ===');
    const clients = db.prepare('SELECT * FROM clients LIMIT 3').all();
    clients.forEach(client => {
        console.log(JSON.stringify(client, null, 2));
    });
    
    // Count clients with phone_number
    console.log('\n=== Phone number statistics ===');
    const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
    const clientsWithPhone = db.prepare('SELECT COUNT(*) as count FROM clients WHERE phone_number IS NOT NULL AND phone_number != ""').get().count;
    console.log(`Total clients: ${totalClients}`);
    console.log(`Clients with phone number: ${clientsWithPhone} (${Math.round(clientsWithPhone/totalClients*100)}%)`);
    
    db.close();
} catch (error) {
    console.error('Error reading database:', error.message);
}