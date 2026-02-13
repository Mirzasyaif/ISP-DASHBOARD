#!/usr/bin/env node

/**
 * Script untuk upgrade database JSON yang ada
 * - Menambahkan field monthly_fee ke semua user
 * - Mengupdate payment amount berdasarkan monthly_fee user
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

function readDB() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return null;
    }
}

function writeDB(data) {
    try {
        const tempPath = dbPath + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
        fs.renameSync(tempPath, dbPath);
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

function upgradeDatabase() {
    console.log('🔧 Memulai upgrade database...');
    
    const db = readDB();
    if (!db) {
        console.error('❌ Gagal membaca database');
        return false;
    }
    
    let changesMade = 0;
    
    // 1. Tambahkan monthly_fee ke semua user jika belum ada
    console.log('📝 Menambahkan field monthly_fee ke user...');
    db.users.forEach(user => {
        if (user.monthly_fee === undefined) {
            user.monthly_fee = 0;
            changesMade++;
        }
    });
    
    // 2. Update payment amount berdasarkan monthly_fee user
    console.log('💰 Mengupdate payment amount...');
    db.payments.forEach(payment => {
        const user = db.users.find(u => u.id === payment.user_id);
        if (user && payment.amount === 0 && user.monthly_fee > 0) {
            payment.amount = user.monthly_fee;
            changesMade++;
        }
    });
    
    if (changesMade > 0) {
        console.log(`✅ ${changesMade} perubahan dilakukan`);
        
        const success = writeDB(db);
        if (success) {
            console.log('💾 Database berhasil di-upgrade');
            return true;
        } else {
            console.error('❌ Gagal menulis database');
            return false;
        }
    } else {
        console.log('ℹ️ Tidak ada perubahan yang diperlukan');
        return true;
    }
}

function setDefaultFeeForAllUsers(feeAmount) {
    console.log(`💵 Mengatur tarif default ${feeAmount} untuk semua user...`);
    
    const db = readDB();
    if (!db) {
        console.error('❌ Gagal membaca database');
        return false;
    }
    
    let updatedCount = 0;
    db.users.forEach(user => {
        if (!user.monthly_fee || user.monthly_fee === 0) {
            user.monthly_fee = feeAmount;
            updatedCount++;
        }
    });
    
    if (updatedCount > 0) {
        console.log(`✅ ${updatedCount} user di-update dengan tarif ${feeAmount}`);
        return writeDB(db);
    } else {
        console.log('ℹ️ Semua user sudah memiliki tarif');
        return true;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Basic upgrade
        const success = upgradeDatabase();
        process.exit(success ? 0 : 1);
    } else if (args[0] === '--set-default-fee' && args[1]) {
        // Set default fee for all users
        const feeAmount = parseInt(args[1]);
        if (isNaN(feeAmount) || feeAmount <= 0) {
            console.error('❌ Jumlah fee harus angka positif');
            process.exit(1);
        }
        
        const success = setDefaultFeeForAllUsers(feeAmount);
        process.exit(success ? 0 : 1);
    } else if (args[0] === '--help') {
        console.log(`
Usage: node upgrade-db.js [options]

Options:
  --set-default-fee <amount>  Set default monthly fee for all users
  --help                      Show this help message

Examples:
  node upgrade-db.js                     # Basic database upgrade
  node upgrade-db.js --set-default-fee 150000  # Set default fee 150k for all users
        `);
        process.exit(0);
    } else {
        console.error('❌ Invalid arguments. Use --help for usage information.');
        process.exit(1);
    }
}

module.exports = {
    upgradeDatabase,
    setDefaultFeeForAllUsers
};