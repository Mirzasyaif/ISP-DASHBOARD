/**
 * Sync OpenClow Allowlist from ISP Dashboard Database
 */

const db = require('./models/db-sqlite');
const fs = require('fs');
const path = require('path');

const OPENCLAW_ALLOWLIST_PATH = '/home/mirza/.openclaw/openclaw.json';
const BACKUP_ALLOWLIST_PATH = path.join(__dirname, 'openclaw-allowlist-numbers.json');

function formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    if (cleaned.startsWith('+62')) cleaned = cleaned.substring(1);
    if (cleaned.startsWith('62') && cleaned.length >= 11 && cleaned.length <= 14) {
        return cleaned;
    }
    return null;
}

async function getAllPhoneNumbers() {
    try {
        await db.initDB();
        const clients = await db.getAllClients();
        const phoneNumbers = [];
        for (const client of clients) {
            const formattedPhone = formatPhoneNumber(client.phone_number || client.phone);
            if (formattedPhone) {
                phoneNumbers.push({
                    phone: formattedPhone,
                    username: client.pppoe_username,
                    name: client.full_name || client.name
                });
            }
        }
        console.log(`✅ Found ${phoneNumbers.length} valid phone numbers in database`);
        return phoneNumbers;
    } catch (error) {
        console.error('❌ Error fetching phone numbers:', error);
        throw error;
    } finally {
        db.closeDB();
    }
}

async function updateOpenClawConfig(phoneNumbers) {
    try {
        let openclawConfig = {};
        if (fs.existsSync(OPENCLAW_ALLOWLIST_PATH)) {
            const configContent = fs.readFileSync(OPENCLAW_ALLOWLIST_PATH, 'utf8');
            openclawConfig = JSON.parse(configContent);
        }
        const allowlist = phoneNumbers.map(p => p.phone);
        if (!openclawConfig.channels) openclawConfig.channels = {};
        if (!openclawConfig.channels.whatsapp) openclawConfig.channels.whatsapp = {};
        openclawConfig.channels.whatsapp.dmPolicy = 'allowlist';
        openclawConfig.channels.whatsapp.allowFrom = allowlist;
        fs.writeFileSync(OPENCLAW_ALLOWLIST_PATH, JSON.stringify(openclawConfig, null, 2), 'utf8');
        console.log(`✅ Updated OpenClaw config with ${allowlist.length} phone numbers`);
        fs.writeFileSync(BACKUP_ALLOWLIST_PATH, JSON.stringify(phoneNumbers, null, 2), 'utf8');
        console.log(`✅ Saved backup to ${BACKUP_ALLOWLIST_PATH}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating OpenClaw config:', error);
        throw error;
    }
}

async function main() {
    console.log('🔄 Starting OpenClaw allowlist sync from database...\n');
    try {
        const phoneNumbers = await getAllPhoneNumbers();
        if (phoneNumbers.length === 0) {
            console.log('⚠️  No phone numbers found in database');
            return;
        }
        console.log('\n📋 Sample phone numbers:');
        phoneNumbers.slice(0, 5).forEach(p => {
            console.log(`  - ${p.phone} (${p.username} - ${p.name})`);
        });
        if (phoneNumbers.length > 5) {
            console.log(`  ... and ${phoneNumbers.length - 5} more`);
        }
        await updateOpenClawConfig(phoneNumbers);
        console.log('\n✅ Sync completed successfully!');
        console.log(`\n📊 Summary:`);
        console.log(`  - Total phone numbers synced: ${phoneNumbers.length}`);
        console.log(`  - OpenClaw config updated: ${OPENCLAW_ALLOWLIST_PATH}`);
        console.log(`  - Backup saved: ${BACKUP_ALLOWLIST_PATH}`);
    } catch (error) {
        console.error('\n❌ Sync failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { getAllPhoneNumbers, updateOpenClawConfig };