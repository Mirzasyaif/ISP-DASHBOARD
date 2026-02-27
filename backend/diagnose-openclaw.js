const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Load environment variables
require('dotenv').config();

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:8080';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

console.log('🔍 DIAGNOSTIK OPENCLAW - ISP Dashboard');
console.log('========================================\n');

async function checkProcess() {
    console.log('1️⃣  Cek Process OpenClaw...');
    try {
        const { stdout } = await execPromise('ps aux | grep -i openclaw | grep -v grep');
        if (stdout.trim()) {
            console.log('✅ OpenClaw process BERJALAN');
            console.log(stdout);
            return true;
        } else {
            console.log('❌ OpenClaw process TIDAK berjalan');
            return false;
        }
    } catch (error) {
        console.log('❌ Gagal mengecek process:', error.message);
        return false;
    }
}

async function checkPorts() {
    console.log('\n2️⃣  Cek Port yang digunakan...');
    const ports = [18789, 8080, 3000];
    
    for (const port of ports) {
        try {
            const { stdout } = await execPromise(`netstat -tlnp 2>/dev/null | grep :${port} || ss -tlnp 2>/dev/null | grep :${port}`);
            if (stdout.trim()) {
                console.log(`✅ Port ${port}: TERBUKA`);
                console.log(stdout);
            } else {
                console.log(`⚪ Port ${port}: Tidak terpakai`);
            }
        } catch (error) {
            console.log(`⚪ Port ${port}: Tidak terpakai`);
        }
    }
}

async function checkAPIConnection() {
    console.log('\n3️⃣  Cek Koneksi ke OpenClaw API...');
    console.log(`   URL: ${OPENCLAW_API_URL}`);
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (OPENCLAW_API_KEY) {
            headers['Authorization'] = `Bearer ${OPENCLAW_API_KEY}`;
        }
        
        // Test dengan endpoint yang umum
        const response = await axios.get(
            `${OPENCLAW_API_URL}/health`,
            { headers, timeout: 5000 }
        );
        
        console.log('✅ Koneksi API BERHASIL');
        console.log('   Status:', response.status);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        return true;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Koneksi DITOLAK (ECONNREFUSED)');
            console.log('   OpenClaw service tidak berjalan atau port salah');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('❌ Koneksi TIMEOUT (ETIMEDOUT)');
            console.log('   OpenClaw service merespon terlalu lambat');
        } else {
            console.log('❌ Error koneksi:', error.message);
        }
        return false;
    }
}

async function checkSessionStatus() {
    console.log('\n4️⃣  Cek Status Session WhatsApp...');
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (OPENCLAW_API_KEY) {
            headers['Authorization'] = `Bearer ${OPENCLAW_API_KEY}`;
        }
        
        // Coba cek session (endpoint bisa berbeda tergantung versi OpenClaw)
        const response = await axios.get(
            `${OPENCLAW_API_URL}/sessions`,
            { headers, timeout: 5000 }
        );
        
        console.log('✅ Session check BERHASIL');
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        return true;
    } catch (error) {
        console.log('⚠️  Gagal cek session:', error.message);
        console.log('   Endpoint /sessions mungkin tidak tersedia');
        return false;
    }
}

async function checkConfiguration() {
    console.log('\n5️⃣  Cek Konfigurasi...');
    console.log(`   OPENCLAW_API_URL: ${OPENCLAW_API_URL}`);
    console.log(`   OPENCLAW_API_KEY: ${OPENCLAW_API_KEY ? '✅ Terkonfigurasi' : '❌ Tidak terkonfigurasi'}`);
    
    // Cek allowlist
    const fs = require('fs');
    const allowlistPath = './openclaw-allowlist-numbers.json';
    
    if (fs.existsSync(allowlistPath)) {
        try {
            const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
            console.log(`   Allowlist: ✅ ${allowlist.length} nomor terdaftar`);
        } catch (error) {
            console.log('   Allowlist: ❌ Gagal membaca file');
        }
    } else {
        console.log('   Allowlist: ⚠️  File tidak ditemukan');
    }
}

async function main() {
    try {
        await checkProcess();
        await checkPorts();
        await checkAPIConnection();
        await checkSessionStatus();
        await checkConfiguration();
        
        console.log('\n========================================');
        console.log('📋 DIAGNOSTIK SELESAI');
        console.log('========================================\n');
        console.log('💡 Rekomendasi:');
        console.log('   1. Jika OpenClaw tidak berjalan, start service OpenClaw');
        console.log('   2. Jika port salah, update OPENCLAW_API_URL di .env');
        console.log('   3. Jika session terputus, re-scan QR Code di dashboard OpenClaw');
        console.log('   4. Jika API key expired, generate API key baru di dashboard OpenClaw');
        
    } catch (error) {
        console.error('\n❌ Error diagnostik:', error.message);
        process.exit(1);
    }
}

main();
