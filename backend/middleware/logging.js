const winston = require('winston');
const path = require('path');
const config = require('../config/config').getConfig();

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
require('fs').mkdirSync(logDir, { recursive: true });

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
    level: config.log_level || 'info',
    format: logFormat,
    defaultMeta: { service: 'isp-dashboard' },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Write all logs to combined.log
        new winston.transports.File({ 
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10
        })
    ]
});

// If we're not in production, also log to console
if (config.node_env !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Express middleware for request logging
function requestLogger(req, res, next) {
    const start = Date.now();
    
    // Log after response finishes
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        logger.info({
            message: 'HTTP Request',
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });
    
    next();
}

// Error logging middleware
function errorLogger(err, req, res, next) {
    logger.error({
        message: 'Unhandled Error',
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        ip: req.ip
    });
    
    next(err);
}

// Database operation logger
function dbLogger(operation, data = {}) {
    logger.info({
        message: 'Database Operation',
        operation,
        ...data
    });
}

// Security event logger
function securityLogger(event, details = {}) {
    logger.warn({
        message: 'Security Event',
        event,
        ...details
    });
}

module.exports = {
    logger,
    requestLogger,
    errorLogger,
    dbLogger,
    securityLogger
};