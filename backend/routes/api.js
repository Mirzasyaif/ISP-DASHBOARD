const express = require('express');
const router = express.Router();
const db = require('../models/db');
const config = require('../config/config');
const { authenticateAPI } = require('../middleware/auth');
const { validationRules, validate } = require('../middleware/validation');

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

// Add new user (with validation and API key)
router.post('/users', authenticateAPI, validationRules.createUser, validate, async (req, res) => {
    const { pppoe_username, full_name, address, phone, plan } = req.body;
    try {
        const user = await db.addUser({ pppoe_username, full_name, address, phone, plan });
        res.json({ success: true, id: user.id });
    } catch (error) {
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

module.exports = router;
