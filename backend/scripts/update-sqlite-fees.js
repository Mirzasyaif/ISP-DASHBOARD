#!/usr/bin/env node

/**
 * Script untuk mengupdate monthly_fee di database SQLite
 */

const path = require('path');
const fs = require('fs');

// Check if better-sqlite3 is available
let Database;
try {
    Database = require('better-sqlite3');
} catch (error) {
    console.error('❌ better-sqlite3 not installed. Please run: npm install better-sqlite3');
    process.exit(1);
}

const dbPath = path.join(__dirname, '../data/database.sqlite');

function updateDefaultFee(feeAmount) {
    console.log(`🔧 Memulai update monthly_fee di SQLite...`);
    console.log(`💵 Mengatur tarif default: Rp ${feeAmount.toLocaleString('id-ID')}`);
    
    if (!fs.existsSync(dbPath)) {
        console.error(`❌ Database file not found: ${dbPath}`);
        console.log('⚠️  Run setup-sqlite.js first');
        return false;
    }
    
    const db = new Database(dbPath);
    
    try {
        // Check if monthly_fee column exists
        const tableInfo = db.prepare("PRAGMA table_info(clients)").all();
        const hasMonthlyFee = tableInfo.some(col => col.name === 'monthly_fee');
        
        if (!hasMonthlyFee) {
            console.log('⚠️  Column monthly_fee tidak ditemukan, menambahkan...');
            db.prepare("ALTER TABLE clients ADD COLUMN monthly_fee INTEGER DEFAULT 0").run();
        }
        
        // Update all users with feeAmount if monthly_fee is 0 or NULL
        const stmt = db.prepare("UPDATE clients SET monthly_fee = ? WHERE monthly_fee IS NULL OR monthly_fee = 0");
        const result = stmt.run(feeAmount);
        
        console.log(`✅ ${result.changes} user di-update dengan tarif Rp ${feeAmount.toLocaleString('id-ID')}`);
        
        // Verify update
        const countZero = db.prepare("SELECT COUNT(*) as count FROM clients WHERE monthly_fee IS NULL OR monthly_fee = 0").get();
        const countWithFee = db.prepare("SELECT COUNT(*) as count FROM clients WHERE monthly_fee > 0").get();
        const avgFee = db.prepare("SELECT AVG(monthly_fee) as avg FROM clients WHERE monthly_fee > 0").get();
        
        console.log(`📊 Statistik setelah update:`);
        console.log(`   • User tanpa tarif: ${countZero.count}`);
        console.log(`   • User dengan tarif: ${countWithFee.count}`);
        console.log(`   • Rata-rata tarif: Rp ${Math.round(avgFee.avg || 0).toLocaleString('id-ID')}`);
        
        // Update transactions with amount = 0 to use user's monthly_fee
        console.log(`\n💰 Mengupdate transaksi dengan amount = 0...`);
        
        // First, check if we have the payments table structure we need
        const paymentsTableInfo = db.prepare("PRAGMA table_info(payments)").all();
        const hasUserColumn = paymentsTableInfo.some(col => col.name === 'user_id');
        
        if (hasUserColumn) {
            const updateStmt = db.prepare(`
                UPDATE payments 
                SET amount = (
                    SELECT monthly_fee 
                    FROM clients 
                    WHERE clients.id = payments.user_id
                )
                WHERE amount = 0 
                AND EXISTS (
                    SELECT 1 
                    FROM clients 
                    WHERE clients.id = payments.user_id 
                    AND clients.monthly_fee > 0
                )
            `);
            
            const updateResult = updateStmt.run();
            console.log(`✅ ${updateResult.changes} transaksi di-update`);
        } else {
            console.log('⚠️  Tabel payments tidak memiliki kolom user_id, skip update transaksi');
        }
        
        db.close();
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        db.close();
        return false;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
Usage: node update-sqlite-fees.js <fee_amount>

Contoh:
  node update-sqlite-fees.js 110000     # Set tarif Rp 110.000
  node update-sqlite-fees.js 150000     # Set tarif Rp 150.000

Catatan: Script ini hanya untuk database SQLite.
        `);
        process.exit(1);
    }
    
    const feeAmount = parseInt(args[0]);
    if (isNaN(feeAmount) || feeAmount <= 0) {
        console.error('❌ Jumlah fee harus angka positif');
        process.exit(1);
    }
    
    const success = updateDefaultFee(feeAmount);
    process.exit(success ? 0 : 1);
}

module.exports = {
    updateDefaultFee
};