const db = require('./models/db-sqlite');

(async () => {
    try {
        await db.initDB();
        
        const clients = await db.getAllClients();
        console.log('=== CLIENTS PAYMENT STATUS ===');
        clients.forEach(c => {
            console.log(`${c.pppoe_username}: ${c.payment_status}, last_paid_month: ${c.last_paid_month}`);
        });
        
        const payments = await db.prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT 20').all([]);
        console.log('\n=== RECENT PAYMENTS ===');
        payments.forEach(p => {
            console.log(`ID: ${p.id}, User: ${p.user_id}, Month: ${p.month_year}, Status: ${p.status}, PaidAt: ${p.paid_at}`);
        });
        
        db.closeDB();
    } catch (error) {
        console.error('Error:', error);
    }
})();