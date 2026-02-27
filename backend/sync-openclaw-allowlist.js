/**
 * Script untuk sync semua nomor telepon dari database ke OpenClaw allowlist
 * Usage: node sync-openclaw-allowlist.js
 */

const db = require('./models/db-sqlite');
const fs = require('fs');
const path = require('path');

const ALLOWLIST_FILE = '/home/mirza/.openclaw/credentials/whatsapp-allowFrom.json';

async function syncAllowlist() {
    try {
        console.log('🔄 Syncing phone numbers from database to OpenClaw allowlist...\n');
        
        // Initialize database
        await db.initDB();
        
        // Get all clients with phone numbers
        const clients = await db.getAllClients();
        
        // Extract unique phone numbers
        const phoneNumbers = new Set();
        const adminNumber = '+6285236022073'; // Admin number should always be included
        
        // Add admin number first
        phoneNumbers.add(adminNumber);
        
        // Add all client phone numbers
        clients.forEach(client => {
            if (client.phone_number && client.phone_number.trim() !== '') {
                // Format: ensure it starts with +
                let formatted = client.phone_number.trim();
                if (!formatted.startsWith('+')) {
                    formatted = '+' + formatted;
                }
                phoneNumbers.add(formatted);
            }
        });
        
        // Convert to array and sort
        const allowlist = Array.from(phoneNumbers).sort();
        
        console.log(`📱 Found ${allowlist.length} unique phone numbers:`);
        allowlist.forEach(num => {
            const isAdmin = num === adminNumber;
            const client = clients.find(c => {
                let phone = c.phone_number ? c.phone_number.trim() : '';
                if (!phone.startsWith('+')) phone = '+' + phone;
                return phone === num;
            });
            const label = isAdmin ? '(Admin)' : (client ? `(${client.name || client.pppoe_username})` : '');
            console.log(`  - ${num} ${label}`);
        });
        
        // Read current allowlist
        let currentAllowlist = [];
        if (fs.existsSync(ALLOWLIST_FILE)) {
            const currentData = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8'));
            currentAllowlist = currentData.allowFrom || [];
        }
        
        console.log(`\n📊 Current allowlist: ${currentAllowlist.length} numbers`);
        console.log(`📊 New allowlist: ${allowlist.length} numbers`);
        
        // Write new allowlist
        const newAllowlistData = {
            version: 1,
            allowFrom: allowlist
        };
        
        fs.writeFileSync(ALLOWLIST_FILE, JSON.stringify(newAllowlistData, null, 2));
        
        console.log(`\n✅ Allowlist updated successfully!`);
        console.log(`📁 File: ${ALLOWLIST_FILE}`);
        
        // Show what was added
        const added = allowlist.filter(num => !currentAllowlist.includes(num));
        if (added.length > 0) {
            console.log(`\n➕ Added ${added.length} new numbers:`);
            added.forEach(num => {
                const client = clients.find(c => {
                    let phone = c.phone_number ? c.phone_number.trim() : '';
                    if (!phone.startsWith('+')) phone = '+' + phone;
                    return phone === num;
                });
                const label = client ? `(${client.name || client.pppoe_username})` : '';
                console.log(`  - ${num} ${label}`);
            });
        }
        
        // Show what was removed
        const removed = currentAllowlist.filter(num => !allowlist.includes(num));
        if (removed.length > 0) {
            console.log(`\n➖ Removed ${removed.length} numbers:`);
            removed.forEach(num => console.log(`  - ${num}`));
        }
        
        console.log('\n⚠️  Don\'t forget to restart OpenClaw services:');
        console.log('   pkill -f openclaw');
        console.log('   openclaw gateway --port 18789 > /dev/null 2>&1 &');
        
        // Close database
        db.closeDB();
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error syncing allowlist:', error);
        process.exit(1);
    }
}

// Run the sync
syncAllowlist();
