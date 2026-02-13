const express = require('express');
const router = express.Router();
const RouterOS = require('node-routeros').RouterOSAPI;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const envConfig = require('../config/config').getConfig();
const dbSQLite = require('../models/db-sqlite');

let mikrotik = null;

// Get Mikrotik config from database (priority) or env
function getMikrotikConfig() {
    try {
        const dbConfig = dbSQLite.getConfig();
        return {
            mikrotik_ip: dbConfig.mikrotik_ip || envConfig.mikrotik_ip || '',
            mikrotik_user: dbConfig.mikrotik_user || envConfig.mikrotik_user || '',
            mikrotik_pass: dbConfig.mikrotik_pass || envConfig.mikrotik_pass || '',
            mikrotik_port: dbConfig.mikrotik_port || envConfig.mikrotik_port || 8728
        };
    } catch (error) {
        console.error('Error getting Mikrotik config from database:', error);
        return {
            mikrotik_ip: envConfig.mikrotik_ip || '',
            mikrotik_user: envConfig.mikrotik_user || '',
            mikrotik_pass: envConfig.mikrotik_pass || '',
            mikrotik_port: envConfig.mikrotik_port || 8728
        };
    }
}

// Connect to Mikrotik
async function connectMikrotik() {
    const config = getMikrotikConfig();
    const { mikrotik_ip, mikrotik_user, mikrotik_pass, mikrotik_port } = config;
    
    if (!mikrotik_ip || !mikrotik_user || !mikrotik_pass) {
        throw new Error('Mikrotik configuration missing. Please configure in Settings page.');
    }
    
    console.log(`Connecting to Mikrotik at ${mikrotik_ip}:${mikrotik_port || 8728}...`);
    
    mikrotik = new RouterOS({
        host: mikrotik_ip,
        user: mikrotik_user,
        password: mikrotik_pass,
        port: mikrotik_port || 8728,
        timeout: 5000 // Reduce timeout to 5 seconds
    });

    try {
        await mikrotik.connect();
        console.log('Connected to Mikrotik');
        return true;
    } catch (error) {
        console.error('Mikrotik connection failed:', error.message);
        mikrotik = null;
        return false;
    }
}

// SSH command execution (alternative method)
async function sshCommand(command) {
    const config = getMikrotikConfig();
    const { mikrotik_ip, mikrotik_user, mikrotik_pass } = config;
    
    if (!mikrotik_ip || !mikrotik_user || !mikrotik_pass) {
        throw new Error('Mikrotik SSH configuration missing');
    }
    
    // Build SSH command with password via sshpass (must be installed)
    const sshCmd = `sshpass -p '${mikrotik_pass}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${mikrotik_user}@${mikrotik_ip} '${command}'`;
    
    try {
        const { stdout, stderr } = await execPromise(sshCmd, { timeout: 10000 });
        if (stderr && !stderr.includes('Warning: Permanently added')) {
            console.error('SSH stderr:', stderr);
        }
        return stdout;
    } catch (error) {
        console.error('SSH command failed:', error.message);
        throw new Error(`SSH command failed: ${error.message}`);
    }
}

// Test SSH connection
router.get('/ssh-test', async (req, res) => {
    try {
        console.log('Testing SSH connection to Mikrotik...');
        const output = await sshCommand('/interface print');
        res.json({ success: true, message: 'SSH connection successful', output: output.substring(0, 200) + '...' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'SSH connection failed', error: error.message });
    }
});

// Get PPPoE active users via SSH
router.get('/ssh/pppoe/active', async (req, res) => {
    try {
        const output = await sshCommand('/ppp active print');
        // Parse output (simplistic parsing)
        const lines = output.trim().split('\n');
        const users = [];
        
        lines.forEach(line => {
            if (line.includes('pppoe')) {
                // Simple parsing - in reality would need more robust parsing
                const parts = line.split(/\s+/);
                if (parts.length > 3) {
                    users.push({
                        name: parts[1] || 'unknown',
                        service: 'pppoe',
                        uptime: parts[3] || '0s'
                    });
                }
            }
        });
        
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test Mikrotik connection
router.get('/test', async (req, res) => {
    try {
        const config = getMikrotikConfig();
        console.log('Testing Mikrotik connection...');
        console.log('Config:', config.mikrotik_ip, config.mikrotik_user, config.mikrotik_port);
        
        const success = await connectMikrotik();
        if (success) {
            res.json({ success: true, message: 'Mikrotik connection successful' });
        } else {
            res.status(500).json({ success: false, message: 'Mikrotik connection failed' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get PPPoE active users
router.get('/pppoe/active', async (req, res) => {
    try {
        if (!mikrotik) {
            const connected = await connectMikrotik();
            if (!connected) {
                // Return sample data for demo purposes
                console.log('Mikrotik not connected, returning sample data');
                return res.json([
                    { ".id": "*1", "name": "DEMO_USER", "service": "pppoe", "uptime": "5h30m", "address": "10.11.1.100" },
                    { ".id": "*2", "name": "TEST_USER", "service": "pppoe", "uptime": "2h15m", "address": "10.11.1.101" }
                ]);
            }
        }
        
        const users = await mikrotik.write('/ppp/active/print');
        // Transform response to array
        const activeUsers = Array.isArray(users) ? users : [users];
        console.log('Found active PPPoE users:', activeUsers.length);
        res.json(activeUsers);
    } catch (error) {
        console.error('Error in PPPoE active:', error);
        mikrotik = null; // Reset connection on error
        
        // Return sample data on error for better UX
        res.json([
            { ".id": "*1", "name": "ERROR_USER", "service": "pppoe", "uptime": "0h", "address": "0.0.0.0", "error": error.message }
        ]);
    }
});

// Get PPPoE secrets (all configured users)
router.get('/pppoe/secrets', async (req, res) => {
    try {
        if (!mikrotik) await connectMikrotik();
        
        const secrets = await mikrotik.write('/ppp/secret/print');
        const secretList = Array.isArray(secrets) ? secrets : [secrets];
        res.json(secretList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get interface statistics
router.get('/interface/stats', async (req, res) => {
    try {
        if (!mikrotik) await connectMikrotik();
        
        const interfaces = await mikrotik.write('/interface/print');
        const interfaceList = Array.isArray(interfaces) ? interfaces : [interfaces];
        res.json(interfaceList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get system resources
router.get('/system/resources', async (req, res) => {
    try {
        if (!mikrotik) await connectMikrotik();
        
        const resources = await mikrotik.write('/system/resource/print');
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Monitor PPPoE changes
router.get('/pppoe/monitor', async (req, res) => {
    try {
        if (!mikrotik) await connectMikrotik();
        
        const activeUsers = await mikrotik.write('/ppp/active/print');
        const activeList = Array.isArray(activeUsers) ? activeUsers : [activeUsers];
        
        // Simple monitoring logic
        const changes = [];
        const currentTime = new Date().toISOString();
        
        // Here you could compare with previous state to detect changes
        // For now, just return current active users
        res.json({ 
            timestamp: currentTime,
            active: activeList.length,
            users: activeList.map(u => ({
                name: u.name || u['ppp-login'],
                service: u.service,
                'remote-address': u['remote-address'],
                uptime: u.uptime
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Disconnect active PPPoE user
router.post('/pppoe/disconnect', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        if (!mikrotik) await connectMikrotik();
        
        // Find active session
        const activeUsers = await mikrotik.write('/ppp/active/print');
        const activeList = Array.isArray(activeUsers) ? activeUsers : [activeUsers];
        const userSession = activeList.find(u => 
            u.name && u.name.toUpperCase() === username.toUpperCase()
        );
        
        if (!userSession) {
            return res.status(404).json({ error: 'User not found or not active' });
        }
        
        // Disconnect using .id
        const sessionId = userSession['.id'];
        await mikrotik.write('/ppp/active/remove', { '.id': sessionId });
        
        res.json({ 
            success: true, 
            message: `Disconnected ${username}`,
            disconnectedAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Disable PPPoE secret (prevent login)
router.post('/pppoe/disable', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        if (!mikrotik) await connectMikrotik();
        
        // Find secret
        const secrets = await mikrotik.write('/ppp/secret/print');
        const secretList = Array.isArray(secrets) ? secrets : [secrets];
        const userSecret = secretList.find(s => 
            s.name && s.name.toUpperCase() === username.toUpperCase()
        );
        
        if (!userSecret) {
            return res.status(404).json({ error: 'User secret not found' });
        }
        
        // Disable the secret
        const secretId = userSecret['.id'];
        await mikrotik.write('/ppp/secret/set', { 
            '.id': secretId,
            'disabled': 'yes'
        });
        
        res.json({ 
            success: true, 
            message: `Disabled ${username}`,
            disabledAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Enable PPPoE secret (allow login)
router.post('/pppoe/enable', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        if (!mikrotik) await connectMikrotik();
        
        // Find secret
        const secrets = await mikrotik.write('/ppp/secret/print');
        const secretList = Array.isArray(secrets) ? secrets : [secrets];
        const userSecret = secretList.find(s => 
            s.name && s.name.toUpperCase() === username.toUpperCase()
        );
        
        if (!userSecret) {
            return res.status(404).json({ error: 'User secret not found' });
        }
        
        // Enable the secret
        const secretId = userSecret['.id'];
        await mikrotik.write('/ppp/secret/set', { 
            '.id': secretId,
            'disabled': 'no'
        });
        
        res.json({ 
            success: true, 
            message: `Enabled ${username}`,
            enabledAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk operations
router.post('/pppoe/bulk/disable-unpaid', async (req, res) => {
    try {
        const { usernames } = req.body;
        
        if (!Array.isArray(usernames) || usernames.length === 0) {
            return res.status(400).json({ error: 'Usernames array is required' });
        }
        
        if (!mikrotik) await connectMikrotik();
        
        const results = [];
        
        // First, disconnect active sessions
        const activeUsers = await mikrotik.write('/ppp/active/print');
        const activeList = Array.isArray(activeUsers) ? activeUsers : [activeUsers];
        
        // Find secrets
        const secrets = await mikrotik.write('/ppp/secret/print');
        const secretList = Array.isArray(secrets) ? secrets : [secrets];
        
        for (const username of usernames) {
            try {
                // Disconnect if active
                const userSession = activeList.find(u => 
                    u.name && u.name.toUpperCase() === username.toUpperCase()
                );
                
                if (userSession) {
                    const sessionId = userSession['.id'];
                    await mikrotik.write('/ppp/active/remove', { '.id': sessionId });
                }
                
                // Disable secret
                const userSecret = secretList.find(s => 
                    s.name && s.name.toUpperCase() === username.toUpperCase()
                );
                
                if (userSecret) {
                    const secretId = userSecret['.id'];
                    await mikrotik.write('/ppp/secret/set', { 
                        '.id': secretId,
                        'disabled': 'yes'
                    });
                    
                    results.push({
                        username,
                        success: true,
                        action: 'disabled',
                        wasActive: !!userSession
                    });
                } else {
                    results.push({
                        username,
                        success: false,
                        error: 'Secret not found'
                    });
                }
            } catch (error) {
                results.push({
                    username,
                    success: false,
                    error: error.message
                });
            }
        }
        
        res.json({ 
            success: true,
            total: usernames.length,
            processed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk enable
router.post('/pppoe/bulk/enable', async (req, res) => {
    try {
        const { usernames } = req.body;
        
        if (!Array.isArray(usernames) || usernames.length === 0) {
            return res.status(400).json({ error: 'Usernames array is required' });
        }
        
        if (!mikrotik) await connectMikrotik();
        
        const results = [];
        const secrets = await mikrotik.write('/ppp/secret/print');
        const secretList = Array.isArray(secrets) ? secrets : [secrets];
        
        for (const username of usernames) {
            try {
                const userSecret = secretList.find(s => 
                    s.name && s.name.toUpperCase() === username.toUpperCase()
                );
                
                if (userSecret) {
                    const secretId = userSecret['.id'];
                    await mikrotik.write('/ppp/secret/set', { 
                        '.id': secretId,
                        'disabled': 'no'
                    });
                    
                    results.push({
                        username,
                        success: true,
                        action: 'enabled'
                    });
                } else {
                    results.push({
                        username,
                        success: false,
                        error: 'Secret not found'
                    });
                }
            } catch (error) {
                results.push({
                    username,
                    success: false,
                    error: error.message
                });
            }
        }
        
        res.json({ 
            success: true,
            total: usernames.length,
            processed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;