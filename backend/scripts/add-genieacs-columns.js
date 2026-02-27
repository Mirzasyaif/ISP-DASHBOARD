/**
 * Script untuk menambahkan kolom GenieACS ke database SQLite
 * Run: node backend/scripts/add-genieacs-columns.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite');

console.log('🔧 Adding GenieACS columns to database...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

// Add columns one by one
const columns = [
    { name: 'cpe_serial_number', type: 'TEXT' },
    { name: 'cpe_model', type: 'TEXT' },
    { name: 'wifi_ssid', type: 'TEXT' },
    { name: 'wifi_password', type: 'TEXT' },
    { name: 'genieacs_device_id', type: 'TEXT' },
    { name: 'genieacs_status', type: 'TEXT DEFAULT "pending"' }
];

let completed = 0;

columns.forEach((col, index) => {
    const sql = `ALTER TABLE clients ADD COLUMN ${col.name} ${col.type}`;
    
    db.run(sql, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log(`⚠️  Column ${col.name} already exists`);
            } else {
                console.error(`❌ Error adding column ${col.name}:`, err.message);
            }
        } else {
            console.log(`✅ Added column: ${col.name}`);
        }
        
        completed++;
        if (completed === columns.length) {
            console.log('\n🎉 GenieACS columns setup complete!');
            db.close();
        }
    });
});