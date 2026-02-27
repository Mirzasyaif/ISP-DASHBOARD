const fs = require('fs');
const path = require('path');
require('dotenv').config();

const configPath = path.join(__dirname, '../../config.json');
const envPath = path.join(__dirname, '../.env');
const dbConfigPath = path.join(__dirname, '../data/db.json');

let config = {};

// Load config from environment variables as primary source
function loadConfig() {
    try {
        // Priority 1: Environment variables (most secure)
        config = {
            // Server
            port: process.env.PORT || 3000,
            node_env: process.env.NODE_ENV || 'development',
            
            // Mikrotik Configuration
            mikrotik_ip: process.env.MIKROTIK_IP || '',
            mikrotik_user: process.env.MIKROTIK_USER || '',
            mikrotik_pass: process.env.MIKROTIK_PASS || '',
            mikrotik_port: parseInt(process.env.MIKROTIK_PORT) || 8728,
            
            // Telegram Bot
            telegram_token: process.env.TELEGRAM_TOKEN || '',
            telegram_admin_id: process.env.TELEGRAM_ADMIN_ID || '',
            
            // Database
            db_type: process.env.DB_TYPE || 'sqlite',
            db_path: process.env.DB_PATH || './database.db',
            db_host: process.env.DB_HOST || 'localhost',
            db_port: parseInt(process.env.DB_PORT) || 5432,
            db_name: process.env.DB_NAME || 'isp_dashboard',
            db_user: process.env.DB_USER || 'postgres',
            db_pass: process.env.DB_PASS || '',
            
            // Security
            session_secret: process.env.SESSION_SECRET || 'default_session_secret',
            jwt_secret: process.env.JWT_SECRET || 'default_jwt_secret',
            api_key: process.env.API_KEY || 'isp_dashboard_api_key_2026',
            
            // CORS
            allowed_origins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080').split(','),
            
            // Logging
            log_level: process.env.LOG_LEVEL || 'info',
            
            // GenieACS Configuration
            genieacs_url: process.env.GENIEACS_URL || 'http://localhost',
            genieacs_port: parseInt(process.env.GENIEACS_PORT) || 7557,
            genieacs_username: process.env.GENIEACS_USERNAME || 'admin',
            genieacs_password: process.env.GENIEACS_PASSWORD || 'admin',
            
            // Setup status
            setup_completed: process.env.SETUP_COMPLETED === 'true' || true
        };
        
        console.log('Loaded config from environment variables');
        console.log('TELEGRAM_TOKEN:', process.env.TELEGRAM_TOKEN ? 'Set' : 'Not set');
        console.log('TELEGRAM_ADMIN_ID:', process.env.TELEGRAM_ADMIN_ID || 'Not set');
        
        // If we need to migrate old config from db.json, do it here
        if (fs.existsSync(dbConfigPath)) {
            try {
                const dbData = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));
                if (dbData.config && Object.keys(dbData.config).length > 0) {
                    console.log('Found old config in db.json - consider migrating to environment variables');
                }
            } catch (err) {
                console.error('Error reading old config:', err);
            }
        }
        
    } catch (error) {
        console.error('Error loading config:', error);
        config = {};
    }
    return config;
}

function saveConfig(newConfig) {
    config = { ...config, ...newConfig };
    try {
        // Don't save sensitive data to config.json
        // Only save non-sensitive config to db.json if needed
        if (fs.existsSync(dbConfigPath)) {
            const dbData = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));
            // Only save non-sensitive fields
            const safeConfig = {
                setup_completed: config.setup_completed,
                port: config.port,
                node_env: config.node_env,
                db_type: config.db_type,
                db_path: config.db_path
            };
            dbData.config = safeConfig;
            fs.writeFileSync(dbConfigPath, JSON.stringify(dbData, null, 2));
        }
        
        console.log('Configuration saved (sensitive data remains in .env)');
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

function getConfig() {
    return config;
}

// Initialize
loadConfig();

module.exports = {
    loadConfig,
    saveConfig,
    getConfig
};