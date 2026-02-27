const db = require('./models/db-sqlite.js');

(async () => {
    try {
        // Initialize DB
        await db.initDB();

        // Use current month/year
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();

        const expenses = await db.getOperationalExpenses(month, year);
        const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        console.log('📊 Total expenses for current month:', total);

        await db.closeDB();
    } catch (err) {
        console.error('❌ Error:', err);
    }
})();