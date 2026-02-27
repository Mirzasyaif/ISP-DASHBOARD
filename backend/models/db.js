const fs = require('fs');
const path = require('path');

// Check if SQLite database exists and migration flag is present
const dataDir = path.join(__dirname, '../data');
const dbSqlitePath = path.join(dataDir, 'database.sqlite');
const migrationFlagPath = path.join(dataDir, '.migrated-to-sqlite');

let useSQLite = false;
let dbModule;

// Determine which database to use
if (fs.existsSync(dbSqlitePath) && fs.existsSync(migrationFlagPath)) {
    console.log('✅ Using SQLite database');
    useSQLite = true;
    dbModule = require('./db-sqlite');
} else {
    console.log('⚠️  Using JSON database (SQLite not migrated yet)');
    console.log('   Run: node migrate-to-sqlite.js to migrate to SQLite');
    dbModule = require('./simple-db');
}

// Initialize database
function initDB() {
    if (useSQLite) {
        return dbModule.initDB();
    } else {
        dbModule.initDB();
        return Promise.resolve();
    }
}

// Close database (SQLite only)
function closeDB() {
    if (useSQLite && dbModule.closeDB) {
        return dbModule.closeDB();
    }
}

// User operations
async function getAllUsers() {
    return dbModule.getAllUsers();
}

async function addUser(userData) {
    return dbModule.addUser(userData);
}

async function getUserByUsername(username) {
    return dbModule.getUserByUsername(username);
}

async function getUserById(id) {
    return dbModule.getUserById ? dbModule.getUserById(id) : null;
}

// Payment operations
async function updatePayment(username, amount = null) {
    return dbModule.updatePayment(username, amount);
}

// Monthly fee operations
async function updateUserMonthlyFee(username, newFee) {
    return dbModule.updateUserMonthlyFee(username, newFee);
}

// User search by name or IP
async function findUserByNameOrIP(searchTerm) {
    return dbModule.findUserByNameOrIP(searchTerm);
}

// Update user phone number
async function updateUserPhoneNumber(userId, phoneNumber) {
    if (dbModule.updateUserPhoneNumber) {
        return dbModule.updateUserPhoneNumber(userId, phoneNumber);
    } else {
        // Fallback implementation
        console.warn('updateUserPhoneNumber not implemented in current database module');
        return false;
    }
}

// Stats
async function getStats() {
    return dbModule.getStats();
}

// Financial summary (SQLite only, fallback for JSON)
async function getFinancialSummary() {
    if (dbModule.getFinancialSummary) {
        return dbModule.getFinancialSummary();
    } else {
        // Fallback for JSON database
        const stats = await getStats();
        return {
            totalMonthlyRevenue: 0,
            thisMonthRevenue: 0,
            outstanding: 0,
            recentTransactions: []
        };
    }
}

// Config
async function getConfig() {
    return dbModule.getConfig();
}

async function updateConfig(configData) {
    return dbModule.updateConfig(configData);
}

// Search users by name or IP (multiple results)
async function searchUsersByNameOrIP(searchTerm) {
    if (dbModule.searchUsersByNameOrIP) {
        return dbModule.searchUsersByNameOrIP(searchTerm);
    } else {
        // Fallback: use findUserByNameOrIP but return array
        const user = await findUserByNameOrIP(searchTerm);
        return user ? [user] : [];
    }
}

// Get users for specific due date (for billing scheduler)
async function getUsersForDueDate(dueDate) {
    if (dbModule.getUsersForDueDate) {
        return dbModule.getUsersForDueDate(dueDate);
    } else {
        console.warn('getUsersForDueDate not supported in current database');
        return [];
    }
}

// Create or update user (for import)
async function createOrUpdateUser(userData) {
    if (dbModule.createOrUpdateUser) {
        return dbModule.createOrUpdateUser(userData);
    } else {
        // Fallback: try to update, if fails, add new
        const existingUser = await getUserByUsername(userData.pppoe_username);
        if (existingUser) {
            return dbModule.updateUser(userData);
        } else {
            return dbModule.addUser(userData);
        }
    }
}

// Operational expenses
async function getOperationalExpenses(month, year) {
    if (dbModule.getOperationalExpenses) {
        return dbModule.getOperationalExpenses(month, year);
    } else {
        return []; // Empty array for JSON database
    }
}

async function addOperationalExpense(expenseData) {
    if (dbModule.addOperationalExpense) {
        return dbModule.addOperationalExpense(expenseData);
    } else {
        console.warn('Operational expenses not supported in current database');
        return false;
    }
}

// Financial reporting functions
async function getMonthlyReport(year) {
    if (dbModule.getMonthlyReport) {
        return dbModule.getMonthlyReport(year);
    } else {
        // Fallback for JSON database
        return {
            error: 'Financial reports require SQLite database',
            details: 'Please run the migration script to enable full financial features.'
        };
    }
}

async function getQuarterlyReport(year) {
    if (dbModule.getQuarterlyReport) {
        return dbModule.getQuarterlyReport(year);
    } else {
        return {
            error: 'Financial reports require SQLite database',
            details: 'Please run the migration script to enable full financial features.'
        };
    }
}

async function getYearlyReport(year) {
    if (dbModule.getYearlyReport) {
        return dbModule.getYearlyReport(year);
    } else {
        return {
            error: 'Financial reports require SQLite database',
            details: 'Please run the migration script to enable full financial features.'
        };
    }
}

async function getRevenueTrends() {
    if (dbModule.getRevenueTrends) {
        return dbModule.getRevenueTrends();
    } else {
        return {
            error: 'Financial trends require SQLite database',
            details: 'Please run the migration script to enable full financial features.'
        };
    }
}

async function getProfitAnalysis() {
    if (dbModule.getProfitAnalysis) {
        return dbModule.getProfitAnalysis();
    } else {
        return {
            error: 'Profit analysis requires SQLite database',
            details: 'Please run the migration script to enable full financial features.'
        };
    }
}

async function getCashFlow() {
    if (dbModule.getCashFlow) {
        return dbModule.getCashFlow();
    } else {
        return {
            error: 'Cash flow analysis requires SQLite database',
            details: 'Please run the migration script to enable full financial features.'
        };
    }
}

async function getTopClients(limit = 10) {
    if (dbModule.getTopClients) {
        return dbModule.getTopClients(limit);
    } else {
        return {
            error: 'Client analysis requires SQLite database',
            details: 'Please run the migration script to enable full financial features.'
        };
    }
}

// Payment-related functions (for payment gateway)
async function getClientByUsername(username) {
    return dbModule.getClientByUsername ? dbModule.getClientByUsername(username) : null;
}

async function getClientById(id) {
    return dbModule.getClientById ? dbModule.getClientById(id) : null;
}

async function getPaymentsByUserId(userId) {
    if (dbModule.getPaymentsByUserId) {
        return dbModule.getPaymentsByUserId(userId);
    } else {
        return []; // Empty array for JSON database
    }
}

async function getPaymentByUserAndMonth(userId, monthYear) {
    if (dbModule.getPaymentByUserAndMonth) {
        return dbModule.getPaymentByUserAndMonth(userId, monthYear);
    } else {
        return null;
    }
}

async function createPaymentTransaction(transactionData) {
    if (dbModule.createPaymentTransaction) {
        return dbModule.createPaymentTransaction(transactionData);
    } else {
        console.warn('createPaymentTransaction not supported in current database');
        return false;
    }
}

async function updatePaymentTransactionStatus(orderId, status, updatedAt) {
    if (dbModule.updatePaymentTransactionStatus) {
        return dbModule.updatePaymentTransactionStatus(orderId, status, updatedAt);
    } else {
        console.warn('updatePaymentTransactionStatus not supported in current database');
        return false;
    }
}

async function getPaymentTransactionByOrderId(orderId) {
    if (dbModule.getPaymentTransactionByOrderId) {
        return dbModule.getPaymentTransactionByOrderId(orderId);
    } else {
        return null;
    }
}

async function updatePaymentStatus(id, status, paidAt, paymentMethod) {
    if (dbModule.updatePaymentStatus) {
        return dbModule.updatePaymentStatus(id, status, paidAt, paymentMethod);
    } else {
        console.warn('updatePaymentStatus not supported in current database');
        return false;
    }
}

async function createPaymentRecord(paymentData) {
    if (dbModule.createPaymentRecord) {
        return dbModule.createPaymentRecord(paymentData);
    } else {
        console.warn('createPaymentRecord not supported in current database');
        return false;
    }
}

async function updateClientPaymentStatus(userId, lastPaidMonth, paymentStatus) {
    if (dbModule.updateClientPaymentStatus) {
        return dbModule.updateClientPaymentStatus(userId, lastPaidMonth, paymentStatus);
    } else {
        console.warn('updateClientPaymentStatus not supported in current database');
        return false;
    }
}

// Delete payment function
async function deletePayment(username, monthYear) {
    if (dbModule.deletePayment) {
        return dbModule.deletePayment(username, monthYear);
    } else {
        console.warn('deletePayment not supported in current database');
        return { success: false, message: 'Delete payment not supported in current database' };
    }
}

// Export
module.exports = {
    initDB,
    closeDB,
    getAllUsers,
    addUser,
    getUserByUsername,
    getUserById,
    updatePayment,
    updateUserMonthlyFee,
    findUserByNameOrIP,
    searchUsersByNameOrIP,
    getUsersForDueDate,
    createOrUpdateUser,
    getOperationalExpenses,
    addOperationalExpense,
    getStats,
    getFinancialSummary,
    getConfig,
    updateConfig,
    // Financial reporting functions
    getMonthlyReport,
    getQuarterlyReport,
    getYearlyReport,
    getRevenueTrends,
    getProfitAnalysis,
    getCashFlow,
    getTopClients,
    // Expose which database is being used
    getDatabaseType: () => useSQLite ? 'sqlite' : 'json',
    // WhatsApp-related functions
    updateUserPhoneNumber,
    // Payment gateway functions
    getClientByUsername,
    getClientById,
    getPaymentsByUserId,
    getPaymentByUserAndMonth,
    createPaymentTransaction,
    updatePaymentTransactionStatus,
    getPaymentTransactionByOrderId,
    updatePaymentStatus,
    createPaymentRecord,
    updateClientPaymentStatus,
    deletePayment
};
