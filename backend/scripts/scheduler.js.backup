// isp-dashboard/backend/scripts/scheduler.js
// PERBAIKAN: Impor dari db.js (abstraction layer), bukan db-sqlite.js

const cron = require('node-cron');
const db = require('../models/db');
const { sendBillingNotification } = require('../controllers/whatsappController'); // Akan kita buat nanti

// Utility function to format date as YYYY-MM-DD
function getFormattedDate(dateOffsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + dateOffsetDays);
    return date.toISOString().split('T')[0];
}

async function checkAndSendBillingNotifications() {
    // We assume db.initDB() has been called in index.js or startup script
    console.log(`[Scheduler] Running daily billing check at ${new Date().toISOString()}`);

    try {
        // Initialize database if needed
        await db.initDB();
        
        // H-3 Check (Reminder 3 days before due_date)
        // Cari user yang due_date-nya adalah 3 hari dari sekarang
        const datePlus3 = getFormattedDate(3); 
        const usersHMinus3 = await db.getUsersForDueDate ? await db.getUsersForDueDate(datePlus3) : [];
        
        if (usersHMinus3.length > 0) {
            console.log(`[H-3] Found ${usersHMinus3.length} users for due date ${datePlus3}`);
            for (const user of usersHMinus3) {
                console.log(`[H-3] Sending reminder to ${user.name || user.pppoe_username}. Due: ${user.due_date}`);
                // Status: H-3
                await sendBillingNotification(user, 'H-3');
            }
        }

        // Hari H Check (Today is due_date)
        const dateHariH = getFormattedDate(0);
        const usersHariH = await db.getUsersForDueDate ? await db.getUsersForDueDate(dateHariH) : [];

        if (usersHariH.length > 0) {
            console.log(`[H0] Found ${usersHariH.length} users for due date ${dateHariH}`);
            for (const user of usersHariH) {
                console.log(`[H0] Sending due-date notice to ${user.name || user.pppoe_username}. Due: ${user.due_date}`);
                // Status: H-0
                await sendBillingNotification(user, 'H-0');
            }
        }
        
        // D+1 Check (Late payment - 1 day after due_date)
        // Cari user yang due_date-nya adalah kemarin dan belum bayar
        const dateYesterday = getFormattedDate(-1);
        const usersLate = await db.getUsersForDueDate ? await db.getUsersForDueDate(dateYesterday) : [];

        if (usersLate.length > 0) {
            console.log(`[D+1] Found ${usersLate.length} users with overdue payment (due date: ${dateYesterday})`);
            for (const user of usersLate) {
                console.log(`[D+1] Sending late payment notice to ${user.name || user.pppoe_username}. Due: ${user.due_date}`);
                // Status: D+1
                await sendBillingNotification(user, 'D+1');
            }
        }

        console.log(`[Scheduler] Billing check complete. Found ${usersHMinus3.length} (H-3), ${usersHariH.length} (H0), and ${usersLate.length} (D+1) users.`);

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
    console.log('✅ Cron Scheduler started: Daily check at 08:00 AM (Asia/Jakarta).');
    
    // Run once immediately for testing/startup (optional)
    // checkAndSendBillingNotifications(); 
}

module.exports = {
    startScheduler,
    checkAndSendBillingNotifications // For manual testing
};