const db = require('./models/db-sqlite');

(async () => {
    try {
        await db.initDB();
        
        // Get AGIL and YOZ user IDs
        const agil = await db.getClientByUsername('AGIL');
        const yoz = await db.getClientByUsername('YOZ');
        
        console.log('=== USER INFO ===');
        console.log('AGIL:', agil ? { id: agil.id, name: agil.full_name, monthly_fee: agil.monthly_fee } : 'NOT FOUND');
        console.log('YOZ:', yoz ? { id: yoz.id, name: yoz.full_name, monthly_fee: yoz.monthly_fee } : 'NOT FOUND');
        
        // Check payments for AGIL
        if (agil) {
            const agilPayments = await db.getPaymentsByUserId(agil.id);
            console.log('\n=== AGIL PAYMENTS ===');
            agilPayments.forEach(p => {
                console.log(`Month: ${p.month_year}, Status: ${p.status}, Amount: ${p.amount}, PaidAt: ${p.paid_at}`);
            });
        }
        
        // Check payments for YOZ
        if (yoz) {
            const yozPayments = await db.getPaymentsByUserId(yoz.id);
            console.log('\n=== YOZ PAYMENTS ===');
            yozPayments.forEach(p => {
                console.log(`Month: ${p.month_year}, Status: ${p.status}, Amount: ${p.amount}, PaidAt: ${p.paid_at}`);
            });
        }
        
        // Check current month payments
        const currentMonth = new Date().toISOString().slice(0, 7);
        console.log(`\n=== ALL PAYMENTS FOR ${currentMonth} ===`);
        const allPayments = await db.prepare('SELECT p.*, c.pppoe_username FROM payments p JOIN clients c ON p.user_id = c.id WHERE p.month_year = ?').all([currentMonth]);
        allPayments.forEach(p => {
            console.log(`${p.pppoe_username}: Status=${p.status}, Amount=${p.amount}, PaidAt=${p.paid_at}`);
        });
        
        db.closeDB();
    } catch (error) {
        console.error('Error:', error);
    }
})();