const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');

async function migratePaymentProofs() {
    try {
        console.log('Starting payment_proofs table migration...');
        
        const db = new sqlite3.Database(dbPath);
        
        await new Promise((resolve, reject) => {
            db.exec('DROP TABLE IF EXISTS payment_proofs', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✅ Dropped old payment_proofs table');
        
        await new Promise((resolve, reject) => {
            db.exec(`
                CREATE TABLE payment_proofs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    phone_number TEXT,
                    image_path TEXT,
                    ocr_result TEXT,
                    validation TEXT,
                    status TEXT DEFAULT 'pending_approval',
                    message_id TEXT,
                    approved_by TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    FOREIGN KEY (user_id) REFERENCES clients(id)
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✅ Created new payment_proofs table with correct schema');
        
        db.close();
        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migratePaymentProofs();
