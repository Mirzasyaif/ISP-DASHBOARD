const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

// Initialize database file
function initDB() {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(dbPath)) {
        const defaultData = {
            users: [],
            payments: [],
            config: {
                setup_completed: false
            }
        };
        fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
    }
}

// Read database
function readDB() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return { users: [], payments: [], config: {} };
    }
}

// Write database with atomic write (safer for concurrent operations)
function writeDB(data) {
    try {
        // Write to a temporary file first, then rename (atomic operation)
        const tempPath = dbPath + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
        fs.renameSync(tempPath, dbPath);
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// CRUD operations
function getAllUsers() {
    const db = readDB();
    const currentMonthYear = new Date().toISOString().slice(0, 7);

    // Add payment status for each user
    return db.users.map(user => {
        const userPayments = db.payments.filter(p => p.user_id === user.id);
        const hasPaidThisMonth = userPayments.some(p =>
            p.month_year === currentMonthYear && p.status === 'paid'
        );
        const lastPaidMonth = user.last_paid_month;

        return {
            ...user,
            payment_status: hasPaidThisMonth ? 'paid' : 'pending',
            has_paid_this_month: hasPaidThisMonth,
            last_paid_month: lastPaidMonth
        };
    });
}

function getUserByUsername(username) {
    const db = readDB();
    return db.users.find(user => user.pppoe_username === username);
}

function getUserById(id) {
    const db = readDB();
    return db.users.find(user => user.id === id);
}

function addUser(userData) {
    const db = readDB();
    userData.id = Date.now().toString(); // Simple ID
    userData.created_at = new Date().toISOString();
    userData.status = userData.status || 'active';
    userData.last_paid_month = null; // Initialize last paid month
    userData.monthly_fee = userData.monthly_fee || 0; // Default fee: 0

    db.users.push(userData);
    writeDB(db);
    return userData;
}

function updatePayment(username, amount = null) {
    const db = readDB();
    const user = db.users.find(u => u.pppoe_username === username);
    
    if (!user) {
        return false;
    }
    
    const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
    const existingPayment = db.payments.find(p => 
        p.user_id === user.id && p.month_year === monthYear
    );

    // Gunakan monthly_fee user jika amount tidak diberikan
    const paymentAmount = amount !== null ? amount : (user.monthly_fee || 0);
    
    if (existingPayment) {
        existingPayment.status = 'paid';
        existingPayment.amount = paymentAmount;
        existingPayment.paid_at = new Date().toISOString();
    } else {
        db.payments.push({
            id: Date.now().toString(),
            user_id: user.id,
            month_year: monthYear,
            amount: paymentAmount,
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_method: 'telegram'
        });
    }
    
    // Update user's last paid month
    user.last_paid_month = monthYear;
    
    writeDB(db);
    return true;
}

function getStats() {
    const db = readDB();
    const totalUsers = db.users.length;

    const monthYear = new Date().toISOString().slice(0, 7);
    
    // Get payments for current month
    const monthPayments = db.payments.filter(p =>
        p.month_year === monthYear && p.status === 'paid'
    );
    
    const paidThisMonth = monthPayments.length;
    const pendingPayments = totalUsers - paidThisMonth;
    
    // Calculate total revenue from payments (sum of all payment amounts)
    const thisMonthRevenue = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Calculate total monthly revenue from all users' monthly_fee
    const totalMonthlyRevenue = db.users.reduce((sum, user) => {
        return sum + (user.monthly_fee || 0);
    }, 0);

    return {
        totalUsers,
        paidThisMonth,
        pendingPayments,
        paymentData: [paidThisMonth, pendingPayments, 0],
        thisMonthRevenue,
        totalMonthlyRevenue
    };
}

// Configuration
function getConfig() {
    const db = readDB();
    return db.config || {};
}

function updateConfig(newConfig) {
    const db = readDB();
    db.config = { ...db.config, ...newConfig };
    writeDB(db);
    return db.config;
}

// Update user monthly fee
function updateUserMonthlyFee(username, newFee) {
    const db = readDB();
    const user = db.users.find(u => u.pppoe_username === username);
    
    if (!user) {
        return false;
    }
    
    user.monthly_fee = newFee;
    writeDB(db);
    return true;
}

// Update user phone number (stub for JSON database)
function updateUserPhoneNumber(userId, phoneNumber) {
    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        return false;
    }
    
    user.phone_number = phoneNumber;
    user.phone = phoneNumber;
    writeDB(db);
    return true;
}

// Update user due date (stub for JSON database)
function updateUserDueDate(userId, dueDate) {
    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        return false;
    }
    
    user.due_date = dueDate;
    writeDB(db);
    return true;
}

// Get user by name or partial name (for fuzzy search)
function findUserByNameOrIP(searchTerm) {
    const db = readDB();
    const lowerSearch = searchTerm.toLowerCase();
    
    return db.users.find(user => {
        return (
            user.pppoe_username.toLowerCase().includes(lowerSearch) ||
            (user.name && user.name.toLowerCase().includes(lowerSearch))
        );
    });
}

// Search users by name or IP (multiple results)
function searchUsersByNameOrIP(searchTerm) {
    const db = readDB();
    const lowerSearch = searchTerm.toLowerCase();
    
    return db.users.filter(user => {
        return (
            user.pppoe_username.toLowerCase().includes(lowerSearch) ||
            (user.name && user.name.toLowerCase().includes(lowerSearch)) ||
            (user.ip_address && user.ip_address.includes(searchTerm))
        );
    }).slice(0, 20); // Limit results
}

// Update user (for createOrUpdateUser)
function updateUser(userData) {
    const db = readDB();
    const index = db.users.findIndex(u => u.pppoe_username === userData.pppoe_username);
    
    if (index === -1) {
        return false;
    }
    
    // Update existing user
    db.users[index] = { ...db.users[index], ...userData };
    writeDB(db);
    return true;
}

// Create or update user
function createOrUpdateUser(userData) {
    const db = readDB();
    const index = db.users.findIndex(u => u.pppoe_username === userData.pppoe_username);
    
    if (index === -1) {
        // Add new user
        userData.id = Date.now().toString();
        userData.created_at = new Date().toISOString();
        db.users.push(userData);
    } else {
        // Update existing user
        db.users[index] = { ...db.users[index], ...userData };
    }
    
    return writeDB(db);
}

// Operational expenses (not implemented for JSON database)
function getOperationalExpenses(month, year) {
    return []; // Empty array for JSON database
}

function addOperationalExpense(expenseData) {
    console.warn('Operational expenses not supported in JSON database');
    return false;
}

module.exports = {
    initDB,
    readDB,
    writeDB,
    getAllUsers,
    getUserByUsername,
    getUserById,
    addUser,
    updatePayment,
    updateUserMonthlyFee,
    updateUserPhoneNumber,
    updateUserDueDate,
    findUserByNameOrIP,
    searchUsersByNameOrIP,
    createOrUpdateUser,
    getOperationalExpenses,
    addOperationalExpense,
    getStats,
    getConfig,
    updateConfig
};