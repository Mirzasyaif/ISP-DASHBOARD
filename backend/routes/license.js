/**
 * License Management Routes
 * API endpoints for license generation, validation, and administration
 */

const express = require('express');
const router = express.Router();
const { 
  generateLicenseKey, 
  validateLicense, 
  createTrialLicense,
  requiresActivation,
  getLicenseStats,
  loadLicenses
} = require('../middleware/license');
const { authenticateAPI } = require('../middleware/auth');

/**
 * @route GET /api/license/status
 * @desc Get license system status
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const activationRequired = await requiresActivation();
    const stats = await getLicenseStats();
    
    res.json({
      success: true,
      data: {
        activationRequired,
        system: {
          name: 'ISP Dashboard',
          version: '2.0.0',
          commercial: true
        },
        stats,
        features: {
          trialAvailable: true,
          tiers: ['trial', 'basic', 'pro', 'enterprise'],
          maxTrialUsers: 50,
          trialDays: 30
        }
      }
    });
  } catch (error) {
    console.error('License status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get license status'
    });
  }
});

/**
 * @route POST /api/license/validate
 * @desc Validate a license key
 * @access Public
 */
router.post('/validate', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'License key is required'
      });
    }

    const validation = await validateLicense(licenseKey);
    
    if (!validation.isValid) {
      return res.status(403).json({
        success: false,
        error: validation.error
      });
    }

    res.json({
      success: true,
      data: {
        isValid: true,
        tier: validation.tier,
        maxUsers: validation.maxUsers,
        expiresAt: validation.expiresAt,
        isTrial: validation.isTrial,
        daysRemaining: validation.daysRemaining,
        customerName: validation.license.customerName
      }
    });
  } catch (error) {
    console.error('License validation error:', error);
    res.status(500).json({
      success: false,
      error: 'License validation failed'
    });
  }
});

/**
 * @route POST /api/license/activate
 * @desc Activate license (first-time setup)
 * @access Public
 */
router.post('/activate', async (req, res) => {
  try {
    const { licenseKey, customerName, customerEmail } = req.body;
    
    if (!licenseKey || !customerName || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'License key, customer name, and email are required'
      });
    }

    const validation = await validateLicense(licenseKey, false);
    
    if (!validation.isValid) {
      return res.status(403).json({
        success: false,
        error: validation.error
      });
    }

    // Update customer info
    const licenses = await loadLicenses();
    const license = licenses.find(l => l.licenseKey === licenseKey);
    
    if (license) {
      license.customerName = customerName;
      license.customerEmail = customerEmail;
      license.activationDate = new Date().toISOString();
      
      // Save updated license
      const fs = require('fs').promises;
      const path = require('path');
      const licenseDbPath = path.join(__dirname, '../data/licenses.json');
      await fs.writeFile(licenseDbPath, JSON.stringify(licenses, null, 2), 'utf8');
    }

    res.json({
      success: true,
      data: {
        message: 'License activated successfully',
        licenseKey,
        customerName,
        customerEmail,
        tier: validation.tier,
        expiresAt: validation.expiresAt
      }
    });
  } catch (error) {
    console.error('License activation error:', error);
    res.status(500).json({
      success: false,
      error: 'License activation failed'
    });
  }
});

/**
 * @route POST /api/license/trial
 * @desc Create a trial license
 * @access Public
 */
router.post('/trial', async (req, res) => {
  try {
    const { customerName, customerEmail } = req.body;
    
    if (!customerName || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Customer name and email are required'
      });
    }

    const licenseKey = await createTrialLicense({ customerName, customerEmail });
    
    res.json({
      success: true,
      data: {
        message: 'Trial license created successfully',
        licenseKey,
        customerName,
        customerEmail,
        tier: 'trial',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxUsers: 50
      }
    });
  } catch (error) {
    console.error('Trial license creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create trial license'
    });
  }
});

/**
 * @route POST /api/license/generate
 * @desc Generate a new license key (admin only)
 * @access Private (requires API key)
 */
router.post('/generate', authenticateAPI, async (req, res) => {
  try {
    const { 
      customerName, 
      customerEmail, 
      tier = 'basic', 
      maxUsers = 100,
      expiresInDays = 365 
    } = req.body;
    
    if (!customerName || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Customer name and email are required'
      });
    }

    // Validate tier
    const validTiers = ['trial', 'basic', 'pro', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({
        success: false,
        error: `Invalid tier. Must be one of: ${validTiers.join(', ')}`
      });
    }

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    
    const licenseKey = await generateLicenseKey({
      customerName,
      customerEmail,
      tier,
      maxUsers,
      expiresAt: expiresAt.toISOString()
    });

    res.json({
      success: true,
      data: {
        message: 'License generated successfully',
        licenseKey,
        customerName,
        customerEmail,
        tier,
        maxUsers,
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (error) {
    console.error('License generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate license'
    });
  }
});

/**
 * @route GET /api/license/list
 * @desc List all licenses (admin only)
 * @access Private (requires API key)
 */
router.get('/list', authenticateAPI, async (req, res) => {
  try {
    const licenses = await loadLicenses();
    
    // Remove sensitive info from public response
    const safeLicenses = licenses.map(license => ({
      licenseKey: license.licenseKey,
      customerName: license.customerName,
      tier: license.tier,
      maxUsers: license.maxUsers,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt,
      isActive: license.isActive,
      isTrial: license.isTrial,
      activationDate: license.activationDate,
      lastValidated: license.lastValidated,
      validationCount: license.validationCount
    }));

    res.json({
      success: true,
      data: {
        licenses: safeLicenses,
        total: licenses.length
      }
    });
  } catch (error) {
    console.error('License list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list licenses'
    });
  }
});

/**
 * @route POST /api/license/revoke
 * @desc Revoke a license (admin only)
 * @access Private (requires API key)
 */
router.post('/revoke', authenticateAPI, async (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'License key is required'
      });
    }

    const licenses = await loadLicenses();
    const license = licenses.find(l => l.licenseKey === licenseKey);
    
    if (!license) {
      return res.status(404).json({
        success: false,
        error: 'License not found'
      });
    }

    license.isActive = false;
    
    // Save updated license
    const fs = require('fs').promises;
    const path = require('path');
    const licenseDbPath = path.join(__dirname, '../data/licenses.json');
    await fs.writeFile(licenseDbPath, JSON.stringify(licenses, null, 2), 'utf8');

    res.json({
      success: true,
      data: {
        message: 'License revoked successfully',
        licenseKey,
        customerName: license.customerName
      }
    });
  } catch (error) {
    console.error('License revocation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke license'
    });
  }
});

/**
 * @route GET /api/license/check
 * @desc Check if current installation needs activation
 * @access Public
 */
router.get('/check', async (req, res) => {
  try {
    const activationRequired = await requiresActivation();
    
    res.json({
      success: true,
      data: {
        activationRequired,
        message: activationRequired 
          ? 'License activation required' 
          : 'License is active'
      }
    });
  } catch (error) {
    console.error('License check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check license status'
    });
  }
});

module.exports = router;