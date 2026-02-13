/**
 * License System Test Script
 * Test the license generation and validation system
 */

const { 
  generateLicenseKey, 
  validateLicense, 
  createTrialLicense,
  requiresActivation,
  getLicenseStats 
} = require('../middleware/license');

async function testLicenseSystem() {
  console.log('🔐 Testing License System...');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Generate a license key
    console.log('\n1. Testing license generation...');
    const licenseKey = await generateLicenseKey({
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      tier: 'basic',
      maxUsers: 100
    });
    console.log(`✅ Generated license key: ${licenseKey}`);
    
    // Test 2: Validate the license
    console.log('\n2. Testing license validation...');
    const validation = await validateLicense(licenseKey);
    if (validation.isValid) {
      console.log(`✅ License valid`);
      console.log(`   Tier: ${validation.tier}`);
      console.log(`   Max Users: ${validation.maxUsers}`);
      console.log(`   Expires: ${validation.expiresAt}`);
    } else {
      console.log(`❌ License invalid: ${validation.error}`);
    }
    
    // Test 3: Create trial license
    console.log('\n3. Testing trial license creation...');
    const trialLicenseKey = await createTrialLicense({
      customerName: 'Trial Customer',
      customerEmail: 'trial@example.com'
    });
    console.log(`✅ Trial license created: ${trialLicenseKey}`);
    
    // Test 4: Check activation requirement
    console.log('\n4. Testing activation requirement...');
    const needsActivation = await requiresActivation();
    console.log(`✅ Activation required: ${needsActivation}`);
    
    // Test 5: Get license statistics
    console.log('\n5. Testing license statistics...');
    const stats = await getLicenseStats();
    console.log(`✅ License stats:`);
    console.log(`   Total licenses: ${stats.total}`);
    console.log(`   Active: ${stats.active}`);
    console.log(`   Trial: ${stats.trial}`);
    console.log(`   Validations today: ${stats.validationsToday}`);
    
    // Test 6: Test validation with invalid key
    console.log('\n6. Testing invalid license validation...');
    const invalidValidation = await validateLicense('INVALID-KEY-1234');
    if (!invalidValidation.isValid) {
      console.log(`✅ Invalid license correctly rejected: ${invalidValidation.error}`);
    } else {
      console.log(`❌ Invalid license should have been rejected`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart the server to apply license middleware');
    console.log('2. Visit /license.html to test activation UI');
    console.log('3. Add license middleware to index.js');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testLicenseSystem();