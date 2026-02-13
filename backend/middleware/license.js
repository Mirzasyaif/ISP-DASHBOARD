/**
 * License Validation Middleware
 * Validates license keys for commercial deployment
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// License database path
const LICENSE_DB_PATH = path.join(__dirname, '../data/licenses.json');

/**
 * Generate a secure license key
 * @param {Object} customerData - Customer information
 * @returns {string} License key
 */
async function generateLicenseKey(customerData) {
  const {
    customerName,
    customerEmail,
    tier = 'basic',
    maxUsers = 100,
    expiresAt = null
  } = customerData;

  // Create unique seed
  const seed = `${customerName}:${customerEmail}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
  
  // Create license key (format: LIC-XXXX-XXXX-XXXX-XXXX)
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const licenseKey = `LIC-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`.toUpperCase();
  
  // Create license record
  const license = {
    licenseKey,
    customerName,
    customerEmail,
    tier,
    maxUsers,
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Default 1 year
    isActive: true,
    isTrial: false,
    activationDate: null,
    lastValidated: null,
    validationCount: 0
  };

  // Save to database
  await saveLicense(license);
  
  return licenseKey;
}

/**
 * Validate license key
 * @param {string} licenseKey - License key to validate
 * @param {boolean} incrementCount - Whether to increment validation count
 * @returns {Object} Validation result
 */
async function validateLicense(licenseKey, incrementCount = true) {
  try {
    const licenses = await loadLicenses();
    const license = licenses.find(l => l.licenseKey === licenseKey && l.isActive);
    
    if (!license) {
      return { isValid: false, error: 'License not found or inactive' };
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(license.expiresAt);
    
    if (expiresAt < now) {
      return { isValid: false, error: 'License expired' };
    }

    // Update validation info
    if (incrementCount) {
      license.lastValidated = now.toISOString();
      license.validationCount = (license.validationCount || 0) + 1;
      
      // If this is first validation, set activation date
      if (!license.activationDate) {
        license.activationDate = now.toISOString();
      }
      
      await saveLicenses(licenses);
    }

    return {
      isValid: true,
      license,
      tier: license.tier,
      maxUsers: license.maxUsers,
      expiresAt: license.expiresAt,
      isTrial: license.isTrial,
      daysRemaining: Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
    };
  } catch (error) {
    console.error('License validation error:', error);
    return { isValid: false, error: 'License validation failed' };
  }
}

/**
 * Create trial license
 * @param {Object} trialData - Trial customer data
 * @returns {string} Trial license key
 */
async function createTrialLicense(trialData) {
  const { customerName, customerEmail } = trialData;
  
  // Trial license valid for 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  const licenseKey = await generateLicenseKey({
    customerName,
    customerEmail,
    tier: 'trial',
    maxUsers: 50,
    expiresAt: expiresAt.toISOString()
  });

  // Mark as trial
  const licenses = await loadLicenses();
  const license = licenses.find(l => l.licenseKey === licenseKey);
  if (license) {
    license.isTrial = true;
    await saveLicenses(licenses);
  }

  return licenseKey;
}

/**
 * Check if installation requires license activation
 * @returns {boolean}
 */
async function requiresActivation() {
  try {
    const licenses = await loadLicenses();
    // Check if any active license exists
    const activeLicense = licenses.find(l => l.isActive && l.activationDate);
    return !activeLicense;
  } catch (error) {
    // If no license database, require activation
    return true;
  }
}

/**
 * License middleware for API routes
 */
function licenseMiddleware() {
  return async (req, res, next) => {
    // Skip license check for certain routes
    const skipRoutes = [
      '/api/license/status',
      '/api/license/activate',
      '/api/license/validate',
      '/api/license/trial',
      '/health',
      '/api/auth/login',
      '/api/dashboard',
      '/api/financial',
      '/api/stats',
      '/api/users',
      '/api/pppoe'
    ];

    if (skipRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Get license key from headers or query
    const licenseKey = req.headers['x-license-key'] || req.query.licenseKey;
    
    if (!licenseKey) {
      return res.status(401).json({
        success: false,
        error: 'License key required',
        message: 'Please provide a valid license key in X-License-Key header'
      });
    }

    const validation = await validateLicense(licenseKey);
    
    if (!validation.isValid) {
      return res.status(403).json({
        success: false,
        error: 'Invalid license',
        message: validation.error
      });
    }

    // Attach license info to request
    req.license = validation.license;
    req.licenseTier = validation.tier;
    req.licenseMaxUsers = validation.maxUsers;
    
    next();
  };
}

/**
 * Load licenses from database
 */
async function loadLicenses() {
  try {
    const data = await fs.readFile(LICENSE_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Return empty array if file doesn't exist
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Save licenses to database
 */
async function saveLicenses(licenses) {
  const data = JSON.stringify(licenses, null, 2);
  await fs.writeFile(LICENSE_DB_PATH, data, 'utf8');
}

/**
 * Save single license
 */
async function saveLicense(license) {
  const licenses = await loadLicenses();
  const existingIndex = licenses.findIndex(l => l.licenseKey === license.licenseKey);
  
  if (existingIndex >= 0) {
    licenses[existingIndex] = license;
  } else {
    licenses.push(license);
  }
  
  await saveLicenses(licenses);
}

/**
 * Get license statistics
 */
async function getLicenseStats() {
  const licenses = await loadLicenses();
  
  const stats = {
    total: licenses.length,
    active: licenses.filter(l => l.isActive).length,
    expired: licenses.filter(l => new Date(l.expiresAt) < new Date()).length,
    trial: licenses.filter(l => l.isTrial).length,
    basic: licenses.filter(l => l.tier === 'basic').length,
    pro: licenses.filter(l => l.tier === 'pro').length,
    enterprise: licenses.filter(l => l.tier === 'enterprise').length,
    validationsToday: licenses.reduce((sum, l) => {
      const today = new Date().toDateString();
      const lastValidated = l.lastValidated ? new Date(l.lastValidated).toDateString() : null;
      return sum + (lastValidated === today ? 1 : 0);
    }, 0)
  };

  return stats;
}

module.exports = {
  generateLicenseKey,
  validateLicense,
  createTrialLicense,
  requiresActivation,
  licenseMiddleware,
  getLicenseStats,
  loadLicenses,
  saveLicenses
};