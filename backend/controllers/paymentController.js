const db = require('../models/db');
const { createSnapToken, getTransactionStatus, validateWebhookSignature } = require('../config/midtrans');
const { sendPaymentConfirmation } = require('./whatsappGowaController');

async function checkBill(username) {
    try {
        const user = await db.getClientByUsername(username);
        if (!user) return { success: false, message: 'User tidak ditemukan' };
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const payments = await db.getPaymentsByUserId(user.id);
        const hasPaid = payments.some(p => p.month_year === currentMonthYear && p.status === 'paid');
        
        return {
            success: true,
            user: { id: user.id, username: user.pppoe_username, name: user.full_name || user.name, phone: user.phone_number || user.phone, plan: user.plan, monthly_fee: user.monthly_fee, address: user.address },
            billing: { month_year: currentMonthYear, amount: user.monthly_fee, status: hasPaid ? 'paid' : 'pending', due_date: user.due_date || 'Belum ditetapkan' }
        };
    } catch (error) {
        console.error('Error checking bill:', error);
        return { success: false, message: error.message };
    }
}

async function createPayment(paymentData) {
    try {
        const { username, payment_method } = paymentData;
        const user = await db.getClientByUsername(username);
        if (!user) return { success: false, message: 'User tidak ditemukan' };
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const existingPayment = await db.getPaymentByUserAndMonth(user.id, currentMonthYear);
        if (existingPayment && existingPayment.status === 'paid') {
            return { success: false, message: 'Tagihan bulan ini sudah lunas' };
        }
        
        const orderId = `PAY-${Date.now()}-${user.id}`;
        const grossAmount = user.monthly_fee;
        const customerDetails = { first_name: user.full_name || user.name || user.pppoe_username, last_name: '', email: `${user.pppoe_username}@mahapta.net`, phone: user.phone_number || user.phone || '' };
        const itemDetails = [{ id: user.id, price: grossAmount, quantity: 1, name: `Internet ${user.plan} - ${currentMonthYear}` }];
        
        const snapToken = await createSnapToken({ orderId, grossAmount, customerDetails, itemDetails });
        
        await db.createPaymentTransaction({
            id: Date.now().toString(),
            order_id: orderId,
            user_id: user.id,
            month_year: currentMonthYear,
            amount: grossAmount,
            payment_method: payment_method || 'qris',
            status: 'pending',
            snap_token: snapToken,
            created_at: new Date().toISOString()
        });
        
        return { success: true, snapToken, orderId, clientKey: process.env.MIDTRANS_CLIENT_KEY, amount: grossAmount, user: { name: user.full_name || user.name, username: user.pppoe_username } };
    } catch (error) {
        console.error('Error creating payment:', error);
        return { success: false, message: error.message };
    }
}

async function checkPaymentStatus(orderId) {
    try {
        const midtransStatus = await getTransactionStatus(orderId);
        await db.updatePaymentTransactionStatus(orderId, midtransStatus.transaction_status, new Date().toISOString());
        return { success: true, status: midtransStatus.transaction_status, payment_type: midtransStatus.payment_type, gross_amount: midtransStatus.gross_amount, transaction_time: midtransStatus.transaction_time };
    } catch (error) {
        console.error('Error checking payment status:', error);
        return { success: false, message: error.message };
    }
}

async function handleWebhook(webhookData) {
    try {
        const { order_id, status_code, gross_amount, signature_key, transaction_status } = webhookData;
        const isValid = validateWebhookSignature(order_id, status_code, gross_amount, signature_key);
        if (!isValid) { console.error('Invalid webhook signature'); return { success: false, message: 'Invalid signature' }; }
        
        const transaction = await db.getPaymentTransactionByOrderId(order_id);
        if (!transaction) { console.error('Transaction not found:', order_id); return { success: false, message: 'Transaction not found' }; }
        
        await db.updatePaymentTransactionStatus(order_id, transaction_status, new Date().toISOString());
        
        if (transaction_status === 'settlement' || transaction_status === 'capture') {
            const user = await db.getClientById(transaction.user_id);
            if (user) {
                const existingPayment = await db.getPaymentByUserAndMonth(user.id, transaction.month_year);
                if (existingPayment) {
                    await db.updatePaymentStatus(existingPayment.id, 'paid', new Date().toISOString(), transaction.payment_method);
                } else {
                    await db.createPaymentRecord({
                        id: Date.now().toString(),
                        user_id: user.id,
                        month_year: transaction.month_year,
                        amount: transaction.amount,
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        payment_method: transaction.payment_method
                    });
                }
                await db.updateClientPaymentStatus(user.id, transaction.month_year, 'paid');
                await sendPaymentConfirmation(user, { amount: transaction.amount, month_year: transaction.month_year, payment_method: transaction.payment_method, transaction_id: order_id });
                console.log(`[PAYMENT SUCCESS] Payment confirmed for user ${user.pppoe_username}`);
            }
        }
        return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
        console.error('Error handling webhook:', error);
        return { success: false, message: error.message };
    }
}

module.exports = { checkBill, createPayment, checkPaymentStatus, handleWebhook };
