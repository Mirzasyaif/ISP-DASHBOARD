const express = require('express');
const router = express.Router();
const db = require('../models/db-sqlite');
const { authenticateAPI } = require('../middleware/auth');

// ==================== App Settings API ====================
// Get all app settings (Mikrotik, Telegram, etc.)
router.get('/app-settings', authenticateAPI, async (req, res) => {
    try {
        // Get settings from SQLite config table
        const config = await db.getConfig();
        
        res.json({ 
            success: true, 
            settings: {
                // Mikrotik settings
                mikrotik_ip: config.mikrotik_ip || '',
                mikrotik_user: config.mikrotik_user || '',
                mikrotik_pass: '', // Never return password for security
                mikrotik_port: config.mikrotik_port || 8728,
                mikrotik_has_password: !!config.mikrotik_pass,
                
                // Telegram settings
                telegram_token: '', // Never return full token for security
                telegram_admin_id: config.telegram_admin_id || '',
                telegram_has_token: !!config.telegram_token,
                
                // WhatsApp settings
                whatsapp_channel: config.whatsapp_channel || 'whatsapp',
                whatsapp_test_phone: config.whatsapp_test_phone || '',
                openclaw_path: config.openclaw_path || 'openclaw',
                whatsapp_configured: !!(config.whatsapp_channel || config.openclaw_path),
                
                // Server settings
                api_key: '', // Never return API key
                api_base_url: config.api_base_url || ''
            }
        });
    } catch (error) {
        console.error('[Settings API ERROR] Failed to get app settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save Mikrotik settings
router.post('/mikrotik', authenticateAPI, async (req, res) => {
    try {
        const { mikrotik_ip, mikrotik_user, mikrotik_pass, mikrotik_port } = req.body;
        
        // Validate required fields
        if (!mikrotik_ip) {
            return res.status(400).json({ 
                success: false, 
                error: 'Mikrotik IP is required' 
            });
        }
        
        // Prepare settings to save
        const settingsToSave = {
            mikrotik_ip: mikrotik_ip,
            mikrotik_user: mikrotik_user || 'admin',
            mikrotik_port: mikrotik_port || 8728
        };
        
        // Only update password if provided (not empty)
        if (mikrotik_pass && mikrotik_pass.trim() !== '') {
            settingsToSave.mikrotik_pass = mikrotik_pass;
        }
        
        // Save to SQLite config table
        const updatedConfig = await db.updateConfig(settingsToSave);
        
        res.json({ 
            success: true, 
            message: 'Mikrotik settings saved successfully',
            settings: {
                mikrotik_ip: updatedConfig.mikrotik_ip,
                mikrotik_user: updatedConfig.mikrotik_user,
                mikrotik_port: updatedConfig.mikrotik_port,
                mikrotik_has_password: !!updatedConfig.mikrotik_pass
            }
        });
        
    } catch (error) {
        console.error('[Settings API ERROR] Failed to save Mikrotik settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save Telegram settings
router.post('/telegram', authenticateAPI, async (req, res) => {
    try {
        const { telegram_token, telegram_admin_id } = req.body;
        
        // Prepare settings to save
        const settingsToSave = {};
        
        // Only update token if provided (not empty)
        if (telegram_token && telegram_token.trim() !== '') {
            settingsToSave.telegram_token = telegram_token.trim();
        }
        
        if (telegram_admin_id !== undefined) {
            settingsToSave.telegram_admin_id = telegram_admin_id.trim();
        }
        
        // Save to SQLite config table
        const updatedConfig = await db.updateConfig(settingsToSave);
        
        res.json({ 
            success: true, 
            message: 'Telegram settings saved successfully',
            settings: {
                telegram_has_token: !!updatedConfig.telegram_token,
                telegram_admin_id: updatedConfig.telegram_admin_id || ''
            }
        });
        
    } catch (error) {
        console.error('[Settings API ERROR] Failed to save Telegram settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get WhatsApp settings
router.get('/whatsapp', authenticateAPI, async (req, res) => {
    try {
        // Get settings from SQLite config table
        const config = await db.getConfig();
        
        res.json({ 
            success: true, 
            settings: {
                whatsapp_channel: config.whatsapp_channel || 'whatsapp',
                whatsapp_test_phone: config.whatsapp_test_phone || '',
                openclaw_path: config.openclaw_path || 'openclaw',
                whatsapp_configured: !!(config.whatsapp_channel || config.openclaw_path)
            }
        });
    } catch (error) {
        console.error('[Settings API ERROR] Failed to get WhatsApp settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save WhatsApp settings
router.post('/whatsapp', authenticateAPI, async (req, res) => {
    try {
        const { whatsapp_channel, whatsapp_test_phone, openclaw_path } = req.body;
        
        // Prepare settings to save
        const settingsToSave = {};
        
        if (whatsapp_channel !== undefined) {
            settingsToSave.whatsapp_channel = whatsapp_channel.trim() || 'whatsapp';
        }
        
        if (whatsapp_test_phone !== undefined) {
            settingsToSave.whatsapp_test_phone = whatsapp_test_phone.trim();
        }
        
        if (openclaw_path !== undefined) {
            settingsToSave.openclaw_path = openclaw_path.trim() || 'openclaw';
        }
        
        // Save to SQLite config table
        const updatedConfig = await db.updateConfig(settingsToSave);
        
        res.json({ 
            success: true, 
            message: 'WhatsApp settings saved successfully',
            settings: {
                whatsapp_channel: updatedConfig.whatsapp_channel || 'whatsapp',
                whatsapp_test_phone: updatedConfig.whatsapp_test_phone || '',
                openclaw_path: updatedConfig.openclaw_path || 'openclaw'
            }
        });
        
    } catch (error) {
        console.error('[Settings API ERROR] Failed to save WhatsApp settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test Mikrotik connection with saved settings
router.post('/mikrotik/test', authenticateAPI, async (req, res) => {
    try {
        const config = await db.getConfig();
        
        // Use saved settings or override with request body if provided
        const testConfig = {
            host: req.body.mikrotik_ip || config.mikrotik_ip,
            user: req.body.mikrotik_user || config.mikrotik_user,
            password: req.body.mikrotik_pass || config.mikrotik_pass,
            port: req.body.mikrotik_port || config.mikrotik_port || 8728
        };
        
        if (!testConfig.host) {
            return res.status(400).json({ 
                success: false, 
                error: 'Mikrotik IP not configured. Please save Mikrotik settings first.' 
            });
        }
        
        if (!testConfig.user) {
            return res.status(400).json({ 
                success: false, 
                error: 'Mikrotik username not configured. Please save Mikrotik settings first.' 
            });
        }
        
        if (!testConfig.password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Mikrotik password not configured. Please save Mikrotik settings first.' 
            });
        }
        
        // Use node-routeros (RouterOSAPI) for connection test
        const RouterOS = require('node-routeros').RouterOSAPI;
        
        const client = new RouterOS({
            host: testConfig.host,
            user: testConfig.user,
            password: testConfig.password,
            port: testConfig.port,
            timeout: 10000
        });
        
        try {
            console.log(`[Mikrotik Test] Connecting to ${testConfig.host}:${testConfig.port}...`);
            await client.connect();
            console.log('[Mikrotik Test] Connected, getting system info...');
            
            // Get system identity
            const identity = await client.write('/system/identity/print');
            const routerName = identity[0]?.name || 'Unknown';
            
            // Get system resources
            const resources = await client.write('/system/resource/print');
            const resourceInfo = resources[0] || {};
            
            await client.close();
            console.log('[Mikrotik Test] Connection successful, router:', routerName);
            
            res.json({ 
                success: true, 
                message: 'Mikrotik connection successful',
                data: {
                    routerName: routerName,
                    version: resourceInfo.version || 'Unknown',
                    uptime: resourceInfo.uptime || 'Unknown',
                    board: resourceInfo.board_name || 'Unknown',
                    cpu: resourceInfo.cpu || 'Unknown'
                }
            });
        } catch (connError) {
            console.error('[Mikrotik Test] Connection failed:', connError.message);
            
            // Provide more specific error messages
            let errorMessage = connError.message;
            if (connError.message.includes('invalid') || connError.message.includes('authentication')) {
                errorMessage = 'Username or password is invalid. Please check your credentials in Mikrotik settings.';
            } else if (connError.message.includes('ECONNREFUSED')) {
                errorMessage = 'Connection refused. Please check if the IP address and API port are correct.';
            } else if (connError.message.includes('ETIMEDOUT') || connError.message.includes('timeout')) {
                errorMessage = 'Connection timeout. Please check if the Mikrotik is reachable and API service is enabled.';
            } else if (connError.message.includes('ENOTFOUND')) {
                errorMessage = 'Host not found. Please check the IP address.';
            }
            
            res.json({ 
                success: false, 
                error: `Connection failed: ${errorMessage}` 
            });
        }
        
    } catch (error) {
        console.error('[Settings API ERROR] Failed to test Mikrotik:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all users with editable fields (for settings table)
router.get('/users', authenticateAPI, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        
        // Format data untuk settings table
        const formattedUsers = users.map(user => ({
            id: user.id,
            pppoe_username: user.pppoe_username,
            name: user.name || user.full_name || user.pppoe_username,
            phone: user.phone || null,
            phone_number: user.phone_number || null,
            monthly_fee: user.monthly_fee,
            due_date: user.due_date,
            status: user.status,
            plan: user.plan,
            full_name: user.full_name,
            category: user.category,
            last_paid_month: user.last_paid_month,
            created_at: user.created_at,
            // Validation flags
            has_phone: !!(user.phone_number || user.phone),
            has_due_date: !!user.due_date,
            due_date_valid: user.due_date ? !isNaN(new Date(user.due_date).getTime()) : false
        }));
        
        res.json({ success: true, users: formattedUsers });
    } catch (error) {
        console.error('[Settings API ERROR] Failed to get users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update bulk user data
router.post('/update-bulk', authenticateAPI, async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Updates array is required' 
            });
        }
        
        const results = [];
        const errors = [];
        
        for (const update of updates) {
            const { userId, field, value } = update;
            
            if (!userId || !field) {
                errors.push({ userId, field, error: 'Missing userId or field' });
                continue;
            }
            
            try {
                // Get user first
                const user = await db.getUserById(userId);
                if (!user) {
                    errors.push({ userId, field, error: 'User not found' });
                    continue;
                }
                
                // Update based on field
                let success = false;
                if (field === 'phone_number' || field === 'phone') {
                    // Update phone number (prioritize phone_number)
                    success = await db.updateUserPhoneNumber(userId, value);
                } else if (field === 'due_date') {
                    // Validate date format
                    const date = new Date(value);
                    if (isNaN(date.getTime())) {
                        errors.push({ userId, field, error: 'Invalid date format' });
                        continue;
                    }
                    // Update due_date - need to implement function in db-sqlite
                    // For now, we'll do a raw SQL update
                    success = await updateUserDueDate(userId, value);
                } else if (field === 'monthly_fee') {
                    success = await db.updateUserMonthlyFee(user.pppoe_username, value);
                } else {
                    errors.push({ userId, field, error: `Field '${field}' not supported for bulk update` });
                    continue;
                }
                
                if (success) {
                    results.push({ userId, field, value, success: true });
                } else {
                    errors.push({ userId, field, error: 'Database update failed' });
                }
            } catch (error) {
                errors.push({ userId, field, error: error.message });
            }
        }
        
        res.json({ 
            success: errors.length === 0,
            message: `Bulk update completed: ${results.length} successful, ${errors.length} failed`,
            results,
            errors
        });
        
    } catch (error) {
        console.error('[Settings API ERROR] Failed to update bulk:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Validate data and return errors
router.get('/validate-data', authenticateAPI, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        
        const validationResults = users.map(user => {
            const errors = [];
            
            // Check phone number
            if (!user.phone_number && !user.phone) {
                errors.push('Missing phone number');
            } else {
                const phone = user.phone_number || user.phone;
                // Simple validation: starts with +62 or 08
                if (!/^(\+62|0)[0-9]{9,12}$/.test(phone)) {
                    errors.push('Invalid phone number format');
                }
            }
            
            // Check due date
            if (!user.due_date) {
                errors.push('Missing due date');
            } else {
                const date = new Date(user.due_date);
                if (isNaN(date.getTime())) {
                    errors.push('Invalid due date format');
                }
            }
            
            // Check monthly fee
            if (!user.monthly_fee || user.monthly_fee <= 0) {
                errors.push('Invalid monthly fee');
            }
            
            return {
                id: user.id,
                pppoe_username: user.pppoe_username,
                name: user.name,
                errors,
                hasErrors: errors.length > 0
            };
        });
        
        const usersWithErrors = validationResults.filter(r => r.hasErrors);
        const usersWithoutErrors = validationResults.filter(r => !r.hasErrors);
        
        res.json({
            success: true,
            validation: {
                totalUsers: users.length,
                usersWithErrors: usersWithErrors.length,
                usersWithoutErrors: usersWithoutErrors.length,
                results: validationResults,
                summary: {
                    missingPhone: users.filter(u => !u.phone_number && !u.phone).length,
                    missingDueDate: users.filter(u => !u.due_date).length,
                    invalidPhoneFormat: users.filter(u => {
                        const phone = u.phone_number || u.phone;
                        return phone && !/^(\+62|0)[0-9]{9,12}$/.test(phone);
                    }).length,
                    invalidDueDate: users.filter(u => u.due_date && isNaN(new Date(u.due_date).getTime())).length
                }
            }
        });
        
    } catch (error) {
        console.error('[Settings API ERROR] Failed to validate data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update due date for a user
router.put('/update-due-date', authenticateAPI, async (req, res) => {
    try {
        const { userId, dueDate } = req.body;
        
        if (!userId || !dueDate) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId and dueDate are required' 
            });
        }
        
        // Validate date
        const date = new Date(dueDate);
        if (isNaN(date.getTime())) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid date format' 
            });
        }
        
        const success = await updateUserDueDate(userId, dueDate);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Due date updated successfully',
                data: {
                    userId,
                    dueDate,
                    updated_at: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to update due date' 
            });
        }
        
    } catch (error) {
        console.error('[Settings API ERROR] Failed to update due date:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to update due date in SQLite
async function updateUserDueDate(userId, dueDate) {
    const dbModule = require('../models/db-sqlite');
    if (dbModule.updateUserDueDate) {
        return dbModule.updateUserDueDate(userId, dueDate);
    }
    
    // Fallback: raw SQL update
    try {
        const Database = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(__dirname, '../data/database.sqlite');
        const db = new Database(dbPath);
        
        const stmt = db.prepare('UPDATE clients SET due_date = ? WHERE id = ?');
        const result = stmt.run(dueDate, userId);
        db.close();
        
        return result.changes > 0;
    } catch (error) {
        console.error('Error updating due date:', error);
        return false;
    }
}

module.exports = router;