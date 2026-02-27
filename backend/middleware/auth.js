const config = require('../config/config').getConfig();

// Simple API key authentication middleware
function authenticateAPI(req, res, next) {
    console.log('🔐 authenticateAPI called for:', req.path);
    console.log('Headers:', req.headers);
    
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    console.log('API Key provided:', apiKey ? 'Yes' : 'No');
    console.log('Expected API Key:', config.api_key ? 'Set' : 'Not set');
    console.log('Config API Key:', config.api_key);
    
    if (!apiKey) {
        console.log('❌ No API key provided');
        return res.status(401).json({ error: 'API key required' });
    }
    
    if (apiKey !== config.api_key) {
        console.log(`❌ Invalid API key. Provided: ${apiKey}, Expected: ${config.api_key}`);
        return res.status(403).json({ error: 'Invalid API key' });
    }
    
    console.log('✅ API key validated successfully');
    next();
}

// Admin authentication middleware (for sensitive operations)
function authenticateAdmin(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required for admin operations' });
    }
    
    if (apiKey !== config.api_key) {
        return res.status(403).json({ error: 'Invalid admin API key' });
    }
    
    next();
}

// Basic session-based authentication (for web dashboard)
function authenticateSession(req, res, next) {
    // For now, implement simple session check
    // In production, implement proper session management
    const sessionToken = req.headers['authorization'];
    
    if (!sessionToken && req.path !== '/login' && req.path !== '/setup') {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // TODO: Implement proper session validation
    next();
}

module.exports = {
    authenticateAPI,
    authenticateAdmin,
    authenticateSession
};