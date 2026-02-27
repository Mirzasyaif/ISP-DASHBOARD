/**
 * Script untuk menambahkan semua nomor WhatsApp dari database ke allowlist OpenClaw
 * Usage: node bulk-add-to-openclaw-allowlist.js
 */

const axios = require('axios');
const path = require('path');
const db = require('./models/db-sqlite');

// Konfigurasi dari .env
const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:18789';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || 'ce1ebc0e76bff95e804903b2bb92b513f1154ee4dd52325a';

/**
 * Format nomor telepon ke format OpenClaw
 * - Hapus karakter +
 * - Hapus 0 di depan dan ganti dengan 62
 */
function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Hapus semua karakter non-digit
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // Jika kosong setelah dibersihkan
    if (!formatted) return null;
    
    // Jika dimulai dengan 0, ganti dengan 62
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substring(1);
    }
    
    // Pastikan dimulai dengan 62
    if (!formatted.startsWith('62')) {
        formatted = '62' + formatted;
    }
    
    return formatted;
}

/**
 * Tambahkan nomor ke allowlist OpenClaw via API
 */
async function addToOpenClawAllowlist(phoneNumber) {
    try {
        const response = await axios.post(
            `${OPENCLAW_API_URL}/api/allowlist`,
            {
                phoneNumber: phoneNumber,
                action: 'add'
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENCLAW_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        return { success: true, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        };
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Memulai bulk add nomor WhatsApp ke OpenClaw allowlist...\n');
    
    try {
        // Initialize database
        await db.initDB();
        console.log('✅ Database initialized\n');
        
        // Get all clients
        const clients = await db.getAllClients();
        console.log(`📊 Total clients: ${clients.length}\n`);
        
        // Filter clients with phone numbers
        const clientsWithPhone = clients.filter(client => {
            const phone = client.phone || client.phone_number;
            return phone && phone.trim() !== '';
        });
        
        console.log(`📱 Clients dengan nomor WhatsApp: ${clientsWithPhone.length}\n`);
        
        if (clientsWithPhone.length === 0) {
            console.log('⚠️  Tidak ada client dengan nomor WhatsApp');
            await db.closeDB();
            return;
        }
        
        // Format all phone numbers
        const phoneNumbers = [];
        const phoneDetails = [];
        
        clientsWithPhone.forEach(client => {
            const phone = client.phone || client.phone_number;
            const formatted = formatPhoneNumber(phone);
            
            if (formatted) {
                phoneNumbers.push(formatted);
                phoneDetails.push({
                    name: client.name || client.full_name || client.pppoe_username,
                    original: phone,
                    formatted: formatted
                });
            }
        });
        
        // Remove duplicates
        const uniquePhoneNumbers = [...new Set(phoneNumbers)];
        console.log(`📱 Nomor unik: ${uniquePhoneNumbers.length}\n`);
        
        // Display all phone numbers
        console.log('📋 Daftar nomor WhatsApp yang akan ditambahkan:');
        console.log('─'.repeat(80));
        phoneDetails.forEach((detail, index) => {
            console.log(`${index + 1}. ${detail.name}`);
            console.log(`   Original: ${detail.original}`);
            console.log(`   Formatted: ${detail.formatted}`);
        });
        console.log('─'.repeat(80));
        console.log();
        
        // Try to add to OpenClaw allowlist
        console.log('🔄 Menambahkan nomor ke OpenClaw allowlist...\n');
        
        let successCount = 0;
        let failCount = 0;
        const results = [];
        
        for (const phoneNumber of uniquePhoneNumbers) {
            console.log(`Processing: ${phoneNumber}...`);
            const result = await addToOpenClawAllowlist(phoneNumber);
            
            if (result.success) {
                console.log(`✅ Berhasil: ${phoneNumber}`);
                successCount++;
            } else {
                console.log(`❌ Gagal: ${phoneNumber}`);
                console.log(`   Error: ${result.error}`);
                if (result.status) {
                    console.log(`   Status: ${result.status}`);
                }
                if (result.data) {
                    console.log(`   Data: ${JSON.stringify(result.data)}`);
                }
                failCount++;
            }
            
            results.push({
                phoneNumber,
                success: result.success,
                error: result.error
            });
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log();
        console.log('─'.repeat(80));
        console.log('📊 SUMMARY');
        console.log('─'.repeat(80));
        console.log(`Total nomor unik: ${uniquePhoneNumbers.length}`);
        console.log(`✅ Berhasil ditambahkan: ${successCount}`);
        console.log(`❌ Gagal ditambahkan: ${failCount}`);
        console.log('─'.repeat(80));
        console.log();
        
        // If API failed, provide manual instructions
        if (failCount > 0) {
            console.log('⚠️  Beberapa nomor gagal ditambahkan via API');
            console.log('📋 SOLUSI MANUAL:');
            console.log();
            console.log('1. Buka dashboard OpenClaw di browser:');
            console.log(`   ${OPENCLAW_API_URL}`);
            console.log();
            console.log('2. Masuk ke menu Settings/Configuration');
            console.log('3. Cari bagian "allowFrom" atau "Allowed Numbers"');
            console.log('4. Tambahkan semua nomor berikut:');
            console.log();
            console.log('   allowFrom: [');
            uniquePhoneNumbers.forEach((phone, index) => {
                const comma = index < uniquePhoneNumbers.length - 1 ? ',' : '';
                console.log(`     "${phone}"${comma}`);
            });
            console.log('   ]');
            console.log();
            console.log('5. Simpan konfigurasi dan restart service OpenClaw');
            console.log();
            
            // Also save to file for easy reference
            const fs = require('fs');
            const outputPath = path.join(__dirname, 'openclaw-allowlist-numbers.json');
            const allowlistData = {
                allowFrom: uniquePhoneNumbers,
                details: phoneDetails,
                generatedAt: new Date().toISOString()
            };
            
            fs.writeFileSync(outputPath, JSON.stringify(allowlistData, null, 2));
            console.log(`💾 Daftar nomor juga disimpan ke: ${outputPath}`);
        }
        
        // Close database
        await db.closeDB();
        console.log('\n✅ Selesai!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        await db.closeDB();
        process.exit(1);
    }
}

// Run the script
main();
