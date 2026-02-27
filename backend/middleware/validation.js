const { body, query, param, validationResult } = require('express-validator');

// Common validation rules
const validationRules = {
    // User validation
    createUser: [
        body('pppoe_username').trim().isLength({ min: 3, max: 50 }).escape(),
        body('full_name').trim().isLength({ min: 2, max: 100 }).escape(),
        body('address').trim().isLength({ min: 5, max: 200 }).escape().optional(),
        body('phone').trim().isLength({ min: 10, max: 15 }).escape().optional(),
        body('plan').trim().isLength({ min: 2, max: 50 }).escape()
    ],
    
    updatePayment: [
        body('username').trim().isLength({ min: 3, max: 50 }).escape()
    ],
    
    // Mikrotik configuration
    mikrotikConfig: [
        body('mikrotik_ip').trim().isIP().withMessage('Invalid IP address'),
        body('mikrotik_user').trim().isLength({ min: 1, max: 50 }).escape(),
        body('mikrotik_pass').trim().isLength({ min: 1, max: 100 }),
        body('mikrotik_port').optional().isInt({ min: 1, max: 65535 }).toInt()
    ],
    
    // Telegram configuration
    telegramConfig: [
        body('telegram_token').trim().isLength({ min: 30, max: 100 }),
        body('telegram_admin_id').trim().isLength({ min: 1, max: 100 }).escape()
    ],
    
    // API key validation
    apiKey: [
        query('api_key').optional().isLength({ min: 10, max: 100 }).escape(),
        body('api_key').optional().isLength({ min: 10, max: 100 }).escape()
    ]
};

// Sanitization middleware
function sanitizeInput(req, res, next) {
    // Sanitize query parameters
    Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
            req.query[key] = req.query[key].trim();
        }
    });
    
    // Sanitize body parameters
    if (req.body && typeof req.body === 'object') {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
        Object.keys(req.params).forEach(key => {
            if (typeof req.params[key] === 'string') {
                req.params[key] = req.params[key].trim();
            }
        });
    }
    
    next();
}

// Validation result handler
function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed', 
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
}

// SQL injection prevention (basic)
function preventSQLInjection(req, res, next) {
    const sqlPatterns = [
        /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE|DECLARE|CREATE|ALTER|TABLE|FROM|WHERE)(\b)/gi,
        /(--)/gi,
        /(;)/gi,
        /(\/\*|\*\/)/gi
    ];
    
    const checkObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'string') {
                sqlPatterns.forEach(pattern => {
                    if (pattern.test(obj[key])) {
                        throw new Error(`Potential SQL injection detected in field: ${key}`);
                    }
                });
            } else if (typeof obj[key] === 'object') {
                checkObject(obj[key]);
            }
        });
    };
    
    try {
        checkObject(req.query);
        checkObject(req.body);
        checkObject(req.params);
        next();
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

// XSS prevention (basic)
function preventXSS(req, res, next) {
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi
    ];
    
    const checkObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'string') {
                xssPatterns.forEach(pattern => {
                    obj[key] = obj[key].replace(pattern, '[removed]');
                });
            } else if (typeof obj[key] === 'object') {
                checkObject(obj[key]);
            }
        });
    };
    
    checkObject(req.query);
    checkObject(req.body);
    checkObject(req.params);
    next();
}

module.exports = {
    validationRules,
    sanitizeInput,
    validate,
    preventSQLInjection,
    preventXSS
};