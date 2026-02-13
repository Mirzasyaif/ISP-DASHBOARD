const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
const db = require('../models/db');
const dbSQLite = require('../models/db-sqlite');
const envConfig = require('../config/config').getConfig();

let bot = null;
let adminId = null;

// Get Telegram config from database (priority) or env
function getTelegramConfig() {
    try {
        const dbConfig = dbSQLite.getConfig();
        return {
            telegram_token: dbConfig.telegram_token || envConfig.telegram_token || '',
            telegram_admin_id: dbConfig.telegram_admin_id || envConfig.telegram_admin_id || ''
        };
    } catch (error) {
        console.error('Error getting Telegram config from database:', error);
        return {
            telegram_token: envConfig.telegram_token || '',
            telegram_admin_id: envConfig.telegram_admin_id || ''
        };
    }
}

// State management untuk user yang sedang dalam proses input manual
const userPaymentStates = {};

// Function to initialize bot with token and admin ID
function initializeBot(token, admin_id) {
    try {
        bot = new TelegramBot(token, { polling: true });
        adminId = admin_id;
        
        console.log(`Telegram Bot initialized with admin ID: ${adminId}`);
        
        // Global Setup: Register Command Menu
        bot.setMyCommands([
            { command: 'start', description: 'Menu utama bot' },
            { command: 'status', description: 'Status dashboard' },
            { command: 'userinfo', description: 'Informasi user' }
        ]).then(() => {
            console.log('✅ Command menu registered successfully');
        }).catch(err => {
            console.error('❌ Failed to register command menu:', err.message);
        });
        
        // Command: /start
        bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, 
                `Welcome to ISP Dashboard Bot!\n\n` +
                `Available commands:\n` +
                `/ping - Test bot responsiveness\n` +
                `/bayar <username> - Mark user as paid\n` +
                `/belumbayar - Check unpaid users\n` +
                `/status - Check dashboard status\n` +
                `/userinfo <username> - Get user details`
            );
        });

        // Command: /ping - Simple test command
        bot.onText(/\/ping/, (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, 'Pong! 🏓');
        });

        // Command: /bayar <username>
        bot.onText(/\/bayar (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const username = match[1].trim();
            
            // Check if admin (by User ID)
            const userId = msg.from.id.toString();
            const isAdmin = userId === adminId;
            
            if (!isAdmin) {
                console.log(`[ACCESS DENIED] User ID ${userId} bukan Admin! Admin ID: ${adminId}`);
            }
            
            try {
                // Get user from database
                const user = await db.getUserByUsername(username);
                
                if (!user) {
                    bot.sendMessage(chatId, `❌ User ${username} not found. Please check the username.`);
                    return;
                }
                
                // Show confirmation with inline buttons
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ Konfirmasi Pembayaran', callback_data: `confirm_payment:${username}` }
                            ],
                            [
                                { text: '❌ Batal', callback_data: 'cancel_payment' }
                            ]
                        ]
                    }
                };
                
                bot.sendMessage(chatId, 
                    `Konfirmasi pembayaran untuk user:\n\n` +
                    `Username: ${username}\n` +
                    `Name: ${user.name}\n` +
                    `Status: ${user.status || 'active'}\n` +
                    `Last Paid: ${user.last_paid_month || 'Never'}\n\n` +
                    `Apakah Anda yakin ingin menandai sebagai LUNAS?`,
                    keyboard
                );
                
            } catch (error) {
                console.error('Payment error:', error);
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // Command: /belumbayar - Check unpaid users
        bot.onText(/\/belumbayar/, async (msg) => {
            const chatId = msg.chat.id;
            
            try {
                const allUsers = await db.getAllUsers();
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                
                // Find users who haven't paid this month
                const unpaidUsers = allUsers.filter(user => {
                    if (user.payment_status === 'paid') {
                        // Check if payment is for this month
                        return user.last_paid_month !== currentMonthYear;
                    }
                    return user.payment_status === 'pending';
                });
                
                if (unpaidUsers.length === 0) {
                    bot.sendMessage(chatId, 
                        `✅ All users have paid for this month (${currentMonthYear}).`
                    );
                    return;
                }
                
                // Format message
                let message = `📋 Users who haven't paid for ${currentMonthYear}:\n\n`;
                
                // Display limited users to avoid message length issues
                const displayLimit = 20;
                const usersToDisplay = unpaidUsers.slice(0, displayLimit);
                
                usersToDisplay.forEach((user, index) => {
                    message += `${index + 1}. ${user.pppoe_username} (${user.name})\n`;
                    if (user.last_paid_month) {
                        message += `   Last paid: ${user.last_paid_month}\n`;
                    }
                });
                
                if (unpaidUsers.length > displayLimit) {
                    message += `\n... and ${unpaidUsers.length - displayLimit} more users.`;
                }
                
                message += `\n\nTotal unpaid: ${unpaidUsers.length} users`;
                
                bot.sendMessage(chatId, message);
                
                // Send to admin if requested from non-admin
                const isAdmin = msg.from.id.toString() === adminId;
                if (!isAdmin && adminId && unpaidUsers.length > 0) {
                    bot.sendMessage(adminId, 
                        `📋 Unpaid users checked by @${msg.from.username || 'unknown'}\n` +
                        `Total: ${unpaidUsers.length} users\n` +
                        `Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
                    );
                }
            } catch (error) {
                console.error('Unpaid users error:', error);
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // Command: /status
        bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const stats = await db.getStats();
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                
                const allUsers = await db.getAllUsers();
                const unpaidCount = allUsers.filter(user => {
                    if (user.payment_status === 'paid') {
                        return user.last_paid_month !== currentMonthYear;
                    }
                    return user.payment_status === 'pending';
                }).length;
                
                bot.sendMessage(chatId, 
                    `📊 Dashboard Status:\n` +
                    `📅 Month: ${currentMonthYear}\n` +
                    `👥 Total Users: ${stats.totalUsers}\n` +
                    `💰 Paid This Month: ${stats.paidThisMonth}\n` +
                    `⏰ Pending Payments: ${unpaidCount}\n` +
                    `🤖 Bot Status: ✅ Active\n` +
                    `👑 Admin ID: ${adminId || 'Not set'}`
                );
            } catch (error) {
                bot.sendMessage(chatId, `❌ Error retrieving status: ${error.message}`);
            }
        });

        // Command: /userinfo <username>
        bot.onText(/\/userinfo (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const username = match[1].trim();
            
            try {
                const user = await db.getUserByUsername(username);
                
                if (!user) {
                    bot.sendMessage(chatId, `❌ User ${username} not found.`);
                    return;
                }
                
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                const hasPaid = user.last_paid_month === currentMonthYear;
                
                bot.sendMessage(chatId,
                    `👤 User Information:\n\n` +
                    `Username: ${user.pppoe_username}\n` +
                    `Name: ${user.name}\n` +
                    `Phone: ${user.phone}\n` +
                    `Status: ${user.status || 'active'}\n` +
                    `Created: ${new Date(user.created_at).toLocaleDateString('id-ID')}\n` +
                    `Payment Status: ${hasPaid ? '✅ PAID' : '❌ NOT PAID'}\n` +
                    `Last Paid: ${user.last_paid_month || 'Never'}\n` +
                    `Secret: ${user.secret || 'Not set'}`
                );
            } catch (error) {
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // LISTENER TOMBOL - REWRITE VERSION X-RAY
        bot.on('callback_query', async (query) => {
            const { id, data, message, from } = query;
            const userId = String(from.id); // Paksa jadi string
            const adminIdCheck = String(adminId); // Gunakan variabel adminId dari scope module
            const chatId = message.chat.id;

            console.log(`[X-RAY] Klik dari: ${userId} | Admin Config: ${adminIdCheck} | Data: ${data}`);

            // 1. MATIKAN LOADING SPINNER (Wajib Pertama!)
            // Supaya HP user tidak muter terus, apapun yang terjadi.
            try {
                await bot.answerCallbackQuery(id);
            } catch (e) {
                console.log('Info: Spinner stop signal sent.');
            }
            // 2. CEK ADMIN
            if (userId !== adminIdCheck) {
                console.log('⛔ [X-RAY] Akses Ditolak untuk:', userId);
                return bot.sendMessage(chatId, '⛔ Anda bukan Admin!');
            }

            // 3. PROSES DATA (Dengan Log)
            console.log('✅ [X-RAY] Akses Admin Diterima. Memproses data:', data);

            try {
                // LOGIKA TOMBOL
                if (data === 'cancel_payment') {
                    await bot.deleteMessage(chatId, message.message_id);
                    console.log('🗑️ Pesan dihapus');
                } 
                // Cek apakah data diawali 'confirm_payment_' (sesuaikan dengan tombol yg dibuat)
                else if (data.startsWith('confirm_payment:')) { 
                    // ... Masukkan logika update database di sini ...
                    console.log('💾 Melakukan update database untuk:', data);
                    const [, username] = data.split(':');
                    const paymentUpdated = await db.updatePayment(username);
                    if (paymentUpdated) {
                        await bot.editMessageText(`✅ Pembayaran untuk ${username} telah dicatat sebagai LUNAS.`, {
                            chat_id: chatId,
                            message_id: message.message_id,
                            reply_markup: {}
                        });
                        console.log('✅ Pembayaran berhasil dikonfirmasi:', username);
                    } else {
                        await bot.editMessageText(`❌ Gagal mencatat pembayaran untuk ${username}.`, {
                            chat_id: chatId,
                            message_id: message.message_id,
                            reply_markup: {}
                        });
                        console.log('❌ Gagal mengupdate database:', username);
                    }
                } 
                else {
                    console.log('⚠️ [X-RAY] Data tombol tidak dikenali:', data);
                }
            } catch (error) {
                console.error('💥 [X-RAY] Error Internal:', error.message);
                bot.sendMessage(chatId, '❌ Error: ' + error.message);
            }
        });

        // Handle manual payment input (state management)
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            
            // Handle /cancel command
            if (text.toLowerCase() === '/cancel') {
                if (userPaymentStates[chatId]) {
                    delete userPaymentStates[chatId];
                    bot.sendMessage(chatId, '❌ Pembayaran dibatalkan.');
                }
                return;
            }
            
            // Skip jika ini command lain (sudah ditangani oleh onText handlers)
            if (text.startsWith('/')) {
                return;
            }
            
            // Handle payment input states
            if (userPaymentStates[chatId]) {
                // Logic untuk state management (jika diperlukan)
                // Untuk sekarang, abaikan pesan non-command jika dalam state
                console.log(`User ${chatId} in payment state, ignoring message: ${text}`);
            }
        });

        return true;
    } catch (error) {
        console.error('Failed to initialize Telegram bot:', error);
        return false;
    }
}

// Auto-initialize bot if token and admin ID are available in config
const telegramConfig = getTelegramConfig();
if (telegramConfig.telegram_token && telegramConfig.telegram_admin_id) {
    console.log('Found Telegram token in config, initializing bot...');
    const success = initializeBot(telegramConfig.telegram_token, telegramConfig.telegram_admin_id);
    if (success) {
        console.log('Telegram bot auto-initialized successfully');
    } else {
        console.log('Failed to auto-initialize Telegram bot');
    }
} else {
    console.log('Telegram token or admin ID not found in config. Bot will not start automatically.');
}

// Initialize Telegram Bot via API endpoint (manual initialization)
router.post('/init', async (req, res) => {
    const { token, admin_id } = req.body;
    
    try {
        const success = initializeBot(token, admin_id);
        if (success) {
            res.json({ success: true, message: 'Telegram Bot initialized' });
        } else {
            res.status(500).json({ error: 'Failed to initialize bot' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send notification to admin
router.post('/send', (req, res) => {
    const { text } = req.body;
    const config = getTelegramConfig();
    const adminIdToSend = adminId || config.telegram_admin_id;
    
    if (!bot || !adminIdToSend) {
        return res.status(400).json({ error: 'Bot not initialized or admin ID not set' });
    }
    
    bot.sendMessage(adminIdToSend, text)
        .then(() => res.json({ success: true }))
        .catch(error => res.status(500).json({ error: error.message }));
});

// Check bot status
router.get('/status', (req, res) => {
    const config = getTelegramConfig();
    res.json({
        bot_initialized: !!bot,
        admin_id: adminId,
        polling: bot ? bot.isPolling() : false,
        config: {
            telegram_token: config.telegram_token ? 'set' : 'not set',
            telegram_admin_id: config.telegram_admin_id ? 'set' : 'not set'
        }
    });
});

// Test send message endpoint
router.post('/test-send', async (req, res) => {
    const { chat_id, message } = req.body;
    const config = getTelegramConfig();
    
    if (!config.telegram_token) {
        return res.status(400).json({ 
            success: false, 
            error: 'Telegram token not configured. Please save Telegram settings first.' 
        });
    }
    
    if (!chat_id) {
        return res.status(400).json({ 
            success: false, 
            error: 'Chat ID is required' 
        });
    }
    
    try {
        // Use the existing bot or create a temporary one for testing
        const botToUse = bot || new TelegramBot(config.telegram_token, { polling: false });
        
        await botToUse.sendMessage(chat_id, message || 'Test message from ISP Dashboard');
        res.json({ success: true, message: 'Test message sent successfully' });
    } catch (error) {
        console.error('Failed to send test message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;