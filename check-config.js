const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend/data/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    
    console.log('Connected to database');
    
    // Check config table
    db.all("SELECT key, value FROM config", [], (err, rows) => {
        if (err) {
            console.error('Error reading config:', err.message);
            // Check if config table exists
            db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
                if (err) {
                    console.error('Error checking tables:', err.message);
                } else {
                    console.log('All tables:', tables.map(t => t.name));
                }
                db.close();
            });
        } else {
            console.log('\n=== Config Table ===');
            rows.forEach(row => {
                console.log(`${row.key}: ${row.value}`);
            });
            
            // Check for WhatsApp related config
            console.log('\n=== Looking for WhatsApp/OpenClaw config ===');
            const whatsappRows = rows.filter(row => 
                row.key.toLowerCase().includes('whatsapp') || 
                row.key.toLowerCase().includes('openclaw') ||
                row.key.toLowerCase().includes('api_key')
            );
            
            if (whatsappRows.length > 0) {
                whatsappRows.forEach(row => {
                    console.log(`Found: ${row.key}: ${row.value}`);
                });
            } else {
                console.log('No WhatsApp/OpenClaw config found');
            }
            
            db.close();
        }
    });
});