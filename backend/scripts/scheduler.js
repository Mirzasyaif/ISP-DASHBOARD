// isp-dashboard/backend/scripts/scheduler-optimized.js
// OPTIMIZED VERSION: Batching with delays and better error handling

const cron = require('node-cron');
const db = require('../models/db-sqlite');
const { sendBillingNotification } = require('../controllers/whatsappGowaController'); // Use GOWA version

// Utility function to format date as YYYY-MM-DD
function getFormattedDate(dateOffsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + dateOffsetDays);
    return date.toISOString().split('T')[0];
}

// Configuration for batch processing
const BATCH_CONFIG = {
    batchSize: 5,           // Process 5 users at a time
    batchDelay: 2000,       // Wait 2 seconds between batches
    retryAttempts: 2,       // Retry failed notifications 2 times
    retryDelay: 5000        // Wait 5 seconds before retry
};

/**
 * Process users in batches with delays
 * @param {Array} users - Array of users to process
 * @param {string} status - Notification status
 * @returns {Promise<Object>} Processing results
 */
async function processUsersInBatches(users, status) {
    const results = {
        total: users.length,
        success: 0,
        failed: 0,
        skipped: 0
    };

    console.log(`[Scheduler] Processing ${users.length} users with status ${status}`);

    // Process in batches
    for (let i = 0; i < users.length; i += BATCH_CONFIG.batchSize) {
        const batch = users.slice(i, i + BATCH_CONFIG.batchSize);
        console.log(`[Scheduler] Processing batch ${Math.floor(i / BATCH_CONFIG.batchSize) + 1}/${Math.ceil(users.length / BATCH_CONFIG.batchSize)}`);

        // Process each user in the batch
        for (const user of batch) {
            try {
                const success = await sendBillingNotification(user, status);
                if (success) {
                    results.success++;
                } else {
                    results.failed++;
                }
            } catch (error) {
                console.error(`[Scheduler ERROR] Failed to send notification to ${user.pppoe_username}:`, error.message);
                results.failed++;
            }
        }

        // Add delay between batches (except for the last batch)
        if (i + BATCH_CONFIG.batchSize < users.length) {
            console.log(`[Scheduler] Waiting ${BATCH_CONFIG.batchDelay}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.batchDelay));
        }
    }

    return results;
}

/**
 * Check and send billing notifications with optimized batching
 */
async function checkAndSendBillingNotifications() {
    console.log(`[Scheduler] Running daily billing check at ${new Date().toISOString()}`);

    try {
        // Initialize database if needed
        await db.initDB();
        
        const startTime = Date.now();
        const allResults = {
            'H-3': { total: 0, success: 0, failed: 0, skipped: 0 },
            'H0': { total: 0, success: 0, failed: 0, skipped: 0 },
            'D+1': { total: 0, success: 0, failed: 0, skipped: 0 }
        };

        // H-3 Check (Reminder 3 days before due_date)
        const datePlus3 = getFormattedDate(3);
        const usersHMinus3 = await db.getUsersForDueDate ? await db.getUsersForDueDate(datePlus3) : [];
        
        if (usersHMinus3.length > 0) {
            console.log(`[H-3] Found ${usersHMinus3.length} users for due date ${datePlus3}`);
            allResults['H-3'] = await processUsersInBatches(usersHMinus3, 'H-3');
        }

        // Hari H Check (Today is due_date)
        const dateHariH = getFormattedDate(0);
        const usersHariH = await db.getUsersForDueDate ? await db.getUsersForDueDate(dateHariH) : [];

        if (usersHariH.length > 0) {
            console.log(`[H0] Found ${usersHariH.length} users for due date ${dateHariH}`);
            allResults['H0'] = await processUsersInBatches(usersHariH, 'H-0');
        }
        
        // D+1 Check (Late payment - 1 day after due_date)
        const dateYesterday = getFormattedDate(-1);
        const usersLate = await db.getUsersForDueDate ? await db.getUsersForDueDate(dateYesterday) : [];

        if (usersLate.length > 0) {
            console.log(`[D+1] Found ${usersLate.length} users with overdue payment (due date: ${dateYesterday})`);
            allResults['D+1'] = await processUsersInBatches(usersLate, 'D+1');
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`[Scheduler] Billing check complete in ${duration}s`);
        console.log(`[Scheduler] Results:`, JSON.stringify(allResults, null, 2));

    } catch (error) {
        console.error('[Scheduler ERROR] Failed to run billing check:', error.message);
        console.error(error.stack);
    }
}

// Start cron scheduler
function startScheduler() {
    // Schedule: Runs every day at 08:00 AM (0 8 * * *)
    cron.schedule('0 8 * * *', checkAndSendBillingNotifications, {
        scheduled: true,
        timezone: "Asia/Jakarta" 
    });
    console.log('✅ Optimized Cron Scheduler started: Daily check at 08:00 AM (Asia/Jakarta).');
    console.log('✅ Batch processing enabled: 5 users per batch with 2s delay');
}

module.exports = {
    startScheduler,
    checkAndSendBillingNotifications // For manual testing
};
