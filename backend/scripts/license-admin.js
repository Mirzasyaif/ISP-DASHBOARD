#!/usr/bin/env node
/**
 * License Admin CLI Tool
 * Command-line interface for license management
 */

const { generateLicenseKey, validateLicense, loadLicenses } = require('../middleware/license');
const fs = require('fs').promises;
const path = require('path');

async function listLicenses() {
  try {
    const licenses = await loadLicenses();
    
    console.log('\n📋 License List');
    console.log('='.repeat(80));
    
    if (licenses.length === 0) {
      console.log('No licenses found.');
      return;
    }
    
    licenses.forEach((license, index) => {
      console.log(`\n${index + 1}. ${license.licenseKey}`);
      console.log(`   Customer: ${license.customerName} (${license.customerEmail})`);
      console.log(`   Tier: ${license.tier.toUpperCase()}`);
      console.log(`   Status: ${license.isActive ? '✅ ACTIVE' : '❌ INACTIVE'} ${license.isTrial ? 'TRIAL' : ''}`);
      console.log(`   Issued: ${new Date(license.issuedAt).toLocaleDateString()}`);
      console.log(`   Expires: ${new Date(license.expiresAt).toLocaleDateString()}`);
      console.log(`   Validations: ${license.validationCount || 0}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total licenses: ${licenses.length}`);
    console.log(`Active: ${licenses.filter(l => l.isActive).length}`);
    console.log(`Trial: ${licenses.filter(l => l.isTrial).length}`);
  } catch (error) {
    console.error('Error listing licenses:', error);
  }
}

async function generateLicense(customerName, customerEmail, tier = 'basic', maxUsers = 100, expiresInDays = 365) {
  try {
    console.log('\n🔐 Generating new license...');
    
    if (!customerName || !customerEmail) {
      console.error('Error: Customer name and email are required');
      console.log('Usage: node license-admin.js generate "Customer Name" "customer@email.com" [tier] [maxUsers] [expiresInDays]');
      process.exit(1);
    }
    
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    
    const licenseKey = await generateLicenseKey({
      customerName,
      customerEmail,
      tier,
      maxUsers,
      expiresAt: expiresAt.toISOString()
    });
    
    console.log('\n✅ License Generated Successfully');
    console.log('='.repeat(50));
    console.log(`License Key: ${licenseKey}`);
    console.log(`Customer: ${customerName}`);
    console.log(`Email: ${customerEmail}`);
    console.log(`Tier: ${tier}`);
    console.log(`Max Users: ${maxUsers}`);
    console.log(`Expires: ${expiresAt.toLocaleDateString()} (${expiresInDays} days)`);
    console.log('='.repeat(50));
    console.log('\n📋 License Details for Customer:');
    console.log(`Please provide this license key to the customer: ${licenseKey}`);
    console.log(`Activation URL: http://your-server.com/license.html`);
    
    // Generate email template
    const emailTemplate = `
Dear ${customerName},

Thank you for purchasing ISP Dashboard!

Your license details:
- License Key: ${licenseKey}
- Tier: ${tier.toUpperCase()}
- Max Users: ${maxUsers}
- Valid until: ${expiresAt.toLocaleDateString()}

To activate your license:
1. Visit: http://your-server.com/license.html
2. Enter your license key and contact information
3. Complete the activation process

If you need assistance, please contact support@ispdashboard.com

Best regards,
ISP Dashboard Team
    `;
    
    console.log('\n📧 Email Template:');
    console.log(emailTemplate);
    
  } catch (error) {
    console.error('Error generating license:', error);
  }
}

async function validateLicenseCLI(licenseKey) {
  try {
    console.log('\n🔍 Validating license...');
    
    const validation = await validateLicense(licenseKey, false);
    
    if (validation.isValid) {
      console.log('\n✅ License Valid');
      console.log('='.repeat(50));
      console.log(`License: ${licenseKey}`);
      console.log(`Customer: ${validation.license.customerName}`);
      console.log(`Tier: ${validation.tier}`);
      console.log(`Max Users: ${validation.maxUsers}`);
      console.log(`Expires: ${new Date(validation.expiresAt).toLocaleDateString()}`);
      console.log(`Days Remaining: ${validation.daysRemaining}`);
      console.log(`Trial: ${validation.isTrial ? 'Yes' : 'No'}`);
      console.log('='.repeat(50));
    } else {
      console.log('\n❌ License Invalid');
      console.log(`Error: ${validation.error}`);
    }
  } catch (error) {
    console.error('Error validating license:', error);
  }
}

async function createTrialLicenseCLI(customerName, customerEmail) {
  try {
    console.log('\n🎯 Creating trial license...');
    
    const { createTrialLicense } = require('../middleware/license');
    const licenseKey = await createTrialLicense({ customerName, customerEmail });
    
    console.log('\n✅ Trial License Created');
    console.log('='.repeat(50));
    console.log(`License Key: ${licenseKey}`);
    console.log(`Customer: ${customerName}`);
    console.log(`Email: ${customerEmail}`);
    console.log(`Duration: 30 days`);
    console.log(`Max Users: 50`);
    console.log('='.repeat(50));
    
    // Save to file for distribution
    const trialInfo = {
      licenseKey,
      customerName,
      customerEmail,
      created: new Date().toISOString(),
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const trialFile = path.join(__dirname, `trial-${Date.now()}.json`);
    await fs.writeFile(trialFile, JSON.stringify(trialInfo, null, 2));
    console.log(`\n📄 Trial info saved to: ${trialFile}`);
    
  } catch (error) {
    console.error('Error creating trial license:', error);
  }
}

async function showStats() {
  try {
    const { getLicenseStats } = require('../middleware/license');
    const stats = await getLicenseStats();
    
    console.log('\n📊 License Statistics');
    console.log('='.repeat(50));
    console.log(`Total Licenses: ${stats.total}`);
    console.log(`Active: ${stats.active}`);
    console.log(`Expired: ${stats.expired}`);
    console.log(`Trial: ${stats.trial}`);
    console.log(`Basic: ${stats.basic}`);
    console.log(`Pro: ${stats.pro}`);
    console.log(`Enterprise: ${stats.enterprise}`);
    console.log(`Validations Today: ${stats.validationsToday}`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Error getting stats:', error);
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'list':
      await listLicenses();
      break;
      
    case 'generate':
      const name = process.argv[3];
      const email = process.argv[4];
      const tier = process.argv[5] || 'basic';
      const maxUsers = parseInt(process.argv[6]) || 100;
      const expiresInDays = parseInt(process.argv[7]) || 365;
      await generateLicense(name, email, tier, maxUsers, expiresInDays);
      break;
      
    case 'validate':
      const licenseKey = process.argv[3];
      if (!licenseKey) {
        console.error('Error: License key required');
        console.log('Usage: node license-admin.js validate <license-key>');
        process.exit(1);
      }
      await validateLicenseCLI(licenseKey);
      break;
      
    case 'trial':
      const trialName = process.argv[3];
      const trialEmail = process.argv[4];
      if (!trialName || !trialEmail) {
        console.error('Error: Customer name and email required for trial');
        console.log('Usage: node license-admin.js trial "Customer Name" "customer@email.com"');
        process.exit(1);
      }
      await createTrialLicenseCLI(trialName, trialEmail);
      break;
      
    case 'stats':
      await showStats();
      break;
      
    case 'help':
    default:
      console.log('\nISP Dashboard License Admin CLI');
      console.log('='.repeat(50));
      console.log('\nCommands:');
      console.log('  list                         - List all licenses');
      console.log('  generate <name> <email> [tier] [maxUsers] [expiresDays]');
      console.log('                              - Generate a new license');
      console.log('  validate <license-key>       - Validate a license');
      console.log('  trial <name> <email>         - Create a trial license');
      console.log('  stats                        - Show license statistics');
      console.log('  help                         - Show this help');
      console.log('\nExamples:');
      console.log('  node license-admin.js list');
      console.log('  node license-admin.js generate "John Doe" "john@example.com" basic 100 365');
      console.log('  node license-admin.js trial "Jane Smith" "jane@example.com"');
      console.log('  node license-admin.js validate LIC-ABCD-1234-EFGH-5678');
      console.log('  node license-admin.js stats');
      break;
  }
}

// Run the CLI
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  listLicenses,
  generateLicense,
  validateLicenseCLI,
  createTrialLicenseCLI,
  showStats
};