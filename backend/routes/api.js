const express = require('express');
const router = express.Router();
const db = require('../models/db-sqlite');
const config = require('../config/config');
const { authenticateAPI } = require('../middleware/auth');
const { validationRules, validate } = require('../middleware/validation');
const genieacsService = require('../services/genieacsService');

// Get dashboard stats (protected with API key)
router.get('/stats', authenticateAPI, async (req, res) => {
    console.log('📊 /stats endpoint called');
    try {
        const stats = await db.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get financial summary (protected with API key) - SQLite only
router.get('/financial-summary', authenticateAPI, async (req, res) => {
    console.log('💰 /financial-summary endpoint called');
    try {
        const summary = await db.getFinancialSummary();
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users (protected)
router.get('/users', authenticateAPI, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get users with payment status (protected)
router.get('/users/with-payment-status', authenticateAPI, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all PPPoE secrets from Mikrotik (protected)
router.get('/pppoe/secrets', authenticateAPI, async (req, res) => {
    try {
        const secrets = await fetchMikrotikSecrets();
        res.json(secrets);
    } catch (error) {
        console.error('Error fetching secrets:', error);
        // Return sample data for demo
        res.json([
            { name: 'user1', service: 'pppoe', profile: '10Mbps', disabled: false, comment: 'Demo user 1' },
            { name: 'user2', service: 'pppoe', profile: '20Mbps', disabled: false, comment: 'Demo user 2' },
            { name: 'user3', service: 'pppoe', profile: '30Mbps', disabled: true, comment: 'Disabled user' },
            { name: 'john_doe', service: 'pppoe', profile: '50Mbps', disabled: false, comment: 'VIP Customer' },
            { name: 'jane_smith', service: 'pppoe', profile: '20Mbps', disabled: false, comment: 'Residential' }
        ]);
    }
});

// Helper function to fetch secrets from Mikrotik
async function fetchMikrotikSecrets() {
    try {
        const RouterOS = require('node-routeros').RouterOSAPI;
        const currentConfig = config.getConfig();
        
        if (!currentConfig.mikrotik_ip || !currentConfig.mikrotik_user || !currentConfig.mikrotik_pass) {
            throw new Error('Mikrotik configuration missing');
        }
        
        const mikrotik = new RouterOS({
            host: currentConfig.mikrotik_ip,
            user: currentConfig.mikrotik_user,
            password: currentConfig.mikrotik_pass,
            port: currentConfig.mikrotik_port || 8728,
            timeout: 5000
        });
        
        await mikrotik.connect();
        const secrets = await mikrotik.write('/ppp/secret/print');
        mikrotik.close();
        
        // Transform to array and format
        const secretList = Array.isArray(secrets) ? secrets : [secrets];
        return secretList.map(secret => ({
            name: secret.name || '',
            service: secret.service || 'any',
            profile: secret.profile || 'default',
            disabled: secret.disabled === 'true',
            comment: secret.comment || ''
        }));
    } catch (error) {
        console.error('Failed to fetch Mikrotik secrets:', error);
        throw error;
    }
}

// Add new user (with validation and API key) - Updated for GenieACS integration
router.post('/users', authenticateAPI, validationRules.createUser, validate, async (req, res) => {
    const { 
        pppoe_username, 
        full_name, 
        address, 
        phone, 
        plan,
        cpe_serial_number,
        cpe_model,
        wifi_ssid,
        wifi_password,
        ip_address,
        monthly_fee
    } = req.body;
    
    try {
        // Tambah user ke database
        const user = await db.addUser({ 
            pppoe_username, 
            full_name, 
            address, 
            phone, 
            plan,
            ip_address,
            monthly_fee,
            cpe_serial_number,
            cpe_model,
            wifi_ssid,
            wifi_password
        });
        
        // Jika ada data CPE, provision ke GenieACS
        let genieacsResult = null;
        if (cpe_serial_number) {
            console.log('📡 Provisioning client to GenieACS...');
            genieacsResult = await genieacsService.provisionClient({
                pppoe_username,
                pppoe_password: pppoe_username, // Default password sama dengan username
                cpe_serial_number,
                cpe_model,
                wifi_ssid,
                wifi_password
            });
            
            // Update database dengan status GenieACS
            if (genieacsResult.success) {
                await db.updateClientGenieACSStatus(user.id, genieacsResult.deviceId, 'provisioned');
            } else {
                await db.updateClientGenieACSStatus(user.id, null, 'failed');
            }
        }
        
        res.json({ 
            success: true, 
            id: user.id,
            genieacs: genieacsResult
        });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update payment status (with validation and API key)
router.post('/payments/mark-paid', authenticateAPI, validationRules.updatePayment, validate, async (req, res) => {
    const { username } = req.body;
    try {
        const success = await db.updatePayment(username);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test Mikrotik connection (with validation)
router.post('/config/test', authenticateAPI, validationRules.mikrotikConfig, validate, async (req, res) => {
    const { mikrotik_ip, mikrotik_user, mikrotik_pass, mikrotik_port } = req.body;
    
    try {
        const RouterOS = require('node-routeros').RouterOSAPI;
        const mikrotik = new RouterOS({
            host: mikrotik_ip,
            user: mikrotik_user,
            password: mikrotik_pass,
            port: mikrotik_port || 8728,
            timeout: 5000
        });
        
        await mikrotik.connect();
        mikrotik.close();
        res.json({ success: true, message: 'Mikrotik connection successful' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Setup configuration (with validation)
router.post('/config/setup', authenticateAPI, validationRules.mikrotikConfig, validationRules.telegramConfig, validate, async (req, res) => {
    const configData = req.body;
    try {
        // Save configuration
        await db.updateConfig(configData);
        
        // Mark setup as completed
        await db.updateConfig({ setup_completed: true });
        
        // Initialize database
        await db.initDB();
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/dashboard', authenticateAPI, async (req, res) => {
    try {
        const summary = await db.getFinancialSummary();
        const totalRevenue = summary?.totalRevenue ?? 0;
        const totalExpenses = summary?.totalExpenses ?? 0;
        const netProfit = summary?.totalProfit ?? 0;
        const lastUpdated = new Date().toISOString();
        res.json({
            totalRevenue,
            totalExpenses,
            netProfit,
            lastUpdated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GenieACS endpoints
router.get('/genieacs/test', authenticateAPI, async (req, res) => {
    try {
        const result = await genieacsService.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/genieacs/device/:serialNumber', authenticateAPI, async (req, res) => {
    try {
        const { serialNumber } = req.params;
        const result = await genieacsService.getDeviceStatus(serialNumber);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/genieacs/provision', authenticateAPI, async (req, res) => {
    try {
        const clientData = req.body;
        const result = await genieacsService.provisionClient(clientData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// OpenClaw Allowlist Management
const ALLOWLIST_FILE = '/home/mirza/.openclaw/credentials/whatsapp-allowFrom.json';

// Get current allowlist
router.get('/openclaw/allowlist', authenticateAPI, async (req, res) => {
    try {
        const fs = require('fs');
        
        if (!fs.existsSync(ALLOWLIST_FILE)) {
            return res.json({ version: 1, allowFrom: [] });
        }
        
        const data = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Sync allowlist from database
router.post('/openclaw/allowlist/sync', authenticateAPI, async (req, res) => {
    try {
        const fs = require('fs');
        
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
        
        // Write new allowlist
        const newAllowlistData = {
            version: 1,
            allowFrom: allowlist
        };
        
        fs.writeFileSync(ALLOWLIST_FILE, JSON.stringify(newAllowlistData, null, 2));
        
        res.json({ 
            success: true, 
            message: 'Allowlist synced successfully',
            count: allowlist.length,
            allowlist: allowlist
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Restart OpenClaw services
router.post('/openclaw/restart', authenticateAPI, async (req, res) => {
    try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        // Kill existing OpenClaw processes
        await execPromise('pkill -f openclaw');
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start OpenClaw gateway
        await execPromise('openclaw gateway --port 18789 > /dev/null 2>&1 &');
        
        res.json({ 
            success: true, 
            message: 'OpenClaw services restarted successfully' 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
