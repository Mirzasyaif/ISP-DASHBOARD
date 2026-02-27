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
    // Ensure payments table has paid_at, payment_method, and invoice_number columns
    db.exec("ALTER TABLE payments ADD COLUMN paid_at TEXT").catch(() => {});
    db.exec("ALTER TABLE payments ADD COLUMN payment_method TEXT").catch(() => {});
    db.exec("ALTER TABLE payments ADD COLUMN invoice_number TEXT").catch(() => {});
    // Create payment_transactions table if not exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id TEXT PRIMARY KEY,
            order_id TEXT UNIQUE NOT NULL,
            user_id TEXT NOT NULL,
            month_year TEXT NOT NULL,
            amount INTEGER NOT NULL,
            payment_method TEXT,
            status TEXT DEFAULT 'pending',
            snap_token TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES clients(id)
        )
    `).catch(() => {});
    // Create payment_proofs table if not exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_proofs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            phone_number TEXT,
            image_path TEXT,
            ocr_result TEXT,
            validation TEXT,
            status TEXT DEFAULT 'pending_approval',
            message_id TEXT,
            approved_by TEXT,
            amount INTEGER,
            month_year TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES clients(id)
        )
    `).catch(() => {});
    // Add amount and month_year columns if they don't exist
    db.exec("ALTER TABLE payment_proofs ADD COLUMN amount INTEGER").catch(() => {});
    db.exec("ALTER TABLE payment_proofs ADD COLUMN month_year TEXT").catch(() => {});
}

function closeDB() {
    if (db) {
        db.close();
        console.log('✅ Database connection closed');
    }
}

/* ---------- Client Operations ---------- */
async function getAllClients() {
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
    return await db.prepare(query).all([currentMonthYear, currentMonthYear]);
}

async function getClientByUsername(username) {
    // Search by pppoe_username first (exact match)
    const query = 'SELECT * FROM clients WHERE LOWER(pppoe_username) = LOWER(?)';
    let result = await db.prepare(query).get([username]);
    
    // If not found, search by name (case-insensitive)
    if (!result) {
        const nameQuery = 'SELECT * FROM clients WHERE LOWER(name) = LOWER(?)';
        result = await db.prepare(nameQuery).get([username]);
    }
    
    return result;
}

async function getClientById(id) {
    const query = 'SELECT * FROM clients WHERE id = ?';
    return await db.prepare(query).get([id]);
}

/**
 * Helper function to get the 28th day of the current month in YYYY-MM-DD format
 * @returns {string} Date string for the 28th of current month
 */
function getDueDate28th() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-28`;
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
        status = 'active',
        cpe_serial_number,
        cpe_model,
        wifi_ssid,
        wifi_password,
        due_date
    } = clientData;

    const id = Date.now().toString();
    const created_at = new Date().toISOString();
    // Default due date to 28th of current month if not provided
    const clientDueDate = due_date || getDueDate28th();

    const query = `
        INSERT INTO clients (
            id, name, pppoe_username, full_name, address, phone,
            plan, ip_address, monthly_fee, status, created_at, due_date,
            cpe_serial_number, cpe_model, wifi_ssid, wifi_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = db.prepare(query);
    stmt.run([id, pppoe_username, pppoe_username, full_name || null, address || null, phone || null,
        plan, ip_address || null, monthly_fee, status, created_at, clientDueDate,
        cpe_serial_number || null, cpe_model || null, wifi_ssid || null, wifi_password || null]);

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
        created_at,
        due_date: clientDueDate,
        cpe_serial_number,
        cpe_model,
        wifi_ssid,
        wifi_password
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

    // Generate invoice number
    const [year, month] = monthYear.split('-');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${year}${month}-${randomNum}`;

    if (existing) {
        const upd = db.prepare(`
            UPDATE payments 
            SET status = 'paid', paid_at = ?, payment_method = 'telegram', invoice_number = ?
            WHERE id = ?
        `);
        await upd.run([new Date().toISOString(), invoiceNumber, existing.id]);
    } else {
        const ins = db.prepare(`
            INSERT INTO payments (id, user_id, month_year, amount, status, paid_at, payment_method, invoice_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        await ins.run([Date.now().toString(), client.id, monthYear, client.monthly_fee || 0, 'paid',
            new Date().toISOString(), 'telegram', invoiceNumber]);

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

    return { success: true, invoiceNumber };
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

// Payment transactions helpers
async function getPaymentTransactionByOrderId(orderId) {
    const query = 'SELECT * FROM payment_transactions WHERE order_id = ?';
    return await db.prepare(query).get([orderId]);
}

async function createPaymentTransaction(transactionData) {
    const { id, order_id, user_id, month_year, amount, payment_method, status, snap_token, created_at } = transactionData;
    const query = `
        INSERT INTO payment_transactions (id, order_id, user_id, month_year, amount, payment_method, status, snap_token, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.prepare(query).run([id, order_id, user_id, month_year, amount, payment_method, status, snap_token, created_at]);
    return true;
}

async function updatePaymentTransactionStatus(orderId, status, updated_at) {
    const query = 'UPDATE payment_transactions SET status = ?, updated_at = ? WHERE order_id = ?';
    await db.prepare(query).run([status, updated_at, orderId]);
    return true;
}

async function updatePaymentStatus(id, status, paid_at, payment_method) {
    const query = 'UPDATE payments SET status = ?, paid_at = ?, payment_method = ? WHERE id = ?';
    await db.prepare(query).run([status, paid_at, payment_method, id]);
    return true;
}

async function createPaymentRecord(paymentData) {
    const { id, user_id, month_year, amount, status, paid_at, payment_method } = paymentData;
    const query = `
        INSERT INTO payments (id, user_id, month_year, amount, status, paid_at, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await db.prepare(query).run([id, user_id, month_year, amount, status, paid_at, payment_method]);
    return true;
}

async function getPaymentByUserAndMonth(userId, monthYear) {
    const query = 'SELECT * FROM payments WHERE user_id = ? AND month_year = ?';
    return await db.prepare(query).get([userId, monthYear]);
}

async function updateClientPaymentStatus(userId, lastPaidMonth, paymentStatus) {
    const query = 'UPDATE clients SET last_paid_month = ?, payment_status = ? WHERE id = ?';
    await db.prepare(query).run([lastPaidMonth, paymentStatus, userId]);
    return true;
}

// Payment proof operations
async function createPaymentProof(proofData) {
    const { id, user_id, username, month_year, amount, payment_method, proof_image, proof_path, status, created_at } = proofData;
    const query = `
        INSERT INTO payment_proofs (id, user_id, username, month_year, amount, payment_method, proof_image, proof_path, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.prepare(query).run([id, user_id, username, month_year, amount, payment_method, proof_image, proof_path, status, created_at]);
    return true;
}

async function getPaymentProofsByStatus(status) {
    const query = `
        SELECT pp.*, c.full_name, c.phone_number 
        FROM payment_proofs pp
        LEFT JOIN clients c ON pp.user_id = c.id
        WHERE pp.status = ?
        ORDER BY pp.created_at DESC
    `;
    return await db.prepare(query).all([status]);
}

async function getPaymentProofById(id) {
    const query = `
        SELECT pp.*, c.full_name, c.phone_number 
        FROM payment_proofs pp
        LEFT JOIN clients c ON pp.user_id = c.id
        WHERE pp.id = ?
    `;
    return await db.prepare(query).get([id]);
}

async function updatePaymentProofStatus(id, status, approvedBy) {
    const query = 'UPDATE payment_proofs SET status = ?, approved_by = ?, updated_at = ? WHERE id = ?';
    await db.prepare(query).run([status, approvedBy, new Date().toISOString(), id]);
    return true;
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
async function getUserByNameOrIP(searchTerm) {
    const pattern = `%${searchTerm}%`;
    const query = `
        SELECT * FROM clients 
        WHERE pppoe_username LIKE ? 
           OR full_name LIKE ? 
           OR ip_address LIKE ?
        LIMIT 1
    `;
    return await db.prepare(query).get([pattern, pattern, pattern]);
}

async function searchUsersByNameOrIP(searchTerm) {
    const pattern = `%${searchTerm}%`;
    const query = `
        SELECT * FROM clients 
        WHERE LOWER(pppoe_username) LIKE LOWER(?)
           OR LOWER(full_name) LIKE LOWER(?)
           OR ip_address LIKE ?
        ORDER BY pppoe_username
        LIMIT 20
    `;
    return await db.prepare(query).all([pattern, pattern, pattern]);
}

async function updateUserMonthlyFee(username, newFee) {
    const stmt = db.prepare('UPDATE clients SET monthly_fee = ? WHERE pppoe_username = ?');
    const res = await stmt.run([newFee, username]);
    return res.changes > 0;
}

async function updateUserPhoneNumber(userId, phoneNumber) {
    const stmt = db.prepare('UPDATE clients SET phone_number = ?, phone = ? WHERE id = ?');
    const res = await stmt.run([phoneNumber, phoneNumber, userId]);
    return res.changes > 0;
}

async function updateClientGenieACSStatus(userId, deviceId, status) {
    const stmt = db.prepare('UPDATE clients SET genieacs_device_id = ?, genieacs_status = ? WHERE id = ?');
    const res = await stmt.run([deviceId, status, userId]);
    return res.changes > 0;
}

async function updateUserDueDate(userId, dueDate) {
    const stmt = db.prepare('UPDATE clients SET due_date = ? WHERE id = ?');
    const res = await stmt.run([dueDate, userId]);
    return res.changes > 0;
}

async function getUsersForDueDate(dueDate) {
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
    return await db.prepare(query).all([dueDate, currentMonthYear]);
}

/* ---------- User Operations (alias for compatibility) ---------- */
async function getAllUsers() {
    return await getAllClients();
}

async function getUserByUsername(username) {
    return await getClientByUsername(username);
}

async function getUserById(id) {
    return await getClientById(id);
}

async function addUser(userData) {
    return await addClient(userData);
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
    updateClientGenieACSStatus,
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
    // Payment transactions helpers
    getPaymentTransactionByOrderId,
    createPaymentTransaction,
    updatePaymentTransactionStatus,
    updatePaymentStatus,
    createPaymentRecord,
    getPaymentByUserAndMonth,
    updateClientPaymentStatus,
    // Payment proof operations
    createPaymentProof,
    getPaymentProofsByStatus,
    getPaymentProofById,
    updatePaymentProofStatus,
    
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
    },
    
    // Delete payment function
    deletePayment: async function(username, monthYear) {
        try {
            // Check if database is initialized
            if (!db) {
                console.error('❌ Database not initialized in deletePayment');
                await initDB();
            }
            
            // Get the client
            const client = await getClientByUsername(username);
            if (!client) {
                console.error(`❌ Client ${username} not found`);
                return { success: false, message: 'Client not found' };
            }
            
            // If monthYear is not provided, use the last paid month
            if (!monthYear) {
                monthYear = client.last_paid_month;
            }
            
            if (!monthYear) {
                return { success: false, message: 'No payment found to delete' };
            }
            
            // Get the payment record before deleting
            const payment = await db.prepare(`
                SELECT * FROM payments 
                WHERE user_id = ? AND month_year = ?
            `).get([client.id, monthYear]);
            
            if (!payment) {
                return { success: false, message: 'Payment record not found' };
            }
            
            // Delete the payment record
            const deleteResult = await db.prepare(`
                DELETE FROM payments 
                WHERE user_id = ? AND month_year = ?
            `).run([client.id, monthYear]);
            
            if (deleteResult.changes === 0) {
                return { success: false, message: 'Failed to delete payment' };
            }
            
            // Update client's last_paid_month and payment_status
            // Find the most recent payment for this user
            const recentPayment = await db.prepare(`
                SELECT month_year FROM payments 
                WHERE user_id = ? 
                ORDER BY month_year DESC 
                LIMIT 1
            `).get([client.id]);
            
            if (recentPayment) {
                // Update to the most recent payment
                await db.prepare(`
                    UPDATE clients 
                    SET last_paid_month = ?, payment_status = 'paid' 
                    WHERE id = ?
                `).run([recentPayment.month_year, client.id]);
            } else {
                // No more payments, reset to pending
                await db.prepare(`
                    UPDATE clients 
                    SET last_paid_month = NULL, payment_status = 'pending' 
                    WHERE id = ?
                `).run([client.id]);
            }
            
            return { 
                success: true, 
                message: `Payment for ${username} (${monthYear}) deleted successfully`,
                deletedPayment: payment
            };
        } catch (error) {
            console.error('Error deleting payment:', error);
            return { success: false, message: error.message };
        }
    }
};
