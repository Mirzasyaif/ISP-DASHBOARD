const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
const db = require('../models/db');
const config = require('../config/config').getConfig();
const { parseRupiah, formatRupiah, validatePriceInput } = require('../utils/currencyParser');

let bot = null;
let adminId = null;

// State management untuk user yang sedang dalam proses input manual
const userPaymentStates = {};
const userImportStates = {};
const userExpenseStates = {};

// Function to initialize bot with token and admin ID
function initializeBot(token, admin_id) {
    try {
        bot = new TelegramBot(token, { polling: true });
        adminId = admin_id;
        
        console.log(`Telegram Bot initialized with admin ID: ${adminId}`);
        
        // Global Setup: Register Command Menu
        bot.setMyCommands([
            { command: 'start', description: 'Menu utama bot (Command Centre)' },
            { command: 'keuangan', description: 'Cek laporan pendapatan & profit' },
            { command: 'tagihan', description: 'List client yang belum bayar' },
            { command: 'bayar', description: 'Input pembayaran (Auto-Search)' },
            { command: 'import_clients', description: 'Import data massal' },
            { command: 'set_harga', description: 'Koreksi harga bulanan client' },
            { command: 'catat_keluar', description: 'Catat pengeluaran operasional' },
            { command: 'status', description: 'Status dashboard' },
            { command: 'userinfo', description: 'Informasi user' }
        ]).then(() => {
            console.log('✅ Command menu registered successfully');
        }).catch(err => {
            console.error('❌ Failed to register command menu:', err.message);
        });
        
        // ==========================================
        // COMMAND: /start - Interactive Command Centre
        // ==========================================
        bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            const isAdmin = userId === adminId;
            
            // Get quick stats for the welcome message
            let statsMessage = '';
            try {
                const stats = await db.getStats();
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                statsMessage = `\n\n📊 *Quick Stats:*\n` +
                    `👥 Total Client: ${stats.totalUsers}\n` +
                    `💰 Paid This Month: ${stats.paidThisMonth}\n` +
                    `📅 Period: ${currentMonthYear}`;
            } catch (e) {
                // Ignore stats error
            }
            
            // Main Command Centre Keyboard
            const mainKeyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '💰 Keuangan', callback_data: 'menu_keuangan' },
                            { text: '📋 Tagihan', callback_data: 'menu_tagihan' }
                        ],
                        [
                            { text: '💵 Input Bayar', callback_data: 'menu_bayar' },
                            { text: '👤 Info Client', callback_data: 'menu_client' }
                        ],
                        [
                            { text: '📊 Status', callback_data: 'menu_status' },
                            { text: '⚙️ Settings', callback_data: 'menu_settings' }
                        ],
                        [
                            { text: '❓ Bantuan', callback_data: 'menu_help' }
                        ]
                    ]
                }
            };
            
            const welcomeMessage = 
                `👋 *Selamat Datang di ISP Dashboard Bot!*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━` +
                statsMessage + `\n\n` +
                `🎯 *Pilih menu di bawah ini:*`;
            
            bot.sendMessage(chatId, welcomeMessage, { 
                parse_mode: 'Markdown',
                ...mainKeyboard 
            });
        });

        // ==========================================
        // COMMAND: /ping - Simple test command
        // ==========================================
        bot.onText(/\/ping/, (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, 'Pong! 🏓');
        });

        // ==========================================
 // COMMAND: /bayar [Query] - Advanced payment
// ==========================================
bot.onText(/\/bayar$/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🔎 Silakan ketik nama atau IP untuk pembayaran.\nContoh: /bayar RYUJIE atau /bayar 192.168.1.1`, { parse_mode: 'Markdown' });
});
bot.onText(/\/bayar (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const query = match[1].trim();
            
            try {
                // Step A: Search database for matching users
                const searchResults = await db.searchUsersByNameOrIP(query);
                
                // Step B: Handle search results
                if (searchResults.length === 0) {
                    bot.sendMessage(chatId, `❌ Tidak ditemukan client dengan query "${query}".`);
                    return;
                }
                
                if (searchResults.length === 1) {
                    // Exact match found - proceed to confirmation
                    const user = searchResults[0];
                    await processPaymentConfirmation(chatId, user, msg.from);
                    return;
                }
                
                // Multiple matches found - show inline buttons
                if (searchResults.length > 1) {
                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: []
                        }
                    };
                    
                    // Add buttons for each match (limit to 10 for Telegram limits)
                    const displayResults = searchResults.slice(0, 10);
                    displayResults.forEach((user) => {
                        const buttonText = `${user.pppoe_username} - ${user.ip_address || 'no IP'}`;
                        const callbackData = user.id ? `pay_id_${user.id}` : `select_user:${user.pppoe_username}`;
                        keyboard.reply_markup.inline_keyboard.push([
                            { text: buttonText, callback_data: callbackData }
                        ]);
                    });
                    
                    // Add cancel button
                    keyboard.reply_markup.inline_keyboard.push([
                        { text: '❌ Batalkan', callback_data: 'cancel_payment_search' }
                    ]);
                    
                    bot.sendMessage(chatId,
                        `🔍 Ditemukan ${searchResults.length} pelanggan dengan kata kunci "${query}".\n` +
                        `Pilih salah satu:`,
                        keyboard
                    );
                    return;
                }
            } catch (error) {
                console.error('Payment search error:', error);
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // ==========================================
        // HELPER: Process payment confirmation
        // ==========================================
        async function processPaymentConfirmation(chatId, user, fromUser) {
            const userMonthlyFee = user.monthly_fee || 0;
            const formattedFee = formatRupiah(userMonthlyFee);
            
            if (userMonthlyFee > 0) {
                // Show fee and ask for confirmation
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: `✅ Sesuai (${formattedFee})`, callback_data: `confirm_payment:${user.pppoe_username}:${userMonthlyFee}` }
                            ],
                            [
                                { text: '✏️ Input Manual', callback_data: `manual_payment:${user.pppoe_username}` }
                            ],
                            [
                                { text: '❌ Batal', callback_data: 'cancel_payment' }
                            ]
                        ]
                    }
                };
                
                bot.sendMessage(chatId, 
                    `💰 Tagihan ${user.pppoe_username}\n` +
                    `Jumlah: ${formattedFee}\n` +
                    `Status: ${user.payment_status || 'pending'}\n` +
                    `Terakhir bayar: ${user.last_paid_month || 'belum pernah'}\n\n` +
                    `Konfirmasi pembayaran?`,
                    keyboard
                );
            } else {
                // If monthly_fee not set, request manual input
                userPaymentStates[chatId] = {
                    username: user.pppoe_username,
                    step: 'waiting_amount',
                    userData: user
                };
                
                bot.sendMessage(chatId,
                    `⚠️ Tarif bulanan untuk ${user.pppoe_username} belum di-set.\n\n` +
                    `Silakan masukkan jumlah pembayaran:\n` +
                    `Contoh: "150.000", "150k", atau "Rp150000"\n` +
                    `Gunakan /cancel untuk membatalkan.`
                );
            }
        }

        // ==========================================
        // CALLBACK QUERY HANDLER - ALL BUTTON CLICKS
        // ==========================================
        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            const userId = query.from.id.toString();
            const isAdmin = userId === adminId;
            const msgId = query.message.message_id;
            
            console.log(`[CALLBACK] Data: ${data} | User: ${userId} | Admin: ${isAdmin}`);
            
            // Stop loading spinner
            try {
                await bot.answerCallbackQuery(query.id);
            } catch (e) {}
            
            // ==========================================
            // MENU CALLBACKS
            // ==========================================
            
            // MENU: KEUANGAN
            if (data === 'menu_keuangan') {
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📊 Laporan Keuangan', callback_data: 'action_keuangan' }],
                            [{ text: '💸 Catat Pengeluaran', callback_data: 'action_catat_keluar' }],
                            [{ text: '📈 Estimasi Pendapatan', callback_data: 'action_estimasi' }],
                            [{ text: '« Kembali', callback_data: 'menu_main' }]
                        ]
                    }
                };
                
                await bot.editMessageText(
                    `💰 *Menu Keuangan*\n━━━━━━━━━━━━━━━━━━━━━━\n\nPilih aksi yang diinginkan:`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            // MENU: TAGIHAN
            else if (data === 'menu_tagihan') {
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 List Belum Bayar', callback_data: 'action_tagihan' }],
                            [{ text: '📊 Ringkasan Tagihan', callback_data: 'action_ringkasan_tagihan' }],
                            [{ text: '« Kembali', callback_data: 'menu_main' }]
                        ]
                    }
                };
                
                await bot.editMessageText(
                    `📋 *Menu Tagihan*\n━━━━━━━━━━━━━━━━━━━━━━\n\nPilih aksi yang diinginkan:`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            // MENU: BAYAR
            else if (data === 'menu_bayar') {
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Cari & Bayar', callback_data: 'action_search_bayar' }],
                            [{ text: '✏️ Set Harga Client', callback_data: 'action_set_harga' }],
                            [{ text: '« Kembali', callback_data: 'menu_main' }]
                        ]
                    }
                };
                
                await bot.editMessageText(
                    `💵 *Menu Pembayaran*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `💡 *Format harga:*\n• 150.000 → 150000\n• 150k → 150000\n• 150rb → 150000`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            // MENU: CLIENT
            else if (data === 'menu_client') {
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Cari Client', callback_data: 'action_search_client' }],
                            [{ text: '📥 Import Client', callback_data: 'action_import' }],
                            [{ text: '📋 List Semua Client', callback_data: 'action_list_client' }],
                            [{ text: '« Kembali', callback_data: 'menu_main' }]
                        ]
                    }
                };
                
                await bot.editMessageText(
                    `👤 *Menu Client*\n━━━━━━━━━━━━━━━━━━━━━━\n\nPilih aksi yang diinginkan:`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            // MENU: STATUS
            else if (data === 'menu_status') {
                try {
                    const stats = await db.getStats();
                    const currentMonthYear = new Date().toISOString().slice(0, 7);
                    const allUsers = await db.getAllUsers();
                    
                    let totalMonthlyRevenue = 0;
                    let usersWithFee = 0;
                    allUsers.forEach(user => {
                        if (user.monthly_fee && user.monthly_fee > 0) {
                            totalMonthlyRevenue += user.monthly_fee;
                            usersWithFee++;
                        }
                    });
                    
                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Refresh', callback_data: 'menu_status' }],
                                [{ text: '« Kembali', callback_data: 'menu_main' }]
                            ]
                        }
                    };
                    
                    await bot.editMessageText(
                        `📊 *Dashboard Status*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `📅 Bulan: ${currentMonthYear}\n` +
                        `👥 Total Users: ${stats.totalUsers}\n` +
                        `💰 Paid This Month: ${stats.paidThisMonth}\n` +
                        `💵 Users with Fee: ${usersWithFee}/${stats.totalUsers}\n` +
                        `📈 Est. Revenue: ${formatRupiah(totalMonthlyRevenue)}\n` +
                        `🤖 Bot Status: ✅ Active\n` +
                        `👑 Admin ID: ${adminId || 'Not set'}`,
                        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                    );
                } catch (error) {
                    await bot.editMessageText(`❌ Error: ${error.message}`, { chat_id: chatId, message_id: msgId });
                }
            }
            
            // MENU: SETTINGS (Admin Only)
            else if (data === 'menu_settings') {
                if (!isAdmin) {
                    await bot.answerCallbackQuery(query.id, { text: '⛔ Admin only', show_alert: true });
                    return;
                }
                
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📱 Test Notifikasi', callback_data: 'action_test_notif' }],
                            [{ text: '📊 Bot Status', callback_data: 'action_bot_status' }],
                            [{ text: '« Kembali', callback_data: 'menu_main' }]
                        ]
                    }
                };
                
                await bot.editMessageText(
                    `⚙️ *Menu Settings*\n━━━━━━━━━━━━━━━━━━━━━━\n\n👑 Admin Mode: ✅\n🆔 Your ID: ${userId}\n\nPilih aksi yang diinginkan:`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            // MENU: HELP
            else if (data === 'menu_help') {
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📝 Format Harga', callback_data: 'help_harga' }],
                            [{ text: '📋 Daftar Command', callback_data: 'help_commands' }],
                            [{ text: '« Kembali', callback_data: 'menu_main' }]
                        ]
                    }
                };
                
                await bot.editMessageText(
                    `❓ *Bantuan*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🤖 *ISP Dashboard Bot* membantu Anda mengelola:\n• Pembayaran client\n• Tagihan bulanan\n• Laporan keuangan\n• Data client\n\n💡 Pilih menu untuk info lebih lanjut:`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            // MENU: MAIN (Back to main menu)
            else if (data === 'menu_main') {
                let statsMessage = '';
                try {
                    const stats = await db.getStats();
                    const currentMonthYear = new Date().toISOString().slice(0, 7);
                    statsMessage = `\n\n📊 *Quick Stats:*\n👥 Total Client: ${stats.totalUsers}\n💰 Paid This Month: ${stats.paidThisMonth}\n📅 Period: ${currentMonthYear}`;
                } catch (e) {}
                
                const mainKeyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '💰 Keuangan', callback_data: 'menu_keuangan' },
                                { text: '📋 Tagihan', callback_data: 'menu_tagihan' }
                            ],
                            [
                                { text: '💵 Input Bayar', callback_data: 'menu_bayar' },
                                { text: '👤 Info Client', callback_data: 'menu_client' }
                            ],
                            [
                                { text: '📊 Status', callback_data: 'menu_status' },
                                { text: '⚙️ Settings', callback_data: 'menu_settings' }
                            ],
                            [
                                { text: '❓ Bantuan', callback_data: 'menu_help' }
                            ]
                        ]
                    }
                };
                
                await bot.editMessageText(
                    `👋 *ISP Dashboard Bot*\n━━━━━━━━━━━━━━━━━━━━━━${statsMessage}\n\n🎯 *Pilih menu di bawah ini:*`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainKeyboard }
                );
            }
            
            // ==========================================
            // ACTION CALLBACKS
            // ==========================================
            
            else if (data === 'action_keuangan') {
                await bot.deleteMessage(chatId, msgId);
                await handleKeuanganCommand(chatId);
            }
            
            else if (data === 'action_tagihan') {
                await bot.deleteMessage(chatId, msgId);
                await handleTagihanCommand(chatId);
            }
            
            else if (data === 'action_catat_keluar') {
                await bot.deleteMessage(chatId, msgId);
                if (!isAdmin) {
                    bot.sendMessage(chatId, '❌ Hanya admin yang dapat mencatat pengeluaran.');
                    return;
                }
                bot.sendMessage(chatId,
                    `📝 *Catat Pengeluaran Operasional*\n\n` +
                    `Format: Kategori, Deskripsi, Jumlah\n` +
                    `Contoh:\n` +
                    `"listrik, Bayar PLN Januari, 1.250k"\n\n` +
                    `Kategori: listrik, internet, sewa, gaji, perawatan, lainnya\n` +
                    `Gunakan /cancel untuk membatalkan.`,
                    { parse_mode: 'Markdown' }
                );
                userExpenseStates[chatId] = { step: 'waiting_expense_data' };
            }
            
            else if (data === 'action_estimasi') {
                try {
                    const allUsers = await db.getAllUsers();
                    let totalMonthlyRevenue = 0;
                    let paidRevenue = 0;
                    let pendingRevenue = 0;
                    const currentMonthYear = new Date().toISOString().slice(0, 7);
                    
                    allUsers.forEach(user => {
                        const fee = user.monthly_fee || 0;
                        totalMonthlyRevenue += fee;
                        if (user.last_paid_month === currentMonthYear) {
                            paidRevenue += fee;
                        } else {
                            pendingRevenue += fee;
                        }
                    });
                    
                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [[{ text: '« Kembali', callback_data: 'menu_keuangan' }]]
                        }
                    };
                    
                    await bot.editMessageText(
                        `📈 *Estimasi Pendapatan*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `💰 Potensi: ${formatRupiah(totalMonthlyRevenue)}\n` +
                        `✅ Terbayar: ${formatRupiah(paidRevenue)}\n` +
                        `⏳ Tertunggak: ${formatRupiah(pendingRevenue)}\n\n` +
                        `📊 Collection Rate: ${totalMonthlyRevenue > 0 ? ((paidRevenue/totalMonthlyRevenue)*100).toFixed(1) : 0}%`,
                        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                    );
                } catch (error) {
                    await bot.editMessageText(`❌ Error: ${error.message}`, { chat_id: chatId, message_id: msgId });
                }
            }
            
            else if (data === 'action_ringkasan_tagihan') {
                try {
                    const allUsers = await db.getAllUsers();
                    const currentMonthYear = new Date().toISOString().slice(0, 7);
                    const unpaidUsers = allUsers.filter(user => {
                        if (user.payment_status === 'paid') {
                            return user.last_paid_month !== currentMonthYear;
                        }
                        return user.payment_status === 'pending';
                    });
                    
                    let totalUnpaid = 0;
                    unpaidUsers.forEach(user => {
                        totalUnpaid += user.monthly_fee || 0;
                    });
                    
                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [[{ text: '« Kembali', callback_data: 'menu_tagihan' }]]
                        }
                    };
                    
                    await bot.editMessageText(
                        `📊 *Ringkasan Tagihan*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `📅 Periode: ${currentMonthYear}\n` +
                        `👥 Total Client: ${allUsers.length}\n` +
                        `❌ Belum Bayar: ${unpaidUsers.length}\n` +
                        `💰 Total Tertunggak: ${formatRupiah(totalUnpaid)}\n` +
                        `📊 Rata-rata: ${formatRupiah(unpaidUsers.length > 0 ? Math.round(totalUnpaid/unpaidUsers.length) : 0)}`,
                        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                    );
                } catch (error) {
                    await bot.editMessageText(`❌ Error: ${error.message}`, { chat_id: chatId, message_id: msgId });
                }
            }
            
            else if (data === 'action_search_bayar') {
                await bot.deleteMessage(chatId, msgId);
                bot.sendMessage(chatId,
                    `🔍 *Cari & Bayar*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Ketik: \`/bayar <nama/IP>\`\n` +
                    `Contoh: \`/bayar RYUJIE\`\n        \`/bayar 192.168.1.1\``,
                    { parse_mode: 'Markdown' }
                );
            }
            
            else if (data === 'action_set_harga') {
                await bot.deleteMessage(chatId, msgId);
                bot.sendMessage(chatId,
                    `✏️ *Set Harga Client*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Ketik: \`/set_harga <username> <harga>\`\n` +
                    `Contoh: \`/set_harga RYUJIE 150k\`\n        \`/set_harga RUMAH 200.000\``,
                    { parse_mode: 'Markdown' }
                );
            }
            
            else if (data === 'action_search_client') {
                await bot.deleteMessage(chatId, msgId);
                bot.sendMessage(chatId,
                    `🔍 *Cari Client*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Ketik: \`/userinfo <username>\`\n` +
                    `Contoh: \`/userinfo RYUJIE\``,
                    { parse_mode: 'Markdown' }
                );
            }
            
            else if (data === 'action_import') {
                if (!isAdmin) {
                    await bot.answerCallbackQuery(query.id, { text: '⛔ Admin only', show_alert: true });
                    return;
                }
                await bot.deleteMessage(chatId, msgId);
                bot.sendMessage(chatId,
                    `📥 *Import Data Massal*\n\n` +
                    `Format: Nama, IP, Fee\n` +
                    `Contoh:\n` +
                    `"Budi, 1.1.1.1, 150k"\n` +
                    `"Susi, 2.2.2.2, 200.000"\n\n` +
                    `Kirim data dalam format di atas (satu per baris).\n` +
                    `Gunakan /cancel untuk membatalkan.`,
                    { parse_mode: 'Markdown' }
                );
                userImportStates[chatId] = { step: 'waiting_data' };
            }
            
            else if (data === 'action_list_client') {
                try {
                    const allUsers = await db.getAllUsers();
                    const currentMonthYear = new Date().toISOString().slice(0, 7);
                    
                    let message = `📋 *Daftar Client* (${allUsers.length})\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                    
                    const displayLimit = 15;
                    const usersToDisplay = allUsers.slice(0, displayLimit);
                    
                    usersToDisplay.forEach((user, index) => {
                        const paid = user.last_paid_month === currentMonthYear ? '✅' : '❌';
                        message += `${index + 1}. ${user.pppoe_username} ${paid}\n`;
                    });
                    
                    if (allUsers.length > displayLimit) {
                        message += `\n... dan ${allUsers.length - displayLimit} lainnya`;
                    }
                    
                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [[{ text: '« Kembali', callback_data: 'menu_client' }]]
                        }
                    };
                    
                    await bot.editMessageText(message, { 
                        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard 
                    });
                } catch (error) {
                    await bot.editMessageText(`❌ Error: ${error.message}`, { chat_id: chatId, message_id: msgId });
                }
            }
            
            else if (data === 'action_test_notif') {
                if (!isAdmin) {
                    await bot.answerCallbackQuery(query.id, { text: '⛔ Admin only', show_alert: true });
                    return;
                }
                try {
                    await bot.sendMessage(chatId, '✅ Test notifikasi berhasil diterima!');
                    await bot.answerCallbackQuery(query.id, { text: '✅ Notifikasi terkirim!', show_alert: true });
                } catch (error) {
                    await bot.answerCallbackQuery(query.id, { text: '❌ Gagal: ' + error.message, show_alert: true });
                }
            }
            
            else if (data === 'action_bot_status') {
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [[{ text: '« Kembali', callback_data: 'menu_settings' }]]
                    }
                };
                
                await bot.editMessageText(
                    `📊 *Bot Status*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `🤖 Bot: ✅ Active\n` +
                    `📡 Polling: ${bot ? (bot.isPolling() ? '✅' : '❌') : '❌'}\n` +
                    `👑 Admin ID: ${adminId || 'Not set'}\n` +
                    `🆔 Your ID: ${userId}\n` +
                    `🔐 Admin Mode: ${isAdmin ? '✅' : '❌'}`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            // ==========================================
            // HELP SUB-MENUS
            // ==========================================
            
            else if (data === 'help_harga') {
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [[{ text: '« Kembali', callback_data: 'menu_help' }]]
                    }
                };
                
                await bot.editMessageText(
                    `📝 *Format Input Harga*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Bot mendukung berbagai format:\n\n` +
                    `• 150.000 → 150000\n` +
                    `• 150k → 150000\n` +
                    `• 150K → 150000\n` +
                    `• Rp150000 → 150000\n` +
                    `• 150rb → 150000\n` +
                    `• 1.5jt → 1500000\n\n` +
                    `💡 *Tips:* Gunakan format yang paling nyaman!`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            else if (data === 'help_commands') {
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [[{ text: '« Kembali', callback_data: 'menu_help' }]]
                    }
                };
                
                await bot.editMessageText(
                    `📋 *Daftar Command*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `/start - Menu utama\n` +
                    `/keuangan - Laporan keuangan\n` +
                    `/tagihan - List tagihan\n` +
                    `/bayar <nama> - Input bayar\n` +
                    `/set_harga <nama> <harga>\n` +
                    `/userinfo <nama> - Info client\n` +
                    `/status - Status dashboard\n` +
                    `/import_clients - Import massal\n` +
                    `/catat_keluar - Catat pengeluaran\n` +
                    `/cancel - Batalkan aksi`,
                    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...keyboard }
                );
            }
            
            // ==========================================
            // PAYMENT CALLBACKS
            // ==========================================
            
            else if (data.startsWith('confirm_payment:')) {
                const [, username, amountStr] = data.split(':');
                const amount = parseInt(amountStr);
                const formattedAmount = formatRupiah(amount);
                
                try {
                    const success = await db.updatePayment(username, amount);
                    
                    let replyText;
                    if (success) {
                        replyText = `✅ Pembayaran ${formattedAmount} berhasil diterima untuk ${username}.`;
                        
                        const isAdminUser = query.from.id.toString() === adminId;
                        if (!isAdminUser && adminId) {
                            bot.sendMessage(adminId,
                                `💰 Pembayaran dicatat untuk ${username}\n` +
                                `Oleh: @${query.from.username || 'unknown'}\n` +
                                `Jumlah: ${formattedAmount}\n` +
                                `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
                            );
                        }
                    } else {
                        replyText = `❌ Gagal mencatat pembayaran untuk ${username}. Coba lagi.`;
                    }
                    
                    await bot.editMessageText(replyText, {
                        chat_id: chatId,
                        message_id: msgId,
                        reply_markup: {}
                    });
                } catch (dbError) {
                    console.error('DB Payment Error:', dbError);
                    await bot.editMessageText(`❌ Error: ${dbError.message}`, {
                        chat_id: chatId,
                        message_id: msgId,
                        reply_markup: {}
                    });
                }
            }
            
            else if (data.startsWith('manual_payment:')) {
                const [, username] = data.split(':');
                userPaymentStates[chatId] = { username: username, step: 'waiting_amount' };
                bot.sendMessage(chatId,
                    `💰 Silakan masukkan jumlah pembayaran untuk ${username}:\n` +
                    `Contoh: "150.000", "150k", atau "Rp150000"\n` +
                    `Gunakan /cancel untuk membatalkan.`
                );
            }
            
            else if (data.startsWith('select_user:')) {
                const [, username] = data.split(':');
                const user = await db.getUserByUsername(username);
                if (user) {
                    await processPaymentConfirmation(chatId, user, query.from);
                } else {
                    bot.sendMessage(chatId, `❌ User ${username} tidak ditemukan.`);
                }
            }
            
            else if (data.startsWith('pay_id_')) {
                const clientId = data.replace('pay_id_', '');
                let user;
                if (db.getUserById) {
                    user = await db.getUserById(clientId);
                } else {
                    user = await db.getUserByUsername(clientId);
                }
                if (user) {
                    await processPaymentConfirmation(chatId, user, query.from);
                } else {
                    bot.sendMessage(chatId, `❌ User dengan ID ${clientId} tidak ditemukan.`);
                }
            }
            
            else if (data === 'cancel_payment_search') {
                bot.sendMessage(chatId, '❌ Pencarian pembayaran dibatalkan.');
            }
            
            else if (data === 'cancel_payment') {
                delete userPaymentStates[chatId];
                bot.sendMessage(chatId, '❌ Pembayaran dibatalkan.');
            }
        });

        // ==========================================
        // MESSAGE HANDLER - Manual Input
        // ==========================================
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            
            if (!text) return;
            
            // Handle /cancel command for all states
            if (text.toLowerCase() === '/cancel') {
                if (userPaymentStates[chatId]) {
                    delete userPaymentStates[chatId];
                    bot.sendMessage(chatId, '❌ Pembayaran dibatalkan.');
                } else if (userImportStates[chatId]) {
                    delete userImportStates[chatId];
                    bot.sendMessage(chatId, '❌ Import dibatalkan.');
                } else if (userExpenseStates[chatId]) {
                    delete userExpenseStates[chatId];
                    bot.sendMessage(chatId, '❌ Pencatatan pengeluaran dibatalkan.');
                }
                return;
            }
            
            // Skip jika ini command lain
            if (text.startsWith('/')) return;
            
            // Handle payment input
            if (userPaymentStates[chatId] && userPaymentStates[chatId].step === 'waiting_amount') {
                const state = userPaymentStates[chatId];
                const validation = validatePriceInput(text);
                
                if (!validation.valid) {
                    bot.sendMessage(chatId, 
                        `❌ ${validation.message}\n\n` +
                        `Coba lagi dengan format:\n• 150.000\n• 150k\n• Rp150000\n• 150rb\n` +
                        `Gunakan /cancel untuk membatalkan.`
                    );
                    return;
                }
                
                const amount = validation.amount;
                const username = state.username;
                
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: `✅ Konfirmasi ${formatRupiah(amount)}`, callback_data: `confirm_payment:${username}:${amount}` }],
                            [{ text: '❌ Batalkan', callback_data: 'cancel_payment' }]
                        ]
                    }
                };
                
                bot.sendMessage(chatId,
                    `💰 Konfirmasi Pembayaran\n\nUser: ${username}\nJumlah: ${formatRupiah(amount)}\n\nApakah ini benar?`,
                    keyboard
                );
                
                delete userPaymentStates[chatId];
            }
            
            // Handle import data input
            if (userImportStates[chatId] && userImportStates[chatId].step === 'waiting_data') {
                try {
                    const lines = text.split('\n').filter(line => line.trim());
                    let successCount = 0;
                    let errorCount = 0;
                    let errorMessages = [];
                    
                    for (const line of lines) {
                        try {
                            const parts = line.split(',').map(part => part.trim());
                            if (parts.length < 3) {
                                errorCount++;
                                errorMessages.push(`❌ Format salah: "${line}"`);
                                continue;
                            }
                            
                            const [name, ip, feeText] = parts;
                            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
                            if (!ipRegex.test(ip)) {
                                errorCount++;
                                errorMessages.push(`❌ IP tidak valid: "${ip}"`);
                                continue;
                            }
                            
                            const fee = parseRupiah(feeText);
                            if (fee <= 0) {
                                errorCount++;
                                errorMessages.push(`❌ Fee tidak valid: "${feeText}"`);
                                continue;
                            }
                            
                            const userData = {
                                pppoe_username: name,
                                ip_address: ip,
                                monthly_fee: fee,
                                status: 'active',
                                plan: 'custom',
                                payment_status: 'pending'
                            };
                            
                            const success = await db.createOrUpdateUser(userData);
                            if (success) successCount++;
                            else {
                                errorCount++;
                                errorMessages.push(`❌ Gagal menyimpan: "${name}"`);
                            }
                        } catch (error) {
                            errorCount++;
                            errorMessages.push(`❌ Error parsing: "${line}"`);
                        }
                    }
                    
                    delete userImportStates[chatId];
                    
                    let resultMessage = `📊 Import Selesai\n\n✅ Berhasil: ${successCount}\n❌ Gagal: ${errorCount}\n\n`;
                    if (errorMessages.length > 0) {
                        resultMessage += `Detail Error:\n`;
                        errorMessages.slice(0, 5).forEach(msg => resultMessage += `• ${msg}\n`);
                        if (errorMessages.length > 5) {
                            resultMessage += `... dan ${errorMessages.length - 5} error lainnya.\n`;
                        }
                    }
                    
                    bot.sendMessage(chatId, resultMessage);
                } catch (error) {
                    console.error('Import error:', error);
                    delete userImportStates[chatId];
                    bot.sendMessage(chatId, `❌ Error saat import: ${error.message}`);
                }
            }
            
            // Handle expense input
            if (userExpenseStates[chatId] && userExpenseStates[chatId].step === 'waiting_expense_data') {
                try {
                    const parts = text.split(',').map(part => part.trim());
                    if (parts.length < 3) {
                        bot.sendMessage(chatId, `❌ Format salah. Gunakan: Kategori, Deskripsi, Jumlah\nContoh: "listrik, Bayar PLN Januari, 1.250k"`);
                        return;
                    }
                    
                    const [category, description, amountText] = parts;
                    const validCategories = ['listrik', 'internet', 'sewa', 'gaji', 'perawatan', 'lainnya'];
                    
                    if (!validCategories.includes(category.toLowerCase())) {
                        bot.sendMessage(chatId, `❌ Kategori tidak valid. Pilih salah satu:\n${validCategories.join(', ')}`);
                        return;
                    }
                    
                    const amount = parseRupiah(amountText);
                    if (amount <= 0) {
                        bot.sendMessage(chatId, `❌ Jumlah tidak valid: "${amountText}"`);
                        return;
                    }
                    
                    const expenseData = {
                        category: category.toLowerCase(),
                        description: description,
                        amount: amount,
                        month: new Date().getMonth() + 1,
                        year: new Date().getFullYear(),
                        recorded_by: msg.from.username || 'telegram_bot',
                        recorded_at: new Date().toISOString()
                    };
                    
                    const success = await db.addOperationalExpense(expenseData);
                    delete userExpenseStates[chatId];
                    
                    if (success) {
                        bot.sendMessage(chatId,
                            `✅ Pengeluaran berhasil dicatat\n\n` +
                            `📝 Detail:\nKategori: ${category}\nDeskripsi: ${description}\nJumlah: ${formatRupiah(amount)}\nBulan: ${expenseData.month}/${expenseData.year}\n\n` +
                            `Gunakan /keuangan untuk melihat laporan terkini.`
                        );
                    } else {
                        bot.sendMessage(chatId, `❌ Gagal mencatat pengeluaran.`);
                    }
                } catch (error) {
                    console.error('Expense recording error:', error);
                    delete userExpenseStates[chatId];
                    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
                }
            }
        });

        // ==========================================
        // COMMAND: /set_harga
        // ==========================================
        bot.onText(/\/set_harga$/, async (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, `🔎 Silakan ketik username dan jumlah.\nContoh: /set_harga RYUJIE 150k`, { parse_mode: 'Markdown' });
        });
        bot.onText(/\/set_harga (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const input = match[1].trim();
            const parts = input.split(/\s+/);
            
            if (parts.length < 2) {
                bot.sendMessage(chatId,
                    `❌ Format: /set_harga <username/IP> <jumlah>\n\n` +
                    `Contoh:\n/set_harga RYUJIE 150.000\n/set_harga RUMAH 150k`
                );
                return;
            }
            
            const amountPart = parts.pop();
            const searchTerm = parts.join(' ');
            const validation = validatePriceInput(amountPart);
            
            if (!validation.valid) {
                bot.sendMessage(chatId, `❌ ${validation.message}`);
                return;
            }
            
            const newFee = validation.amount;
            
            try {
                const user = await db.findUserByNameOrIP(searchTerm);
                if (!user) {
                    bot.sendMessage(chatId, `❌ User "${searchTerm}" tidak ditemukan.`);
                    return;
                }
                
                const success = await db.updateUserMonthlyFee(user.pppoe_username, newFee);
                if (success) {
                    bot.sendMessage(chatId, `✅ Tarif untuk ${user.pppoe_username} berhasil diubah.\n\n💰 Tarif baru: ${formatRupiah(newFee)}/bulan`);
                } else {
                    bot.sendMessage(chatId, `❌ Gagal mengubah tarif untuk ${user.pppoe_username}.`);
                }
            } catch (error) {
                console.error('Set harga error:', error);
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // ==========================================
        // COMMAND: /import_clients
        // ==========================================
        bot.onText(/\/import_clients$/, async (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, `🔎 Silakan ketik /import_clients untuk memulai proses import data massal.\nContoh: /import_clients`, { parse_mode: 'Markdown' });
        });
        bot.onText(/\/import_clients/, async (msg) => {
            const chatId = msg.chat.id;
            const isAdmin = msg.from.id.toString() === adminId;
            
            if (!isAdmin) {
                bot.sendMessage(chatId, '❌ Hanya admin yang dapat melakukan import massal.');
                return;
            }
            
            bot.sendMessage(chatId,
                `📥 Import Data Massal\n\n` +
                `Format: Nama, IP, Fee\n` +
                `Contoh:\n"Budi, 1.1.1.1, 150k"\n"Susi, 2.2.2.2, 200.000"\n\n` +
                `Kirim data dalam format di atas (satu per baris).\n` +
                `Gunakan /cancel untuk membatalkan.`
            );
            userImportStates[chatId] = { step: 'waiting_data' };
        });

        // ==========================================
        // COMMAND: /belumbayar
        // ==========================================
        bot.onText(/\/belumbayar$/, async (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, `🔎 Silakan ketik /belumbayar untuk melihat daftar client yang belum bayar.\nContoh: /belumbayar`, { parse_mode: 'Markdown' });
        });
        bot.onText(/\/belumbayar/, async (msg) => {
            const chatId = msg.chat.id;
            await handleTagihanCommand(chatId);
        });

        // ==========================================
        // COMMAND: /status
        // ==========================================
        bot.onText(/\/status$/, async (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, `🔎 Silakan ketik /status untuk melihat status bot.\nContoh: /status`, { parse_mode: 'Markdown' });
        });
        bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            try {
                const stats = await db.getStats();
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                const allUsers = await db.getAllUsers();
                
                let totalMonthlyRevenue = 0;
                let usersWithFee = 0;
                allUsers.forEach(user => {
                    if (user.monthly_fee && user.monthly_fee > 0) {
                        totalMonthlyRevenue += user.monthly_fee;
                        usersWithFee++;
                    }
                });
                
                bot.sendMessage(chatId, 
                    `📊 Dashboard Status:\n` +
                    `📅 Month: ${currentMonthYear}\n` +
                    `👥 Total Users: ${stats.totalUsers}\n` +
                    `💰 Paid This Month: ${stats.paidThisMonth}\n` +
                    `💵 Users with Fee: ${usersWithFee}/${stats.totalUsers}\n` +
                    `📈 Est. Revenue: ${formatRupiah(totalMonthlyRevenue)}\n` +
                    `🤖 Bot Status: ✅ Active\n` +
                    `👑 Admin ID: ${adminId || 'Not set'}`
                );
            } catch (error) {
                bot.sendMessage(chatId, `❌ Error retrieving status: ${error.message}`);
            }
        });

        // ==========================================
        // COMMAND: /userinfo
        // ==========================================
        bot.onText(/\/userinfo$/, async (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, `🔎 Silakan ketik username.\nContoh: /userinfo RYUJIE`, { parse_mode: 'Markdown' });
        });
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
                const feeInfo = user.monthly_fee ? `${formatRupiah(user.monthly_fee)}/bulan` : 'Belum di-set';
                
                bot.sendMessage(chatId,
                    `👤 User Information:\n\n` +
                    `Username: ${user.pppoe_username}\n` +
                    `Plan: ${user.plan || 'Not set'}\n` +
                    `Status: ${user.status || 'active'}\n` +
                    `💰 Tarif Bulanan: ${feeInfo}\n` +
                    `Created: ${new Date(user.created_at).toLocaleDateString('id-ID')}\n` +
                    `Payment Status: ${hasPaid ? '✅ PAID' : '❌ NOT PAID'}\n` +
                    `Last Paid: ${user.last_paid_month || 'Never'}\n\n` +
                    `📝 Perintah:\n/bayar ${user.pppoe_username} - Mark as paid\n/set_harga ${user.pppoe_username} <amount> - Set monthly fee`
                );
            } catch (error) {
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // ==========================================
        // COMMAND: /keuangan
        // ==========================================
        bot.onText(/\/keuangan$/, async (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, `🔎 Silakan ketik /keuangan untuk melihat laporan keuangan.\nContoh: /keuangan`, { parse_mode: 'Markdown' });
        });
        bot.onText(/\/keuangan/, async (msg) => {
            const chatId = msg.chat.id;
            await handleKeuanganCommand(chatId);
        });

        // ==========================================
        // COMMAND: /tagihan
        // ==========================================
        bot.onText(/\/tagihan$/, async (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, `🔎 Silakan ketik /tagihan untuk melihat daftar tagihan.\nContoh: /tagihan`, { parse_mode: 'Markdown' });
        });
        bot.onText(/\/tagihan/, async (msg) => {
            const chatId = msg.chat.id;
            await handleTagihanCommand(chatId);
        });

        // ==========================================
        // COMMAND: /catat_keluar
        // ==========================================
        bot.onText(/\/catat_keluar$/, async (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, `🔎 Silakan ketik /catat_keluar untuk mencatat pengeluaran operasional.\nContoh: /catat_keluar`, { parse_mode: 'Markdown' });
        });
        bot.onText(/\/catat_keluar/, async (msg) => {
            const chatId = msg.chat.id;
            const isAdmin = msg.from.id.toString() === adminId;
            
            if (!isAdmin) {
                bot.sendMessage(chatId, '❌ Hanya admin yang dapat mencatat pengeluaran.');
                return;
            }
            
            bot.sendMessage(chatId,
                `📝 Catat Pengeluaran Operasional\n\n` +
                `Format: Kategori, Deskripsi, Jumlah\n` +
                `Contoh:\n"listrik, Bayar PLN Januari, 1.250k"\n\n` +
                `Kategori: listrik, internet, sewa, gaji, perawatan, lainnya\n` +
                `Gunakan /cancel untuk membatalkan.`
            );
            userExpenseStates[chatId] = { step: 'waiting_expense_data' };
        });

        // ==========================================
        // HELPER FUNCTIONS
        // ==========================================
        
        async function handleKeuanganCommand(chatId) {
            try {
                const allUsers = await db.getAllUsers();
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                const currentMonth = currentMonthYear.slice(5, 7);
                const currentYear = currentMonthYear.slice(0, 4);
                
                let totalMonthlyRevenue = 0;
                let paidThisMonthRevenue = 0;
                let pendingRevenue = 0;
                let totalPaidCount = 0;
                
                allUsers.forEach(user => {
                    const userFee = user.monthly_fee || 0;
                    totalMonthlyRevenue += userFee;
                    if (user.last_paid_month === currentMonthYear) {
                        paidThisMonthRevenue += userFee;
                        totalPaidCount++;
                    } else {
                        pendingRevenue += userFee;
                    }
                });
                
                const expenses = await db.getOperationalExpenses(currentMonth, currentYear);
                const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
                const netProfit = paidThisMonthRevenue - totalExpenses;
                const profitMargin = paidThisMonthRevenue > 0 ? (netProfit / paidThisMonthRevenue * 100).toFixed(1) : 0;
                
                bot.sendMessage(chatId,
                    `📊 Laporan Keuangan ${currentMonthYear}\n\n` +
                    `💰 Pendapatan:\n` +
                    `• Potensi: ${formatRupiah(totalMonthlyRevenue)}/bulan\n` +
                    `• Terbayar: ${formatRupiah(paidThisMonthRevenue)} (${totalPaidCount} user)\n` +
                    `• Tertunggak: ${formatRupiah(pendingRevenue)}\n\n` +
                    `💸 Pengeluaran:\n` +
                    `• Operasional: ${formatRupiah(totalExpenses)}\n\n` +
                    `📈 Profit:\n` +
                    `• Bersih: ${formatRupiah(netProfit)}\n` +
                    `• Margin: ${profitMargin}%\n\n` +
                    `📋 Statistik:\n` +
                    `• Total Client: ${allUsers.length}\n` +
                    `• % Terbayar: ${allUsers.length > 0 ? ((totalPaidCount / allUsers.length) * 100).toFixed(1) : 0}%`
                );
            } catch (error) {
                console.error('Financial report error:', error);
                bot.sendMessage(chatId, `❌ Error mengambil laporan keuangan: ${error.message}`);
            }
        }
        
        async function handleTagihanCommand(chatId) {
            try {
                const allUsers = await db.getAllUsers();
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                
                const unpaidUsers = allUsers.filter(user => {
                    if (user.payment_status === 'paid') {
                        return user.last_paid_month !== currentMonthYear;
                    }
                    return user.payment_status === 'pending';
                });
                
                if (unpaidUsers.length === 0) {
                    bot.sendMessage(chatId, `✅ Semua user telah membayar bulan ini (${currentMonthYear}).`);
                    return;
                }
                
                let message = `📋 Tagihan Tertunggak (${currentMonthYear}):\n\n`;
                
                const feeGroups = {};
                unpaidUsers.forEach(user => {
                    const fee = user.monthly_fee || 0;
                    if (!feeGroups[fee]) feeGroups[fee] = [];
                    feeGroups[fee].push(user.pppoe_username);
                });
                
                let totalUnpaid = 0;
                Object.keys(feeGroups).sort((a, b) => b - a).forEach(fee => {
                    const users = feeGroups[fee];
                    const feeAmount = parseInt(fee);
                    const feeTotal = feeAmount * users.length;
                    totalUnpaid += feeTotal;
                    
                    message += `💰 ${formatRupiah(feeAmount)} (${users.length} user):\n`;
                    users.slice(0, 10).forEach(username => {
                        message += `  • ${username}\n`;
                    });
                    if (users.length > 10) {
                        message += `    ... dan ${users.length - 10} lainnya\n`;
                    }
                    message += `  Total: ${formatRupiah(feeTotal)}\n\n`;
                });
                
                message += `📊 Ringkasan:\n• Total User: ${unpaidUsers.length}\n• Total Tertunggak: ${formatRupiah(totalUnpaid)}\n• Rata-rata/user: ${formatRupiah(Math.round(totalUnpaid / unpaidUsers.length))}`;
                
                bot.sendMessage(chatId, message);
            } catch (error) {
                console.error('Tagihan error:', error);
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        }

        return true;
    } catch (error) {
        console.error('Failed to initialize Telegram bot:', error);
        return false;
    }
}

// Auto-initialize bot if token and admin ID are available in config
if (config.telegram_token && config.telegram_admin_id) {
    console.log('Found Telegram token in config, initializing enhanced bot...');
    const success = initializeBot(config.telegram_token, config.telegram_admin_id);
    if (success) {
        console.log('Telegram enhanced bot auto-initialized successfully');
    } else {
        console.log('Failed to auto-initialize Telegram enhanced bot');
    }
} else {
    console.log('Telegram token or admin ID not found in config. Enhanced bot will not start automatically.');
}

// Initialize Telegram Bot via API endpoint (manual initialization)
router.post('/init', async (req, res) => {
    const { token, admin_id } = req.body;
    
    try {
        const success = initializeBot(token, admin_id);
        if (success) {
            res.json({ success: true, message: 'Telegram Enhanced Bot initialized' });
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
    res.json({
        bot_initialized: !!bot,
        admin_id: adminId,
        polling: bot ? bot.isPolling() : false,
        config: {
            telegram_token: config.telegram_token ? 'set' : 'not set',
            telegram_admin_id: config.telegram_admin_id ? 'set' : 'not set'
        },
        enhanced_features: true,
        smart_price_parsing: true,
        command_centre: true,
        available_commands: [
            '/start - Menu utama (Command Centre)',
            '/keuangan - Cek laporan pendapatan & profit',
            '/tagihan - List client yang belum bayar',
            '/bayar - Input pembayaran (Auto-Search)',
            '/import_clients - Import data massal',
            '/set_harga - Koreksi harga bulanan client',
            '/catat_keluar - Catat pengeluaran operasional',
            '/status - Status dashboard',
            '/userinfo - Informasi user',
            '/belumbayar - Check unpaid users'
        ],
        state_management: {
            payment_states: Object.keys(userPaymentStates).length,
            import_states: Object.keys(userImportStates).length,
            expense_states: Object.keys(userExpenseStates).length
        }
    });
});

// Test endpoint for currency parsing
router.get('/test-currency', (req, res) => {
    const { text } = req.query;
    
    if (!text) {
        return res.status(400).json({ error: 'Text parameter required' });
    }
    
    const validation = validatePriceInput(text);
    const parsed = parseRupiah(text);
    const formatted = formatRupiah(parsed);
    
    res.json({
        input: text,
        validation,
        parsed_amount: parsed,
        formatted: formatted,
        examples: {
            '150.000': parseRupiah('150.000'),
            '150k': parseRupiah('150k'),
            'Rp150000': parseRupiah('Rp150000'),
            '150rb': parseRupiah('150rb')
        }
    });
});

module.exports = router;