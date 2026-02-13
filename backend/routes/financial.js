const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateAPI } = require('../middleware/auth');

// Get detailed financial report with time period
router.get('/report/:period', authenticateAPI, async (req, res) => {
    try {
        const { period } = req.params; // monthly, quarterly, yearly
        const year = req.query.year || new Date().getFullYear();
        
        let report;
        switch(period) {
            case 'monthly':
                report = await getMonthlyReport(year);
                break;
            case 'quarterly':
                report = await getQuarterlyReport(year);
                break;
            case 'yearly':
                report = await getYearlyReport(year);
                break;
            default:
                return res.status(400).json({ error: 'Invalid period. Use: monthly, quarterly, yearly' });
        }
        
        res.json(report);
    } catch (error) {
        console.error('Error in /report/:period:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get revenue trends (last 6 months)
router.get('/trends/revenue', authenticateAPI, async (req, res) => {
    try {
        const trends = await getRevenueTrends();
        res.json(trends);
    } catch (error) {
        console.error('Error in /trends/revenue:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get profit analysis (revenue - expenses)
router.get('/analysis/profit', authenticateAPI, async (req, res) => {
    try {
        const analysis = await getProfitAnalysis();
        res.json(analysis);
    } catch (error) {
        console.error('Error in /analysis/profit:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get cash flow statement
router.get('/cashflow', authenticateAPI, async (req, res) => {
    try {
        const cashflow = await getCashFlow();
        res.json(cashflow);
    } catch (error) {
        console.error('Error in /cashflow:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get top clients by revenue
router.get('/top-clients', authenticateAPI, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const topClients = await getTopClients(limit);
        res.json(topClients);
    } catch (error) {
        console.error('Error in /top-clients:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get operational expenses for a specific month/year
router.get('/expenses', authenticateAPI, async (req, res) => {
    try {
        const { month, year } = req.query;
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();
        
        const expenses = await db.getOperationalExpenses(currentMonth, currentYear);
        
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        // Group expenses by category
        const categories = {};
        expenses.forEach(exp => {
            if (!categories[exp.category]) {
                categories[exp.category] = {
                    total: 0,
                    count: 0,
                    items: []
                };
            }
            categories[exp.category].total += exp.amount || 0;
            categories[exp.category].count += 1;
            categories[exp.category].items.push(exp);
        });
        
        res.json({
            month: currentMonth,
            year: currentYear,
            expenses,
            totalExpenses,
            categories,
            count: expenses.length
        });
    } catch (error) {
        console.error('Error in /expenses:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add a new operational expense
router.post('/expenses', authenticateAPI, async (req, res) => {
    try {
        const { category, description, amount, month, year, recorded_by } = req.body;
        
        if (!category || !description || !amount) {
            return res.status(400).json({ error: 'Missing required fields: category, description, amount' });
        }
        
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }
        
        const expenseData = {
            category,
            description,
            amount,
            month: month || new Date().getMonth() + 1,
            year: year || new Date().getFullYear(),
            recorded_by: recorded_by || 'dashboard'
        };
        
        const success = await db.addOperationalExpense(expenseData);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Expense recorded successfully',
                expense: expenseData
            });
        } else {
            res.status(500).json({ error: 'Failed to record expense' });
        }
    } catch (error) {
        console.error('Error in POST /expenses:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get full dashboard data (combines stats and financial summary)
router.get('/dashboard', authenticateAPI, async (req, res) => {
    try {
        const [stats, financialSummary] = await Promise.all([
            db.getStats(),
            db.getFinancialSummary()
        ]);
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        // Get actual expenses for current month
        const expenses = await db.getOperationalExpenses(currentMonth, currentYear);
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        // Calculate revenue metrics
        const activeClients = stats.totalUsers || 0;
        const totalRevenue = financialSummary?.totalMonthlyRevenue || 0;
        const thisMonthRevenue = financialSummary?.thisMonthRevenue || 0;
        const outstanding = financialSummary?.outstanding || 0;
        
        // Calculate net profit (revenue - actual expenses)
        const netProfit = thisMonthRevenue - totalExpenses;
        const profitMargin = thisMonthRevenue > 0 ? ((netProfit / thisMonthRevenue) * 100).toFixed(1) : 0;
        
        // Cash flow calculation
        const cashFlow = thisMonthRevenue - totalExpenses;
        const cashConversion = thisMonthRevenue > 0 ? ((cashFlow / thisMonthRevenue) * 100).toFixed(1) : 0;
        
        res.json({
            // Stats
            totalUsers: stats.totalUsers || 0,
            paidThisMonth: stats.paidThisMonth || 0,
            pendingPayments: stats.pendingPayments || 0,
            paymentData: stats.paymentData || [0, 0, 0],
            
            // Financial metrics
            totalRevenue,
            thisMonthRevenue,
            totalExpenses,
            netProfit,
            profitMargin,
            
            // Client metrics
            activeClients,
            outstanding,
            
            // Cash flow
            cashFlow,
            cashConversion,
            
            // Revenue change (compare to last month - simplified)
            revenueChange: 0,
            
            // Last updated
            lastUpdated: new Date().toISOString(),
            
            // For compatibility
            active_clients: activeClients,
            total_monthly: totalRevenue
        });
    } catch (error) {
        console.error('Error in /dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== Helper Functions =====

async function getMonthlyReport(year) {
    try {
        const [summary, allUsers, stats] = await Promise.all([
            db.getFinancialSummary(),
            db.getAllUsers(),
            db.getStats()
        ]);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        
        // Get all clients
        const clients = Array.isArray(allUsers) ? allUsers : [];
        const activeClients = clients.filter(c => c.status === 'active');
        
        // Calculate monthly revenue (potential)
        const monthlyRevenue = activeClients.reduce((sum, c) => sum + (c.monthly_fee || 0), 0);
        
        // Get actual payments received
        const currentMonth = parseInt(currentMonthYear.split('-')[1]);
        const currentYear = parseInt(currentMonthYear.split('-')[0]);
        
        // Build monthly data
        const months = [];
        for (let month = 1; month <= 12; month++) {
            const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
            const isCurrentMonth = monthYear === currentMonthYear;
            
            // For current month, use actual data; for others use potential
            const revenue = isCurrentMonth && year === currentYear 
                ? (summary.thisMonthRevenue || 0)
                : monthlyRevenue;
            
            const expenses = await calculateEstimatedExpenses(month, year);
            const profit = revenue - expenses;
            
            months.push({
                month: monthNames[month - 1],
                monthYear,
                revenue,
                expenses,
                profit,
                newClients: 0,
                profitMargin: revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0
            });
        }
        
        // Year totals
        const totalRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
        const totalExpenses = months.reduce((sum, m) => sum + m.expenses, 0);
        const totalProfit = totalRevenue - totalExpenses;
        
        return {
            year,
            months,
            summary: {
                totalRevenue,
                totalExpenses,
                totalProfit,
                averageMonthlyRevenue: Math.round(totalRevenue / 12),
                averageMonthlyProfit: Math.round(totalProfit / 12),
                profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0
            }
        };
    } catch (error) {
        console.error('Error in getMonthlyReport:', error);
        return { error: 'Failed to generate monthly report', details: error.message };
    }
}

async function getQuarterlyReport(year) {
    try {
        const monthlyReport = await getMonthlyReport(year);
        const months = monthlyReport.months;
        
        const quarters = [];
        const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
        
        for (let quarter = 1; quarter <= 4; quarter++) {
            const startMonth = (quarter - 1) * 3;
            const endMonth = startMonth + 2;
            
            const quarterMonths = months.slice(startMonth, endMonth + 1);
            const revenue = quarterMonths.reduce((sum, m) => sum + m.revenue, 0);
            const expenses = quarterMonths.reduce((sum, m) => sum + m.expenses, 0);
            
            quarters.push({
                quarter: quarterNames[quarter - 1],
                months: `${startMonth + 1}-${endMonth + 1}`,
                revenue,
                expenses,
                profit: revenue - expenses,
                newClients: quarterMonths.reduce((sum, m) => sum + m.newClients, 0),
                profitMargin: revenue > 0 ? (((revenue - expenses) / revenue) * 100).toFixed(1) : 0
            });
        }
        
        const totalRevenue = quarters.reduce((sum, q) => sum + q.revenue, 0);
        const totalExpenses = quarters.reduce((sum, q) => sum + q.expenses, 0);
        const totalProfit = totalRevenue - totalExpenses;
        
        return {
            year,
            quarters,
            summary: {
                totalRevenue,
                totalExpenses,
                totalProfit,
                averageQuarterlyRevenue: Math.round(totalRevenue / 4),
                averageQuarterlyProfit: Math.round(totalProfit / 4),
                profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0
            }
        };
    } catch (error) {
        console.error('Error in getQuarterlyReport:', error);
        return { error: 'Failed to generate quarterly report', details: error.message };
    }
}

async function getYearlyReport(year) {
    try {
        const currentYearReport = await getMonthlyReport(year);
        const previousYearReport = await getMonthlyReport(year - 1);
        
        const currentYear = currentYearReport.summary;
        const previousYear = previousYearReport.summary;
        
        const allUsers = await db.getAllUsers();
        const clients = Array.isArray(allUsers) ? allUsers : [];
        const totalClients = clients.filter(c => c.status === 'active').length;
        
        // Calculate growth percentages
        const revenueGrowth = previousYear.totalRevenue > 0 
            ? (((currentYear.totalRevenue - previousYear.totalRevenue) / previousYear.totalRevenue) * 100).toFixed(1)
            : 0;
        
        const profitGrowth = previousYear.totalProfit > 0 
            ? (((currentYear.totalProfit - previousYear.totalProfit) / previousYear.totalProfit) * 100).toFixed(1)
            : 0;
        
        return {
            year,
            currentYear,
            previousYear,
            growth: {
                revenue: revenueGrowth,
                profit: profitGrowth,
                clients: 0 // Would need client history tracking
            },
            metrics: {
                totalClients,
                averageRevenuePerClient: totalClients > 0 
                    ? Math.round(currentYear.totalRevenue / totalClients)
                    : 0,
                clientRetention: 0
            }
        };
    } catch (error) {
        console.error('Error in getYearlyReport:', error);
        return { error: 'Failed to generate yearly report', details: error.message };
    }
}

async function getRevenueTrends() {
    try {
        const [summary, stats] = await Promise.all([
            db.getFinancialSummary(),
            db.getStats()
        ]);
        
        const allUsers = await db.getAllUsers();
        const clients = Array.isArray(allUsers) ? allUsers : [];
        const activeClients = clients.filter(c => c.status === 'active');
        const totalMonthlyRevenue = activeClients.reduce((sum, c) => sum + (c.monthly_fee || 0), 0);
        
        const currentDate = new Date();
        const trends = [];
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const monthName = date.toLocaleString('id-ID', { month: 'short' });
            
            // Use actual this month data, potential for past months
            const isCurrentMonth = i === 0;
            const revenue = isCurrentMonth 
                ? (summary.thisMonthRevenue || totalMonthlyRevenue)
                : totalMonthlyRevenue;
            
            const expenses = await calculateEstimatedExpenses(date.getMonth() + 1, date.getFullYear());
            
            trends.push({
                month: monthName,
                monthYear,
                revenue,
                expenses,
                profit: revenue - expenses,
                profitMargin: revenue > 0 ? (((revenue - expenses) / revenue) * 100).toFixed(1) : 0
            });
        }
        
        return trends;
    } catch (error) {
        console.error('Error in getRevenueTrends:', error);
        return { error: 'Failed to generate revenue trends', details: error.message };
    }
}

async function getProfitAnalysis() {
    try {
        const [summary, allUsers] = await Promise.all([
            db.getFinancialSummary(),
            db.getAllUsers()
        ]);
        
        const clients = Array.isArray(allUsers) ? allUsers : [];
        const activeClients = clients.filter(c => c.status === 'active');
        const totalMonthlyRevenue = activeClients.reduce((sum, c) => sum + (c.monthly_fee || 0), 0);
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const currentMonth = parseInt(currentMonthYear.split('-')[1]);
        const currentYear = parseInt(currentMonthYear.split('-')[0]);
        
        const revenue = summary.thisMonthRevenue || totalMonthlyRevenue;
        const expenses = await calculateEstimatedExpenses(currentMonth, currentYear);
        const profit = revenue - expenses;
        
        // Get actual expense breakdown from database
        const expenseBreakdown = [];
        try {
            const dbExpenses = await db.getOperationalExpenses(currentMonth, currentYear);
            if (dbExpenses && dbExpenses.length > 0) {
                // Group expenses by category
                const categories = {};
                dbExpenses.forEach(exp => {
                    if (!categories[exp.category]) {
                        categories[exp.category] = 0;
                    }
                    categories[exp.category] += exp.amount || 0;
                });
                
                // Convert to array format
                Object.keys(categories).forEach(category => {
                    expenseBreakdown.push({
                        category: category,
                        total: categories[category]
                    });
                });
            }
        } catch (error) {
            console.error('Error getting expense breakdown:', error);
        }
        
        // If no expenses in database, show empty breakdown
        if (expenseBreakdown.length === 0 && expenses > 0) {
            // Fallback to estimated breakdown if expenses exist but no breakdown data
            expenseBreakdown.push(
                { category: 'Operational', total: expenses }
            );
        }
        
        return {
            currentMonth: {
                revenue,
                expenses,
                profit,
                profitMargin: revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0
            },
            expenseBreakdown,
            revenueByClient: null,
            recommendations: [
                "📊 Analisis profit berdasarkan data pembayaran aktual",
                revenue > 0 ? "✅ Data pendapatan tersedia" : "⚠️ Belum ada pembayaran tercatat bulan ini",
                expenses === 0 ? "💡 Belum ada pengeluaran tercatat. Gunakan Telegram bot untuk mencatat pengeluaran." : "✅ Pengeluaran sudah tercatat"
            ]
        };
    } catch (error) {
        console.error('Error in getProfitAnalysis:', error);
        return { error: 'Failed to generate profit analysis', details: error.message };
    }
}

async function getCashFlow() {
    try {
        const [summary, allUsers] = await Promise.all([
            db.getFinancialSummary(),
            db.getAllUsers()
        ]);
        
        const clients = Array.isArray(allUsers) ? allUsers : [];
        const activeClients = clients.filter(c => c.status === 'active');
        const totalMonthlyRevenue = activeClients.reduce((sum, c) => sum + (c.monthly_fee || 0), 0);
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const currentMonth = parseInt(currentMonthYear.split('-')[1]);
        const currentYear = parseInt(currentMonthYear.split('-')[0]);
        
        const revenue = summary.thisMonthRevenue || totalMonthlyRevenue;
        const expenses = await calculateEstimatedExpenses(currentMonth, currentYear);
        
        const inflow = revenue;
        const outflow = expenses;
        const netCashFlow = inflow - outflow;
        
        // Outstanding receivables
        const receivables = summary.outstanding || 0;
        const cashPosition = netCashFlow;
        
        return {
            period: currentMonthYear,
            inflow,
            outflow,
            netCashFlow,
            receivables,
            cashPosition,
            metrics: {
                cashConversion: inflow > 0 ? ((netCashFlow / inflow) * 100).toFixed(1) : 0,
                daysReceivable: 15,
                operatingMargin: inflow > 0 ? (((inflow - outflow) / inflow) * 100).toFixed(1) : 0
            }
        };
    } catch (error) {
        console.error('Error in getCashFlow:', error);
        return { error: 'Failed to generate cash flow statement', details: error.message };
    }
}

async function getTopClients(limit = 10) {
    try {
        const allUsers = await db.getAllUsers();
        const clients = Array.isArray(allUsers) ? allUsers : [];
        
        // Get active clients with monthly_fee > 0, sorted by monthly fee
        const topClients = clients
            .filter(c => c.status === 'active' && c.monthly_fee > 0)
            .sort((a, b) => (b.monthly_fee || 0) - (a.monthly_fee || 0))
            .slice(0, limit);
        
        return topClients.map((client, index) => ({
            id: client.id,
            name: client.name || client.pppoe_username,
            monthlyFee: client.monthly_fee || 0,
            totalValue: (client.monthly_fee || 0) * 12,
            paymentsCount: 0,
            lastPayment: client.last_paid_month || null,
            currentStatus: client.has_paid_this_month ? 'paid' : 'pending',
            lifetimeValue: (client.monthly_fee || 0) * 12,
            rank: index + 1
        }));
    } catch (error) {
        console.error('Error in getTopClients:', error);
        return { error: 'Failed to get top clients', details: error.message };
    }
}

// Helper function to calculate estimated expenses
async function calculateEstimatedExpenses(month = null, year = null) {
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();
    
    // Get actual expenses from database if available
    try {
        const expenses = await db.getOperationalExpenses(currentMonth, currentYear);
        if (expenses && expenses.length > 0) {
            const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
            return totalExpenses;
        }
    } catch (error) {
        console.error('Error getting operational expenses:', error);
    }
    
    // If no expenses recorded, return 0 instead of estimated value
    return 0;
}

module.exports = router;
