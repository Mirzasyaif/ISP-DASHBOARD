const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testSendWhatsApp() {
    const targetPhone = '+6285236022073';
    const messageText = '🧪 *TEST WHATSAPP*\n\nHalo! Ini adalah pesan test dari ISP Dashboard.\n\nJika Anda menerima pesan ini, berarti integrasi WhatsApp sudah berfungsi dengan baik! ✅\n\nWaktu: ' + new Date().toLocaleString('id-ID');
    
    try {
        console.log(`[TEST] Mengirim pesan WhatsApp ke ${targetPhone}...`);
        console.log(`[TEST] Pesan: ${messageText}`);
        
        // Escape quotes untuk shell command
        const escapedMessage = messageText.replace(/'/g, "'\"'\"'");
        
        // Gunakan OpenClaw CLI
        const command = `openclaw message send --channel whatsapp --target "${targetPhone}" --message '${escapedMessage}'`;
        
        console.log(`[TEST] Command: ${command}`);
        
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
        
        console.log('\n✅ [SUCCESS] Pesan berhasil dikirim!');
        console.log('STDOUT:', stdout);
        
        if (stderr && stderr.trim()) {
            console.log('STDERR:', stderr);
        }
        
        return true;
    } catch (error) {
        console.error('\n❌ [ERROR] Gagal mengirim pesan!');
        console.error('Error:', error.message);
        if (error.stdout) console.error('STDOUT:', error.stdout);
        if (error.stderr) console.error('STDERR:', error.stderr);
        return false;
    }
}

// Jalankan test
testSendWhatsApp()
    .then(success => {
        if (success) {
            console.log('\n🎉 Test selesai dengan sukses!');
        } else {
            console.log('\n⚠️ Test gagal. Silakan cek error di atas.');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Unexpected error:', err);
        process.exit(1);
    });