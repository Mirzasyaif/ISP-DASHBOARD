require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./models/db');
const { sanitizeInput, preventSQLInjection, preventXSS } = require('./middleware/validation');
const { authenticateAPI } = require('./middleware/auth');
const { requestLogger, errorLogger, logger } = require('./middleware/logging');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
db.initDB().then(() => {
    console.log('✅ Database initialized successfully');
    
    // Start billing scheduler for automated notifications
    try {
        const scheduler = require('./scripts/scheduler');
        scheduler.startScheduler();
        console.log('✅ Billing scheduler started');
    } catch (error) {
        console.error('❌ Failed to start billing scheduler:', error.message);
    }
}).catch((error) => {
    console.error('❌ Failed to initialize database:', error.message);
    process.exit(1);
});

// Middleware
const config = require('./config/config').getConfig();

// Security middleware
app.use(sanitizeInput);
app.use(preventSQLInjection);
app.use(preventXSS);

// Request logging
app.use(requestLogger);

    // CORS configuration
    app.use(cors({
        origin: function(origin, callback) {
            // Allow requests with no origin (like mobile apps, curl requests, or file:// protocol)
            if (!origin || origin === 'null') return callback(null, true);
            
            // Check against allowed origins from environment
            const allowedOrigins = config.allowed_origins || ['http://localhost:3000', 'http://localhost:8080'];
            
            // DEBUG: Log all origins being checked
            console.log('CORS Origin Check:', { origin, allowedOrigins });
            
            if (allowedOrigins.includes('*')) {
                return callback(null, true);
            }
            
            if (allowedOrigins.includes(origin)) {
                console.log('✅ Origin allowed:', origin);
                return callback(null, true);
            }
            
            const error = new Error(`Origin ${origin} not allowed by CORS policy`);
            console.warn('❌ CORS blocked origin:', origin);
            return callback(error, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log only errors and important requests (kept for compatibility)
app.use((req, res, next) => {
    // Only log non-static, non-API (for debugging dashboard issues)
    if (!req.url.startsWith('/assets/') && !req.url.startsWith('/favicon.ico')) {
        console.log(`${req.method} ${req.url}`);
    }
    next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api', require('./routes/api'));
app.use('/api/mikrotik', require('./routes/mikrotik'));
// Use enhanced Telegram bot with smart price handling
app.use('/api/telegram', require('./routes/telegram-enhanced'));
// License management routes
app.use('/api/license', require('./routes/license'));
// Financial analytics routes (using fixed version)
app.use('/api/financial', require('./routes/financial'));
// WhatsApp controller routes
app.use('/api/whatsapp', require('./routes/whatsapp'));
// Settings routes (data management & sync)
app.use('/api/settings', require('./routes/settings'));
// Monitoring routes - Comment out karena path beda
// app.use('/health', require('../monitoring/health-check'));

// Debug endpoint
app.get('/api/debug', (req, res) => {
    const config = require('./config/config').getConfig();
    res.json({
        server: 'running',
        config: {
            mikrotik_ip: config.mikrotik_ip ? 'set' : 'not set',
            mikrotik_user: config.mikrotik_user ? 'set' : 'not set',
            mikrotik_pass: config.mikrotik_pass ? 'set' : 'not set',
            setup_completed: config.setup_completed
        },
        timestamp: new Date().toISOString()
    });
});

// License middleware (commercial version)
const { licenseMiddleware, requiresActivation } = require('./middleware/license');

// First-run check middleware with license activation
app.use(async (req, res, next) => {
    try {
        // FIX: Handle async getConfig properly
        let dbConfig = {};
        let config = {};
        
        try {
            // Try to get db config (async)
            if (typeof db.getConfig === 'function') {
                const dbResult = await db.getConfig();
                dbConfig = dbResult || {};
            }
        } catch (dbError) {
            console.error('Error getting db config:', dbError);
            dbConfig = {};
        }
        
        try {
            // Get regular config
            config = require('./config/config').getConfig();
        } catch (configError) {
            console.error('Error getting config:', configError);
            config = {};
        }
        
        // DEBUG: Log config values
        console.log('Middleware Config Check:');
        console.log('- db.getConfig():', JSON.stringify(dbConfig));
        console.log('- config.getConfig():', JSON.stringify(config));
        
        // Use db config as primary source for setup_completed
        const setupCompleted = dbConfig.setup_completed || config.setup_completed || true; // Default true if not found
        
        console.log('- Setup completed:', setupCompleted);
        console.log('- Request path:', req.path);
        
        // Check if setup is completed
        if (!setupCompleted && !req.path.includes('/setup') && !req.path.startsWith('/api/')) {
            console.log('Redirecting to setup.html');
            return res.redirect('/setup.html');
        }
        
        // Check if license activation is required (commercial version)
        try {
            const activationRequired = await requiresActivation();
            if (activationRequired && !req.path.includes('/license') && req.path !== '/' && !req.path.startsWith('/api/license')) {
                return res.redirect('/license.html');
            }
        } catch (error) {
            console.error('License check error:', error);
            // Continue if license check fails
        }
        
        next();
    } catch (error) {
        console.error('Middleware error:', error);
        // Allow access if there's an error to prevent lockout
        next();
    }
});

// Apply license middleware to protected routes
app.use('/api', licenseMiddleware());

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Add health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Add status endpoint (for dashboard frontend)
app.get('/status', (req, res) => {
    const config = require('./config/config').getConfig();
    res.json({
        status: 'online',
        service: 'isp-dashboard',
        version: '2.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        config: {
            setup_completed: config.setup_completed,
            mikrotik_configured: !!(config.mikrotik_ip && config.mikrotik_user),
            telegram_configured: !!(config.telegram_token),
            api_enabled: !!(config.api_key),
            node_env: config.node_env,
            port: config.port
        },
        endpoints: {
            health: '/health',
            api_docs: '/api/debug',
            dashboard: '/',
            setup: '/setup.html',
            mikrotik_api: '/api/mikrotik'
        }
    });
});

// Start server
const HOST = '0.0.0.0'; // Bind to all interfaces
const server = app.listen(PORT, HOST, () => {
    logger.info(`ISP Dashboard running on http://${HOST}:${PORT}`);
    logger.info(`Accessible from network at: http://192.168.2.203:${PORT}`);
    logger.info(`Health check available at: http://${HOST}:${PORT}/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    server.close(() => {
        process.exit(1);
    });
});