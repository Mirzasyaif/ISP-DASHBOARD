const db = require('./models/db-sqlite.js');

(async () => {
    try {
        // Initialize DB
        await db.initDB();

        // Add a test expense (amount 123456)
        const expenseData = {
            category: 'test',
            description: 'test expense',
            amount: 123456,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            recorded_by: 'test_script'
        };
        const added = await db.addOperationalExpense(expenseData);
        console.log('✅ Expense added:', added);

        // Retrieve expenses for current month/year
        const expenses = await db.getOperationalExpenses(expenseData.month, expenseData.year);
        const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        console.log('📊 Total expenses for current month:', total);

    // Clean up: delete test expense then close DB
    await db.run(`DELETE FROM expenses WHERE category = ? AND description = ?`, [expenseData.category, expenseData.description]);
    console.log('🧹 Test expense rows deleted');
    await db.closeDB();
    console.log('🧹 Test DB closed');
    } catch (err) {
        console.error('❌ Error during test:', err);
    }
})();