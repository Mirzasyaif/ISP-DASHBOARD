const path = require('path');
const fs = require('fs');

// Try to load better-sqlite3, fall back to sqlite3 if unavailable or mismatched
/* Use sqlite3 for database access to avoid native module compatibility issues */
const sqlite3 = require('sqlite3').verbose();
let Database = class {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
    }
    // Minimal wrapper methods used in the codebase
    pragma(statement) {
        // sqlite3 does not support pragma via method; execute directly
        this.run(statement);
    }
    prepare(sql) {
        const db = this.db;
        return {
            all: (params) => new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
            }),
            get: (params) => new Promise((resolve, reject) => {
                db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
            }),
            run: (params) => new Promise((resolve, reject) => {
                db.run(sql, params, function(err) {
                    if (err) return reject(err);
                    resolve({ changes: this.changes, lastID: this.lastID });
                });
            })
        };
    }
    exec(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => err ? reject(err) : resolve());
        });
    }
    close() {
        this.db.close();
    }
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) return reject(err);
                resolve({ changes: this.changes, lastID: this.lastID });
            });
        });
    }
};

const dbPath = path.join(__dirname, '../data/database.sqlite');

// Initialize database connection
let db;

async function initDB() {
    try {
        // Ensure database file exists
        if (!fs.existsSync(dbPath)) {
            console.error(`❌ Database file not found: ${dbPath}`);
            console.log('⚠️  Running setup script to create database...');
            throw new Error('Database file not found. Run setup-sqlite.js first.');
        }

        db = new Database(dbPath);
        // sqlite3 does not support pragma via method; execute directly
        await db.run('PRAGMA foreign_keys = ON');

        // Test connection
        const result = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all([]);
        console.log(`✅ SQLite database initialized. Found ${result.length} tables.`);

        // Ensure required schema columns exist
        await ensureSchema();

        // Resolve the promise (async function returns a promise automatically)
        return;
    } catch (error) {
        console.error('❌ Error initializing SQLite database:', error.message);
        throw error;
    }
}

function ensureSchema() {
    // Attempt to add phone_number column; ignore error if it already exists
    db.exec("ALTER TABLE clients ADD COLUMN phone_number TEXT").catch(() => {});
    // Attempt to add due_date column; ignore error if it already exists
    db.exec("ALTER TABLE clients ADD COLUMN due_date TEXT").catch(() => {});
    // Attempt to add payment_status column; ignore error if it already exists
    db.exec("ALTER TABLE clients ADD COLUMN payment_status TEXT DEFAULT 'pending'").catch(() => {});
    // Attempt to add last_paid_month column; ignore error if it already exists
    db.exec("ALTER TABLE clients ADD COLUMN last_paid_month TEXT").catch(() => {});
    // Ensure payments table has paid_at and payment_method columns
    db.exec("ALTER TABLE payments ADD COLUMN paid_at TEXT").catch(() => {});
    db.exec("ALTER TABLE payments ADD COLUMN payment_method TEXT").catch(() => {});
}

function closeDB() {
    if (db) {
        db.close();
        console.log('✅ Database connection closed');
    }
}

/* ---------- Client Operations ---------- */
function getAllClients() {
    // Check if database is initialized
    if (!db) {
        console.error('❌ Database not initialized in getAllClients');
        return [];
    }
    
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    const query = `
        SELECT 
            c.*,
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM payments p 
                    WHERE p.user_id = c.id 
                    AND p.month_year = ? 
                    AND p.status = 'paid'
                ) THEN 'paid'
                ELSE 'pending'
            END as payment_status,
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM payments p 
                    WHERE p.user_id = c.id 
                    AND p.month_year = ? 
                    AND p.status = 'paid'
                ) THEN 1
                ELSE 0
            END as has_paid_this_month
        FROM clients c
        ORDER BY c.name
    `;
    return db.prepare(query).all([currentMonthYear, currentMonthYear]);
}

function getClientByUsername(username) {
    const query = 'SELECT * FROM clients WHERE pppoe_username = ?';
    return db.prepare(query).get([username]);
}

function getClientById(id) {
    const query = 'SELECT * FROM clients WHERE id = ?';
    return db.prepare(query).get([id]);
}

function addClient(clientData) {
    const {
        pppoe_username,
        full_name,
        address,
        phone,
        plan,
        ip_address,
        monthly_fee = 0,
        status = 'active'
    } = clientData;

    const id = Date.now().toString();
    const created_at = new Date().toISOString();

    const query = `
        INSERT INTO clients (
            id, name, pppoe_username, full_name, address, phone,
            plan, ip_address, monthly_fee, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = db.prepare(query);
    stmt.run([id, pppoe_username, pppoe_username, full_name || null, address || null, phone || null,
        plan, ip_address || null, monthly_fee, status, created_at]);

    return {
        id,
        pppoe_username,
        full_name,
        address,
        phone,
        plan,
        ip_address,
        monthly_fee,
        status,
        created_at
    };
}

/* ---------- Payment Operations ---------- */
async function updatePayment(username) {
    const client = await getClientByUsername(username);
    if (!client) return false;

    const monthYear = new Date().toISOString().slice(0, 7);
    const existing = await db.prepare(`
        SELECT * FROM payments 
        WHERE user_id = ? AND month_year = ?
    `).get([client.id, monthYear]);

    if (existing) {
        const upd = db.prepare(`
            UPDATE payments 
            SET status = 'paid', paid_at = ?, payment_method = 'telegram'
            WHERE id = ?
        `);
        await upd.run([new Date().toISOString(), existing.id]);
    } else {
        const ins = db.prepare(`
            INSERT INTO payments (id, user_id, month_year, amount, status, paid_at, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        await ins.run([Date.now().toString(), client.id, monthYear, client.monthly_fee || 0, 'paid',
            new Date().toISOString(), 'telegram']);

        const tx = db.prepare(`
            INSERT INTO transactions (id, date, type, amount, category, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        await tx.run([`tx_${Date.now()}`, new Date().toISOString(), 'income', client.monthly_fee || 0, 'subscription',
            `Payment from ${username} for ${monthYear}`]);
    }

    // Update client payment status and last paid month
    const updClient = db.prepare(`
        UPDATE clients 
        SET last_paid_month = ?, payment_status = 'paid' 
        WHERE id = ?
    `);
    await updClient.run([monthYear, client.id]);

    return true;
}

// New helper to fetch payment records for a specific user
async function getPaymentsByUserId(userId) {
    const rows = await db.prepare(`
        SELECT * FROM payments
        WHERE user_id = ?
        ORDER BY month_year DESC
    `).all([userId]);
    return rows;
}

/* ---------- Config Operations ---------- */
async function getConfig() {
    // Check if db is initialized
    if (!db) {
        console.error('❌ Database not initialized. Call initDB() first.');
        return {};
    }
    
    try {
        const rows = await db.prepare('SELECT key, value FROM config').all([]);
        const config = {};
        
        // Ensure rows is an array before forEach
        if (Array.isArray(rows)) {
            rows.forEach(row => {
                try { config[row.key] = JSON.parse(row.value); }
                catch { config[row.key] = row.value; }
            });
        } else {
            console.error('⚠️ getConfig: rows is not an array:', typeof rows, rows);
        }
        
        return config;
    } catch (error) {
        console.error('❌ Error in getConfig:', error.message);
        return {};
    }
}

async function updateConfig(newConfig) {
    const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    // Wait for all insert operations to complete
    for (const [k, v] of Object.entries(newConfig)) {
        const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
        await stmt.run([k, val]);
    }
    return await getConfig();
}

/* ---------- Miscellaneous Helpers ---------- */
function getUserByNameOrIP(searchTerm) {
    const pattern = `%${searchTerm}%`;
    const query = `
        SELECT * FROM clients 
        WHERE pppoe_username LIKE ? 
           OR full_name LIKE ? 
           OR ip_address LIKE ?
        LIMIT 1
    `;
    return db.prepare(query).get([pattern, pattern, pattern]);
}

function searchUsersByNameOrIP(searchTerm) {
    const pattern = `%${searchTerm}%`;
    const query = `
        SELECT * FROM clients 
        WHERE LOWER(pppoe_username) LIKE LOWER(?)
           OR LOWER(full_name) LIKE LOWER(?)
           OR ip_address LIKE ?
        ORDER BY pppoe_username
        LIMIT 20
    `;
    return db.prepare(query).all([pattern, pattern, pattern]);
}

function updateUserMonthlyFee(username, newFee) {
    const stmt = db.prepare('UPDATE clients SET monthly_fee = ? WHERE pppoe_username = ?');
    const res = stmt.run([newFee, username]);
    return res.changes > 0;
}

function updateUserPhoneNumber(userId, phoneNumber) {
    const stmt = db.prepare('UPDATE clients SET phone_number = ?, phone = ? WHERE id = ?');
    const res = stmt.run([phoneNumber, phoneNumber, userId]);
    return res.changes > 0;
}

function updateUserDueDate(userId, dueDate) {
    const stmt = db.prepare('UPDATE clients SET due_date = ? WHERE id = ?');
    const res = stmt.run([dueDate, userId]);
    return res.changes > 0;
}

function getUsersForDueDate(dueDate) {
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    const query = `
        SELECT c.* 
        FROM clients c
        WHERE c.due_date = ?
          AND c.status = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM payments p 
              WHERE p.user_id = c.id 
                AND p.month_year = ? 
                AND p.status = 'paid'
          )
    `;
    return db.prepare(query).all([dueDate, currentMonthYear]);
}

/* ---------- User Operations (alias for compatibility) ---------- */
function getAllUsers() {
    return getAllClients();
}

function getUserByUsername(username) {
    return getClientByUsername(username);
}

function getUserById(id) {
    return getClientById(id);
}

function addUser(userData) {
    return addClient(userData);
}

/* ---------- Export ---------- */
module.exports = {
    initDB,
    closeDB,
    getAllClients,
    getAllUsers,
    getUserByUsername,
    getUserById,
    addUser,
    getClientByUsername,
    getClientById,
    addClient,
    updatePayment,
    getConfig,
    updateConfig,
    getUserByNameOrIP,
    searchUsersByNameOrIP,
    updateUserMonthlyFee,
    updateUserPhoneNumber,
    updateUserDueDate,
    getUsersForDueDate,
    // New: Statistics endpoint for /api/stats
    getStats: async function () {
        try {
            // Check if database is initialized
            if (!db) {
                console.error('❌ Database not initialized in getStats');
                await initDB();
            }
            
            // Current month-year string, e.g., "2026-02"
            const monthYear = new Date().toISOString().slice(0, 7);
            // Total number of clients/users
            const totalUsersRow = await db.prepare('SELECT COUNT(*) AS count FROM clients').get([]);
            const totalUsers = totalUsersRow.count;

            // Number of users who have a paid payment for the current month
            const paidRow = await db.prepare(`
                SELECT COUNT(DISTINCT user_id) AS count
                FROM payments
                WHERE month_year = ? AND status = 'paid'
            `).get([monthYear]);
            const paidThisMonth = paidRow.count;

            // Pending payments are the remainder
            const pendingPayments = totalUsers - paidThisMonth;

            // Total payments recorded (all months)
            const totalPaymentsRow = await db.prepare('SELECT COUNT(*) AS count FROM payments').get([]);
            const totalPayments = totalPaymentsRow.count;

            // paymentData mirrors the simple-db implementation (paid, pending, placeholder)
            const paymentData = [paidThisMonth, pendingPayments, 0];

            return {
                totalUsers,
                paidThisMonth,
                pendingPayments,
                totalPayments,
                paymentData
            };
        } catch (error) {
            console.error('Error in getStats:', error);
            return {
                totalUsers: 0,
                paidThisMonth: 0,
                pendingPayments: 0,
                totalPayments: 0,
                paymentData: [0, 0, 0]
            };
        }
    },
    // Export new helper to fetch payment records for a specific user
    getPaymentsByUserId,
    
    // Financial summary function
    getFinancialSummary: async function() {
        try {
            // Check if database is initialized
            if (!db) {
                console.error('❌ Database not initialized in getFinancialSummary');
                await initDB();
            }
            
            // Total monthly revenue (sum of all monthly fees for active clients)
            const totalMonthlyRevenueResult = await db.prepare(`
                SELECT COALESCE(SUM(monthly_fee), 0) as total 
                FROM clients 
                WHERE status = 'active'
            `).get([]);
            const totalMonthlyRevenue = totalMonthlyRevenueResult?.total || 0;
            
            // Total payments received this month
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            const thisMonthRevenueResult = await db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total 
                FROM payments 
                WHERE month_year = ? AND status = 'paid'
            `).get([currentMonthYear]);
            const thisMonthRevenue = thisMonthRevenueResult?.total || 0;
            
            // Total outstanding (active clients who haven't paid this month)
            const outstandingResult = await db.prepare(`
                SELECT COALESCE(SUM(c.monthly_fee), 0) as total
                FROM clients c
                WHERE c.status = 'active'
                AND NOT EXISTS (
                    SELECT 1 FROM payments p 
                    WHERE p.user_id = c.id 
                    AND p.month_year = ? 
                    AND p.status = 'paid'
                )
            `).get([currentMonthYear]);
            const outstanding = outstandingResult?.total || 0;
            
            // Recent transactions (last 10)
            const recentTransactions = await db.prepare(`
                SELECT * FROM transactions 
                ORDER BY date DESC 
                LIMIT 10
            `).all();
            
            return {
                totalMonthlyRevenue,
                thisMonthRevenue,
                outstanding,
                recentTransactions,
                currentMonth: currentMonthYear
            };
        } catch (error) {
            console.error('Error in getFinancialSummary:', error);
            return {
                totalMonthlyRevenue: 0,
                thisMonthRevenue: 0,
                outstanding: 0,
                recentTransactions: [],
                currentMonth: new Date().toISOString().slice(0, 7)
            };
        }
    },
    
    // Operational expenses functions
    getOperationalExpenses: async function(month, year) {
        try {
            // Check if database is initialized
            if (!db) {
                console.error('❌ Database not initialized in getOperationalExpenses');
                await initDB();
            }
            
            // Check if expenses table exists
            const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'").get([]);
            
            if (!tableCheck) {
                // Table doesn't exist yet
                console.log('⚠️  Expenses table not found, returning empty array');
                return [];
            }
            
            const query = 'SELECT * FROM expenses WHERE month = ? AND year = ? ORDER BY recorded_at DESC';
            const expenses = await db.prepare(query).all([month, year]);
            return expenses;
        } catch (error) {
            console.error('Error getting operational expenses:', error);
            return [];
        }
    },
    
    addOperationalExpense: async function(expenseData) {
        try {
            // Check if database is initialized
            if (!db) {
                console.error('❌ Database not initialized in addOperationalExpense');
                await initDB();
            }
            
            // Check if expenses table exists, create if not
            const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'").get([]);
            
            if (!tableCheck) {
                // Create expenses table
                const createTable = `
                    CREATE TABLE expenses (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category TEXT NOT NULL,
                        description TEXT NOT NULL,
                        amount INTEGER NOT NULL,
                        month INTEGER NOT NULL,
                        year INTEGER NOT NULL,
                        recorded_by TEXT,
                        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                await db.prepare(createTable).run([]);
                console.log('✅ Created expenses table');
            }
            
            const {
                category,
                description,
                amount,
                month,
                year,
                recorded_by = 'telegram_bot'
            } = expenseData;
            
            const query = `
                INSERT INTO expenses (category, description, amount, month, year, recorded_by, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `;
            
            const result = await db.prepare(query).run([category, description, amount, month, year, recorded_by]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error adding operational expense:', error);
            return false;
        }
    }
};
