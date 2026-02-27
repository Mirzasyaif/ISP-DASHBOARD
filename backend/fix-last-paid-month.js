const db = require('./models/db-sqlite');

(async () => {
    try {
        await db.initDB();
        
        console.log('=== FIXING last_paid_month FOR PAID USERS ===\n');
        
        // Get all clients
        const clients = await db.getAllClients();
        
        let fixedCount = 0;
        
        for (const client of clients) {
            // Get all payments for this user
            const payments = await db.getPaymentsByUserId(client.id);
            
            // Find the most recent paid payment
            const paidPayments = payments.filter(p => p.status === 'paid');
            
            if (paidPayments.length > 0) {
                // Sort by month_year descending to get the most recent
                paidPayments.sort((a, b) => b.month_year.localeCompare(a.month_year));
                const mostRecentPaid = paidPayments[0];
                
                // Check if last_paid_month needs to be updated
                if (client.last_paid_month !== mostRecentPaid.month_year) {
                    console.log(`Updating ${client.pppoe_username}: ${client.last_paid_month} -> ${mostRecentPaid.month_year}`);
                    
                    await db.updateClientPaymentStatus(
                        client.id,
                        mostRecentPaid.month_year,
                        'paid'
                    );
                    
                    fixedCount++;
                }
            }
        }
        
        console.log(`\n✅ Fixed ${fixedCount} users`);
        
        db.closeDB();
    } catch (error) {
        console.error('Error:', error);
    }
})();