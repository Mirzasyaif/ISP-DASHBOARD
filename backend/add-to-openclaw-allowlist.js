/**
 * Script untuk menambahkan nomor ke allowlist OpenClaw
 * Usage: node add-to-openclaw-allowlist.js <nomor_wa>
 * Example: node add-to-openclaw-allowlist.js 6285206091996
 */

const axios = require('axios');

// Konfigurasi dari .env
const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:18789';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || 'ce1ebc0e76bff95e804903b2bb92b513f1154ee4dd52325a';

async function addToAllowlist(phoneNumber) {
    // Format nomor: hapus + dan 0 di depan jika ada
    let formattedNumber = phoneNumber.replace(/\+/g, '').replace(/^0/, '62');
    
    try {
        
        console.log(`📱 Menambahkan nomor ${formattedNumber} ke allowlist OpenClaw...`);
        
        // Coba endpoint untuk menambahkan ke allowlist
        const response = await axios.post(
            `${OPENCLAW_API_URL}/api/allowlist`,
            {
                phoneNumber: formattedNumber,
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
        
        console.log('✅ Berhasil menambahkan ke allowlist!');
        console.log('Response:', response.data);
        return true;
        
    } catch (error) {
        console.error('❌ Gagal menambahkan ke allowlist:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        
        // Coba alternatif: gunakan endpoint config
        console.log('\n🔄 Mencoba alternatif via config endpoint...');
        try {
            const configResponse = await axios.post(
                `${OPENCLAW_API_URL}/api/config`,
                {
                    allowFrom: [phoneNumber.replace(/\+/g, '')]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENCLAW_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );
            
            console.log('✅ Berhasil via config endpoint!');
            console.log('Response:', configResponse.data);
            return true;
            
        } catch (configError) {
            console.error('❌ Gagal via config endpoint:', configError.message);
            
            // Coba cek status dan info API
            console.log('\n🔍 Mencoba mendapatkan info API OpenClaw...');
            try {
                const infoResponse = await axios.get(`${OPENCLAW_API_URL}/api/info`, {
                    headers: {
                        'Authorization': `Bearer ${OPENCLAW_API_KEY}`
                    },
                    timeout: 10000
                });
                console.log('✅ API Info:', infoResponse.data);
            } catch (infoError) {
                console.log('⚠️ Tidak bisa mendapatkan info API');
            }
            
            // Berikan solusi manual
            console.log('\n📋 SOLUSI MANUAL:');
            console.log('1. Buka dashboard OpenClaw di browser');
            console.log('2. Masuk ke menu Settings/Configuration');
            console.log('3. Cari bagian "allowFrom" atau "Allowed Numbers"');
            console.log('4. Tambahkan nomor:', formattedNumber);
            console.log('5. Simpan konfigurasi');
            console.log('\nAtau edit file config OpenClaw langsung:');
            console.log('- Cari file config.json di instalasi OpenClaw');
            console.log('- Tambahkan nomor ke array "allowFrom"');
            console.log('- Restart service OpenClaw');
            console.log('\nContoh config.json:');
            console.log(JSON.stringify({
                allowFrom: [formattedNumber, "+628984850868"]
            }, null, 2));
            
            return false;
        }
    }
}

// Cek argumen command line
const phoneNumber = process.argv[2];

if (!phoneNumber) {
    console.log('❌ Error: Nomor telepon tidak diberikan');
    console.log('\nUsage: node add-to-openclaw-allowlist.js <nomor_wa>');
    console.log('Example: node add-to-openclaw-allowlist.js 6285206091996');
    console.log('         node add-to-openclaw-allowlist.js +6285206091996');
    console.log('         node add-to-openclaw-allowlist.js 085206091996');
    process.exit(1);
}

// Jalankan script
addToAllowlist(phoneNumber)
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Error tidak terduga:', error);
        process.exit(1);
    });
