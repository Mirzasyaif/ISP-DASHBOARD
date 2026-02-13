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
            { command: 'keuangan', description: 'Cek laporan pendapatan & profit' },
            { command: 'tagihan', description: 'List client yang belum bayar' },
            { command: 'bayar', description: 'Input pembayaran (Auto-Search)' },
            { command: 'import_clients', description: 'Import data massal' },
            { command: 'set_harga', description: 'Koreksi harga bulanan client' },
            { command: 'catat_keluar', description: 'Catat pengeluaran operasional' },
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
                `👋 Welcome to ISP Dashboard Bot!\n\n` +
                `📋 Pro Commands Menu:\n` +
                `/keuangan - Laporan pendapatan & profit\n` +
                `/tagihan - List client belum bayar\n` +
                `/bayar - Input pembayaran (Auto-Search)\n` +
                `/import_clients - Import data massal\n` +
                `/set_harga - Koreksi harga bulanan\n` +
                `/catat_keluar - Catat pengeluaran\n` +
                `/status - Dashboard status\n` +
                `/userinfo - Informasi user\n` +
                `\n📝 Smart Price Input:\n` +
                `• 150.000 → 150000\n` +
                `• 150k → 150000\n` +
                `• Rp150000 → 150000\n` +
                `• 150rb → 150000`
            );
        });

        // Command: /ping - Simple test command
        bot.onText(/\/ping/, (msg) => {
            const chatId = msg.chat.id;
            bot.sendMessage(chatId, 'Pong! 🏓');
        });

        // Command: /bayar [Query] - Advanced payment with search and inline buttons
        bot.onText(/\/bayar (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const query = match[1].trim();
            
            // Check if admin (or allow anyone for now)
            const isAdmin = msg.from.id.toString() === adminId;
            
            try {
                // Step A: Search database for matching users
                const searchResults = await db.searchUsersByNameOrIP(query);
                
                // Step B: Handle search results
                if (searchResults.length === 0) {
                    bot.sendMessage(chatId, `❌ Tidak ditemukan client dengan query "${query}".`);
                    return;
                }
                
                if (searchResults.length === 1) {
                    // Exact match found - proceed to Step C
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
                        // Use client ID for better identification
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

        // Helper function: Process payment confirmation
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

        // Handle callback queries (button clicks) - FIXED VERSION
        bot.on('callback_query', async (callbackQuery) => {
            const chatId = callbackQuery.message.chat.id;
            const data = callbackQuery.data;
            const fromUser = callbackQuery.from;
            
            try {
                if (data.startsWith('confirm_payment:')) {
                    // 1. Immediate Response (to stop loading loop)
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Memproses pembayaran...' });
                    
                    // Format: confirm_payment:username:amount
                    const [, username, amountStr] = data.split(':');
                    const amount = parseInt(amountStr);
                    const msgId = callbackQuery.message.message_id;
                    const formattedAmount = formatRupiah(amount);
                    
                    try {
                        const success = await db.updatePayment(username, amount);
                        
                        let replyText;
                        if (success) {
                            replyText = `✅ Pembayaran ${formattedAmount} berhasil diterima untuk ${username}.`;
                            
                            // Notify admin if not already admin
                            const isAdmin = callbackQuery.from.id.toString() === adminId;
                            if (!isAdmin && adminId) {
                                bot.sendMessage(adminId,
                                    `💰 Pembayaran dicatat untuk ${username}\n` +
                                    `Oleh: @${callbackQuery.from.username || 'unknown'}\n` +
                                    `Jumlah: ${formattedAmount}\n` +
                                    `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
                                );
                            }
                        } else {
                            replyText = `❌ Gagal mencatat pembayaran untuk ${username}. Coba lagi.`;
                        }
                        
                        // 2. Edit original message to remove buttons and show result
                        await bot.editMessageText(replyText, {
                            chat_id: chatId,
                            message_id: msgId,
                            reply_markup: {} // Remove buttons
                        });
                        
                    } catch (dbError) {
                        console.error('DB Payment Error:', dbError);
                        const errorMsg = `❌ Terjadi error saat menyimpan pembayaran untuk ${username}. Error: ${dbError.message}`;
                        
                        await bot.editMessageText(errorMsg, {
                            chat_id: chatId,
                            message_id: msgId,
                            reply_markup: {} // Remove buttons on error
                        });
                    }
                    
                } else if (data.startsWith('manual_payment:')) {
                    // 1. Immediate Response
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Memulai input manual...' });

                    const [, username] = data.split(':');
                    
                    // Set state untuk input manual
                    userPaymentStates[chatId] = {
                        username: username,
                        step: 'waiting_amount'
                    };
                    
                    bot.sendMessage(chatId,
                        `💰 Silakan masukkan jumlah pembayaran untuk ${username}:\n` +
                        `Contoh: "150.000", "150k", atau "Rp150000"\n` +
                        `Gunakan /cancel untuk membatalkan.`
                    );
                    
                } else if (data.startsWith('select_user:')) {
                    // 1. Immediate Response
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Memilih user...' });

                    const [, username] = data.split(':');
                    
                    // Get user data and show payment confirmation
                    const user = await db.getUserByUsername(username);
                    if (user) {
                        await processPaymentConfirmation(chatId, user, fromUser);
                    } else {
                        bot.sendMessage(chatId, `❌ User ${username} tidak ditemukan.`);
                    }
                    
                } else if (data.startsWith('pay_id_')) {
                    // 1. Immediate Response
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Memilih user via ID...' });

                    const clientId = data.replace('pay_id_', '');
                    
                    // Get user by ID (need to add this function to db)
                    let user;
                    if (db.getUserById) {
                        user = await db.getUserById(clientId);
                    } else {
                        // Fallback: try to get by username if ID is actually username
                        user = await db.getUserByUsername(clientId);
                    }
                    
                    if (user) {
                        await processPaymentConfirmation(chatId, user, fromUser);
                    } else {
                        bot.sendMessage(chatId, `❌ User dengan ID ${clientId} tidak ditemukan.`);
                        // No need to answer again, already answered above
                    }
                    
                } else if (data === 'cancel_payment_search') {
                    // 1. Immediate Response
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Pencarian dibatalkan' });

                    bot.sendMessage(chatId, '❌ Pencarian pembayaran dibatalkan.');
                    
                } else if (data === 'cancel_payment') {
                    // 1. Immediate Response
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Pembayaran dibatalkan' });
                    
                    delete userPaymentStates[chatId];
                    bot.sendMessage(chatId, '❌ Pembayaran dibatalkan.');
                }
            } catch (error) {
                console.error('Callback error:', error);
                bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error terjadi' });
            }
        });

        // Handle manual payment input
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            
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
            if (text.startsWith('/')) {
                return;
            }
            
            // Handle payment input
            if (userPaymentStates[chatId]) {
                const state = userPaymentStates[chatId];
                
                if (state.step === 'waiting_amount') {
                    const validation = validatePriceInput(text);
                    
                    if (!validation.valid) {
                        bot.sendMessage(chatId, 
                            `❌ ${validation.message}\n\n` +
                            `Coba lagi dengan format:\n` +
                            `• 150.000\n` +
                            `• 150k\n` +
                            `• Rp150000\n` +
                            `• 150rb\n` +
                            `Gunakan /cancel untuk membatalkan.`
                        );
                        return;
                    }
                    
                    const amount = validation.amount;
                    const username = state.username;
                    
                    // Tampilkan konfirmasi
                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: `✅ Konfirmasi ${formatRupiah(amount)}`, callback_data: `confirm_payment:${username}:${amount}` }
                                ],
                                [
                                    { text: '❌ Batalkan', callback_data: 'cancel_payment' }
                                ]
                            ]
                        }
                    };
                    
                    bot.sendMessage(chatId,
                        `💰 Konfirmasi Pembayaran\n\n` +
                        `User: ${username}\n` +
                        `Jumlah: ${formatRupiah(amount)}\n\n` +
                        `Apakah ini benar?`,
                        keyboard
                    );
                    
                    // Clear state
                    delete userPaymentStates[chatId];
                }
            }
        });

        // REMOVED DUPLICATE cancel_payment handler - sudah ada di atas

        // Command: /set_harga <username/IP> <amount> - Price correction
        bot.onText(/\/set_harga (.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const input = match[1].trim();
            
            // Split input menjadi searchTerm dan amount
            const parts = input.split(/\s+/);
            if (parts.length < 2) {
                bot.sendMessage(chatId,
                    `❌ Format: /set_harga <username/IP> <jumlah>\n\n` +
                    `Contoh:\n` +
                    `/set_harga RYUJIE 150.000\n` +
                    `/set_harga RUMAH 150k\n` +
                    `/set_harga 192.168.1.100 150rb`
                );
                return;
            }
            
            const amountPart = parts.pop(); // Ambil bagian terakhir sebagai amount
            const searchTerm = parts.join(' '); // Gabungkan sisanya sebagai search term
            
            // Validasi amount
            const validation = validatePriceInput(amountPart);
            if (!validation.valid) {
                bot.sendMessage(chatId, `❌ ${validation.message}`);
                return;
            }
            
            const newFee = validation.amount;
            
            try {
                // Cari user by username atau partial match
                const user = await db.findUserByNameOrIP(searchTerm);
                
                if (!user) {
                    bot.sendMessage(chatId, `❌ User "${searchTerm}" tidak ditemukan.`);
                    return;
                }
                
                // Update monthly fee
                const success = await db.updateUserMonthlyFee(user.pppoe_username, newFee);
                
                if (success) {
                    bot.sendMessage(chatId,
                        `✅ Tarif untuk ${user.pppoe_username} berhasil diubah.\n\n` +
                        `💰 Tarif baru: ${formatRupiah(newFee)}/bulan`
                    );
                    
                    // Notify admin jika bukan admin
                    const isAdmin = msg.from.id.toString() === adminId;
                    if (!isAdmin && adminId) {
                        bot.sendMessage(adminId,
                            `💰 Tarif diubah untuk ${user.pppoe_username}\n` +
                            `Oleh: @${msg.from.username || 'unknown'}\n` +
                            `Jumlah baru: ${formatRupiah(newFee)}/bulan\n` +
                            `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
                        );
                    }
                } else {
                    bot.sendMessage(chatId, `❌ Gagal mengubah tarif untuk ${user.pppoe_username}.`);
                }
            } catch (error) {
                console.error('Set harga error:', error);
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // Command: /import_clients - Bulk import with smart price parsing
        bot.onText(/\/import_clients/, async (msg) => {
            const chatId = msg.chat.id;
            
            // Check admin rights
            const isAdmin = msg.from.id.toString() === adminId;
            if (!isAdmin) {
                bot.sendMessage(chatId, '❌ Hanya admin yang dapat melakukan import massal.');
                return;
            }
            
            bot.sendMessage(chatId,
                `📥 Import Data Massal\n\n` +
                `Format: Nama, IP, Fee\n` +
                `Contoh:\n` +
                `"Budi, 1.1.1.1, 150k"\n` +
                `"Susi, 2.2.2.2, 200.000"\n` +
                `"Joko, 3.3.3.3, 250rb"\n\n` +
                `Kirim data dalam format di atas (satu per baris).\n` +
                `Gunakan /cancel untuk membatalkan.`
            );
            
            // Set state untuk import
            userImportStates[chatId] = {
                step: 'waiting_data'
            };
        });

        // Handle import data input
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            
            // Skip jika ini command (ditangani oleh handlers lain)
            if (text.startsWith('/')) {
                return;
            }
            
            // Check import state
            if (userImportStates[chatId] && userImportStates[chatId].step === 'waiting_data') {
                if (text.toLowerCase() === '/cancel') {
                    delete userImportStates[chatId];
                    bot.sendMessage(chatId, '❌ Import dibatalkan.');
                    return;
                }
                
                try {
                    const lines = text.split('\n').filter(line => line.trim());
                    let successCount = 0;
                    let errorCount = 0;
                    let errorMessages = [];
                    
                    for (const line of lines) {
                        try {
                            // Parse line: "Name, IP, Fee"
                            const parts = line.split(',').map(part => part.trim());
                            if (parts.length < 3) {
                                errorCount++;
                                errorMessages.push(`❌ Format salah: "${line}"`);
                                continue;
                            }
                            
                            const [name, ip, feeText] = parts;
                            
                            // Validate IP format
                            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
                            if (!ipRegex.test(ip)) {
                                errorCount++;
                                errorMessages.push(`❌ IP tidak valid: "${ip}"`);
                                continue;
                            }
                            
                            // Parse fee dengan parseRupiah
                            const fee = parseRupiah(feeText);
                            if (fee <= 0) {
                                errorCount++;
                                errorMessages.push(`❌ Fee tidak valid: "${feeText}"`);
                                continue;
                            }
                            
                            // Create or update user in database
                            // Note: Anda perlu menambahkan fungsi ini ke db.js
                            const userData = {
                                pppoe_username: name,
                                ip_address: ip,
                                monthly_fee: fee,
                                status: 'active',
                                plan: 'custom',
                                payment_status: 'pending'
                            };
                            
                            const success = await db.createOrUpdateUser(userData);
                            if (success) {
                                successCount++;
                            } else {
                                errorCount++;
                                errorMessages.push(`❌ Gagal menyimpan: "${name}"`);
                            }
                        } catch (error) {
                            errorCount++;
                            errorMessages.push(`❌ Error parsing: "${line}" - ${error.message}`);
                        }
                    }
                    
                    // Clear import state
                    delete userImportStates[chatId];
                    
                    // Send results
                    let resultMessage = `📊 Import Selesai\n\n`;
                    resultMessage += `✅ Berhasil: ${successCount}\n`;
                    resultMessage += `❌ Gagal: ${errorCount}\n\n`;
                    
                    if (errorMessages.length > 0) {
                        resultMessage += `Detail Error:\n`;
                        // Tampilkan maksimal 5 error untuk menghindari pesan terlalu panjang
                        const displayErrors = errorMessages.slice(0, 5);
                        displayErrors.forEach(msg => resultMessage += `• ${msg}\n`);
                        
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
                        `✅ Semua user telah membayar bulan ini (${currentMonthYear}).`
                    );
                    return;
                }
                
                // Format message dengan informasi tarif
                let message = `📋 User yang belum bayar untuk ${currentMonthYear}:\n\n`;
                
                // Display limited users to avoid message length issues
                const displayLimit = 15;
                const usersToDisplay = unpaidUsers.slice(0, displayLimit);
                
                usersToDisplay.forEach((user, index) => {
                    const feeInfo = user.monthly_fee ? `${formatRupiah(user.monthly_fee)}` : '❓ Belum di-set';
                    message += `${index + 1}. ${user.pppoe_username}\n`;
                    message += `   💰 Tarif: ${feeInfo}\n`;
                    if (user.last_paid_month) {
                        message += `   📅 Terakhir bayar: ${user.last_paid_month}\n`;
                    }
                    message += `\n`;
                });
                
                if (unpaidUsers.length > displayLimit) {
                    message += `... dan ${unpaidUsers.length - displayLimit} user lainnya.`;
                }
                
                message += `\nTotal belum bayar: ${unpaidUsers.length} user`;
                
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
                
                // Calculate total monthly revenue
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
                    `⏰ Pending Payments: ${unpaidCount}\n` +
                    `💵 Users with Fee Set: ${usersWithFee}/${stats.totalUsers}\n` +
                    `📈 Estimated Monthly Revenue: ${formatRupiah(totalMonthlyRevenue)}\n` +
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
                const feeInfo = user.monthly_fee ? `${formatRupiah(user.monthly_fee)}/bulan` : 'Belum di-set';
                
                bot.sendMessage(chatId,
                    `👤 User Information:\n\n` +
                    `Username: ${user.pppoe_username}\n` +
                    `Plan: ${user.plan || 'Not set'}\n` +
                    `Status: ${user.status || 'active'}\n` +
                    `💰 Tarif Bulanan: ${feeInfo}\n` +
                    `Created: ${new Date(user.created_at).toLocaleDateString('id-ID')}\n` +
                    `Payment Status: ${hasPaid ? '✅ PAID' : '❌ NOT PAID'}\n` +
                    `Last Paid: ${user.last_paid_month || 'Never'}\n` +
                    `Secret: ${user.secret || 'Not set'}\n\n` +
                    `📝 Perintah:\n` +
                    `/bayar ${user.pppoe_username} - Mark as paid\n` +
                    `/set_harga ${user.pppoe_username} <amount> - Set monthly fee`
                );
            } catch (error) {
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // Command: /keuangan - Financial report
        bot.onText(/\/keuangan/, async (msg) => {
            const chatId = msg.chat.id;
            
            try {
                const allUsers = await db.getAllUsers();
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                const currentMonth = currentMonthYear.slice(5, 7);
                const currentYear = currentMonthYear.slice(0, 4);
                
                // Calculate financial data
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
                
                // Get operational expenses (you need to implement this in db)
                const expenses = await db.getOperationalExpenses(currentMonth, currentYear);
                const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
                
                // Calculate profit
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
        });

        // Command: /tagihan - List unpaid users (alias for /belumbayar)
        bot.onText(/\/tagihan/, async (msg) => {
            // Delegate to /belumbayar command
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
                        `✅ Semua user telah membayar bulan ini (${currentMonthYear}).`
                    );
                    return;
                }
                
                // Format message dengan informasi tarif
                let message = `📋 Tagihan Tertunggak (${currentMonthYear}):\n\n`;
                
                // Group by fee amount for better overview
                const feeGroups = {};
                unpaidUsers.forEach(user => {
                    const fee = user.monthly_fee || 0;
                    if (!feeGroups[fee]) {
                        feeGroups[fee] = [];
                    }
                    feeGroups[fee].push(user.pppoe_username);
                });
                
                let totalUnpaid = 0;
                Object.keys(feeGroups).sort((a, b) => b - a).forEach(fee => {
                    const users = feeGroups[fee];
                    const feeAmount = parseInt(fee);
                    const feeTotal = feeAmount * users.length;
                    totalUnpaid += feeTotal;
                    
                    message += `💰 ${formatRupiah(feeAmount)} (${users.length} user):\n`;
                    // Limit displayed usernames to avoid message length issues
                    const displayUsers = users.slice(0, 10);
                    displayUsers.forEach(username => {
                        message += `  • ${username}\n`;
                    });
                    
                    if (users.length > 10) {
                        message += `    ... dan ${users.length - 10} lainnya\n`;
                    }
                    
                    message += `  Total: ${formatRupiah(feeTotal)}\n\n`;
                });
                
                message += `📊 Ringkasan:\n`;
                message += `• Total User: ${unpaidUsers.length}\n`;
                message += `• Total Tertunggak: ${formatRupiah(totalUnpaid)}\n`;
                message += `• Rata-rata/user: ${formatRupiah(Math.round(totalUnpaid / unpaidUsers.length))}`;
                
                bot.sendMessage(chatId, message);
                
            } catch (error) {
                console.error('Tagihan error:', error);
                bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // Command: /catat_keluar - Record operational expenses
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
                `Contoh:\n` +
                `"listrik, Bayar PLN Januari, 1.250k"\n` +
                `"internet, Langganan fiber, 2.000.000"\n` +
                `"perawatan, Servis server, 500rb"\n\n` +
                `Kategori: listrik, internet, sewa, gaji, perawatan, lainnya\n` +
                `Kirim data dalam format di atas.\n` +
                `Gunakan /cancel untuk membatalkan.`
            );
            
            // Set state untuk expense input
            userExpenseStates[chatId] = {
                step: 'waiting_expense_data'
            };
        });

        // Handle expense input
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            
            // Skip jika ini command (ditangani oleh handlers lain)
            if (text.startsWith('/')) {
                return;
            }
            
            // Check expense state
            if (userExpenseStates[chatId] && userExpenseStates[chatId].step === 'waiting_expense_data') {
                if (text.toLowerCase() === '/cancel') {
                    delete userExpenseStates[chatId];
                    bot.sendMessage(chatId, '❌ Pencatatan pengeluaran dibatalkan.');
                    return;
                }
                
                try {
                    // Parse expense data
                    const parts = text.split(',').map(part => part.trim());
                    if (parts.length < 3) {
                        bot.sendMessage(chatId,
                            `❌ Format salah. Gunakan: Kategori, Deskripsi, Jumlah\n` +
                            `Contoh: "listrik, Bayar PLN Januari, 1.250k"`
                        );
                        return;
                    }
                    
                    const [category, description, amountText] = parts;
                    
                    // Validate category
                    const validCategories = ['listrik', 'internet', 'sewa', 'gaji', 'perawatan', 'lainnya'];
                    if (!validCategories.includes(category.toLowerCase())) {
                        bot.sendMessage(chatId,
                            `❌ Kategori tidak valid. Pilih salah satu:\n` +
                            validCategories.join(', ')
                        );
                        return;
                    }
                    
                    // Parse amount dengan parseRupiah
                    const amount = parseRupiah(amountText);
                    if (amount <= 0) {
                        bot.sendMessage(chatId, `❌ Jumlah tidak valid: "${amountText}"`);
                        return;
                    }
                    
                    // Record expense (you need to implement this in db)
                    const expenseData = {
                        category: category.toLowerCase(),
                        description: description,
                        amount: amount,
                        month: new Date().getMonth() + 1, // 1-12
                        year: new Date().getFullYear(),
                        recorded_by: msg.from.username || 'telegram_bot',
                        recorded_at: new Date().toISOString()
                    };
                    
                    const success = await db.addOperationalExpense(expenseData);
                    
                    // Clear expense state
                    delete userExpenseStates[chatId];
                    
                    if (success) {
                        bot.sendMessage(chatId,
                            `✅ Pengeluaran berhasil dicatat\n\n` +
                            `📝 Detail:\n` +
                            `Kategori: ${category}\n` +
                            `Deskripsi: ${description}\n` +
                            `Jumlah: ${formatRupiah(amount)}\n` +
                            `Bulan: ${expenseData.month}/${expenseData.year}\n\n` +
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
    const adminId = config.telegram_admin_id;
    
    if (!bot || !adminId) {
        return res.status(400).json({ error: 'Bot not initialized or admin ID not set' });
    }
    
    bot.sendMessage(adminId, text)
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
        pro_ux_upgrade: true,
        available_commands: [
            '/keuangan - Cek laporan pendapatan & profit',
            '/tagihan - List client yang belum bayar',
            '/bayar - Input pembayaran (Auto-Search)',
            '/import_clients - Import data massal',
            '/set_harga - Koreksi harga bulanan client',
            '/catat_keluar - Catat pengeluaran operasional',
            '/start - Menu utama',
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