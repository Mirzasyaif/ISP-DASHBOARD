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
        res.status(500).json({ error: error.message });
    }
});

// Get revenue trends (last 6 months)
router.get('/trends/revenue', authenticateAPI, async (req, res) => {
    try {
        const trends = await getRevenueTrends();
        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get profit analysis (revenue - expenses)
router.get('/analysis/profit', authenticateAPI, async (req, res) => {
    try {
        const analysis = await getProfitAnalysis();
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get cash flow statement
router.get('/cashflow', authenticateAPI, async (req, res) => {
    try {
        const cashflow = await getCashFlow();
        res.json(cashflow);
    } catch (error) {
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
        res.status(500).json({ error: error.message });
    }
});

// Helper functions using db abstraction
async function getMonthlyReport(year) {
    try {
        // For now, return a simplified report using existing db functions
        const summary = await db.getFinancialSummary();
        const allUsers = await db.getAllUsers();
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const currentMonth = parseInt(currentMonthYear.split('-')[1]);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Check if there are any ACTUAL payments recorded in payments table
        // This is the key check - only show data if payments have been recorded
        const stats = await db.getStats();
        const hasActualPayments = stats.paidThisMonth > 0 || stats.totalPayments > 0;
        
        // Only show revenue if there are actual payments recorded
        const shouldShowData = hasActualPayments;
        
        // Calculate revenue per month - return 0 if no actual payments recorded
        const months = [];
        for (let month = 1; month <= 12; month++) {
            const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
            
            // Only calculate revenue if there are actual payments
            let revenue = 0;
            let expenses = 0;
            
            if (shouldShowData) {
                const activeClients = allUsers.filter(user => user.status === 'active');
                revenue = activeClients.reduce((sum, user) => sum + (user.monthly_fee || 0), 0);
                expenses = calculateEstimatedExpenses(month, year);
            }
            
            months.push({
                month: monthNames[month - 1],
                monthYear,
                revenue,
                expenses,
                profit: revenue - expenses,
                newClients: 0,
                profitMargin: revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(1) : 0
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
                profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0
            },
            hasData: shouldShowData
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
                profitMargin: revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(1) : 0
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
                profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0
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
        
        const revenueGrowth = previousYear.totalRevenue > 0 
            ? ((currentYear.totalRevenue - previousYear.totalRevenue) / previousYear.totalRevenue * 100).toFixed(1)
            : 0;
        
        const profitGrowth = previousYear.totalProfit > 0 
            ? ((currentYear.totalProfit - previousYear.totalProfit) / previousYear.totalProfit * 100).toFixed(1)
            : 0;
        
        const allUsers = await db.getAllUsers();
        const totalClients = allUsers.filter(user => user.status === 'active').length;
        
        // No example data - real data only
        const clientGrowth = 0;
        
        return {
            currentYear,
            previousYear,
            growth: {
                revenue: revenueGrowth,
                profit: profitGrowth,
                clients: clientGrowth
            },
            metrics: {
                totalClients,
                averageRevenuePerClient: currentYear.totalRevenue > 0 
                    ? Math.round(currentYear.totalRevenue / totalClients)
                    : 0,
                clientRetention: 0 // No example data
            },
            hasData: currentYearReport.hasData || previousYearReport.hasData
        };
    } catch (error) {
        console.error('Error in getYearlyReport:', error);
        return { error: 'Failed to generate yearly report', details: error.message };
    }
}

async function getRevenueTrends() {
    try {
        const trends = [];
        const currentDate = new Date();
        const allUsers = await db.getAllUsers();
        
        // Check if there are any ACTUAL payments recorded
        const stats = await db.getStats();
        const hasActualPayments = stats.paidThisMonth > 0 || stats.totalPayments > 0;
        
        const activeClients = allUsers.filter(user => user.status === 'active');
        const totalMonthlyRevenue = activeClients.reduce((sum, user) => sum + (user.monthly_fee || 0), 0);
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const monthName = date.toLocaleString('id-ID', { month: 'short' });
            
            // Only show revenue if there are actual payments recorded
            const revenue = hasActualPayments ? totalMonthlyRevenue : 0;
            const expenses = hasActualPayments ? calculateEstimatedExpenses(date.getMonth() + 1, date.getFullYear()) : 0;
            
            trends.push({
                month: monthName,
                monthYear,
                revenue,
                expenses,
                profit: revenue - expenses,
                profitMargin: revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(1) : 0
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
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const allUsers = await db.getAllUsers();
        
        // Check if there are any ACTUAL payments recorded
        const stats = await db.getStats();
        const hasActualPayments = stats.paidThisMonth > 0 || stats.totalPayments > 0;
        
        const activeClients = allUsers.filter(user => user.status === 'active');
        const totalMonthlyRevenue = activeClients.reduce((sum, user) => sum + (user.monthly_fee || 0), 0);
        
        const currentMonth = parseInt(currentMonthYear.split('-')[1]);
        const currentYear = parseInt(currentMonthYear.split('-')[0]);
        
        // Only show expenses if there are actual payments
        const expenses = hasActualPayments ? calculateEstimatedExpenses(currentMonth, currentYear) : 0;
        
        // Expense breakdown - empty if no data
        const expenseBreakdown = hasActualPayments ? [
            { category: 'Internet', total: Math.round(expenses * 0.4) },
            { category: 'Electricity', total: Math.round(expenses * 0.3) },
            { category: 'Maintenance', total: Math.round(expenses * 0.2) },
            { category: 'Other', total: Math.round(expenses * 0.1) }
        ] : [];
        
        return {
            currentMonth: {
                revenue: hasActualPayments ? totalMonthlyRevenue : 0,
                expenses,
                profit: hasActualPayments ? totalMonthlyRevenue - expenses : 0,
                profitMargin: (hasActualPayments && totalMonthlyRevenue > 0) ? ((totalMonthlyRevenue - expenses) / totalMonthlyRevenue * 100).toFixed(1) : 0
            },
            expenseBreakdown,
            revenueByClient: null,
            recommendations: hasActualPayments ? [] : ["📝 Belum ada data keuangan. Mulai dengan:", "  • Catat pembayaran client melalui dashboard atau Telegram"],
            hasData: hasActualPayments
        };
    } catch (error) {
        console.error('Error in getProfitAnalysis:', error);
        return { error: 'Failed to generate profit analysis', details: error.message };
    }
}

async function getCashFlow() {
    try {
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const allUsers = await db.getAllUsers();
        
        // Check if there are any ACTUAL payments recorded
        const stats = await db.getStats();
        const hasActualPayments = stats.paidThisMonth > 0 || stats.totalPayments > 0;
        
        const activeClients = allUsers.filter(user => user.status === 'active');
        const totalMonthlyRevenue = activeClients.reduce((sum, user) => sum + (user.monthly_fee || 0), 0);
        
        const currentMonth = parseInt(currentMonthYear.split('-')[1]);
        const currentYear = parseInt(currentMonthYear.split('-')[0]);
        
        // Only show expenses if there are actual payments
        const expenses = hasActualPayments ? calculateEstimatedExpenses(currentMonth, currentYear) : 0;
        
        // Calculate cash flow - return 0 if no data
        const inflow = hasActualPayments ? Math.round(totalMonthlyRevenue * 0.8) : 0;
        const outflow = expenses;
        const netCashFlow = inflow - outflow;
        
        // Outstanding receivables
        const receivables = hasActualPayments ? totalMonthlyRevenue - inflow : 0;
        
        return {
            period: currentMonthYear,
            inflow,
            outflow,
            netCashFlow,
            receivables,
            cashPosition: netCashFlow,
            metrics: {
                cashConversion: inflow > 0 ? (netCashFlow / inflow * 100).toFixed(1) : 0,
                daysReceivable: hasActualPayments ? 15 : 0,
                operatingMargin: inflow > 0 ? ((inflow - outflow) / inflow * 100).toFixed(1) : 0
            },
            hasData: hasActualPayments
        };
    } catch (error) {
        console.error('Error in getCashFlow:', error);
        return { error: 'Failed to generate cash flow statement', details: error.message };
    }
}

async function getTopClients(limit = 10) {
    try {
        const allUsers = await db.getAllUsers();
        
        // Check if there are any ACTUAL payments recorded
        const stats = await db.getStats();
        const hasActualPayments = stats.paidThisMonth > 0 || stats.totalPayments > 0;
        
        // Return empty array if no actual payments
        if (!hasActualPayments) {
            return [];
        }
        
        // Get active clients with monthly_fee > 0, sorted by monthly fee
        const activeClients = allUsers
            .filter(user => user.status === 'active' && user.monthly_fee > 0)
            .sort((a, b) => (b.monthly_fee || 0) - (a.monthly_fee || 0))
            .slice(0, limit);
        
        return activeClients.map(client => ({
            id: client.id,
            name: client.name || client.pppoe_username,
            monthlyFee: client.monthly_fee || 0,
            totalValue: (client.monthly_fee || 0) * 12,
            paymentsCount: 0, // No example data
            lastPayment: client.last_paid_month || null,
            currentStatus: client.has_paid_this_month ? 'paid' : 'pending',
            lifetimeValue: (client.monthly_fee || 0) * 12
        }));
    } catch (error) {
        console.error('Error in getTopClients:', error);
        return { error: 'Failed to get top clients', details: error.message };
    }
}

// Helper functions
async function calculateEstimatedExpenses(month, year) {
    // Get actual expenses from database if available
    try {
        const expenses = await db.getOperationalExpenses(month, year);
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

function generateProfitRecommendations(revenue, expenses, expenseBreakdown) {
    const recommendations = [];
    const profitMargin = revenue > 0 ? ((revenue - expenses) / revenue * 100) : 0;
    
    if (profitMargin < 20) {
        recommendations.push("⚠️ Profit margin rendah (<20%). Pertimbangkan:");
        recommendations.push("  • Naikkan harga bulanan untuk clients premium");
        recommendations.push("  • Optimalkan biaya operasional");
        
        if (expenseBreakdown.length > 0) {
            const largestExpense = expenseBreakdown[0];
            recommendations.push(`  • Fokus kurangi ${largestExpense.category} (${Math.round(largestExpense.total / expenses * 100)}% dari expenses)`);
        }
    }
    
    if (revenue === 0) {
        recommendations.push("🚨 Tidak ada revenue bulan ini. Periksa:");
        recommendations.push("  • Sistem pembayaran berfungsi?");
        recommendations.push("  • Clients sudah bayar?");
        recommendations.push("  • Payment tracking akurat?");
    }
    
    if (expenses > revenue * 0.5) {
        recommendations.push("📉 Expenses terlalu tinggi (>50% revenue). Tinjau:");
        recommendations.push("  • Biaya operasional bulanan");
        recommendations.push("  • Efisiensi resource");
        recommendations.push("  • Negotiate vendor contracts");
    }
    
    return recommendations.length > 0 ? recommendations : ["✅ Profit margin sehat. Pertahankan!"];
}

module.exports = router;