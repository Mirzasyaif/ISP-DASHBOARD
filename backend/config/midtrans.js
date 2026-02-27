/**
 * Midtrans Configuration
 * Konfigurasi untuk integrasi payment gateway Midtrans
 */

const crypto = require('crypto');

// Midtrans Configuration
const midtransConfig = {
    serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-XXXXXXXXXXXX',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-XXXXXXXXXXXX',
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    apiBaseUrl: process.env.MIDTRANS_IS_PRODUCTION === 'true' 
        ? 'https://api.midtrans.com' 
        : 'https://api.sandbox.midtrans.com'
};

/**
 * Generate Snap Token untuk pembayaran
 * @param {Object} transactionDetails - Detail transaksi
 * @returns {Promise<string>} Snap Token
 */
async function createSnapToken(transactionDetails) {
    const { orderId, grossAmount, customerDetails, itemDetails } = transactionDetails;
    
    const payload = {
        transaction_details: {
            order_id: orderId,
            gross_amount: grossAmount
        },
        customer_details: customerDetails,
        item_details: itemDetails,
        enabled_payments: ['qris', 'bca_va'],
        callbacks: {
            finish: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment.html?status=success`,
            error: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment.html?status=error`,
            pending: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment.html?status=pending`
        },
        expiry: {
            unit: 'hours',
            duration: 24
        }
    };

    try {
        const response = await fetch(`${midtransConfig.apiBaseUrl}/v2/charge`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(midtransConfig.serverKey + ':').toString('base64')}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error_messages) {
            throw new Error(data.error_messages.join(', '));
        }

        return data.token;
    } catch (error) {
        console.error('Error creating Snap token:', error);
        throw error;
    }
}

/**
 * Cek status transaksi dari Midtrans
 * @param {string} orderId - Order ID transaksi
 * @returns {Promise<Object>} Status transaksi
 */
async function getTransactionStatus(orderId) {
    try {
        const response = await fetch(`${midtransConfig.apiBaseUrl}/v2/${orderId}/status`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(midtransConfig.serverKey + ':').toString('base64')}`
            }
        });

        const data = await response.json();
        
        if (data.error_messages) {
            throw new Error(data.error_messages.join(', '));
        }

        return data;
    } catch (error) {
        console.error('Error getting transaction status:', error);
        throw error;
    }
}

/**
 * Validasi signature webhook dari Midtrans
 * @param {string} orderId - Order ID
 * @param {string} statusCode - Status code
 * @param {string} grossAmount - Jumlah gross
 * @param {string} signatureKey - Signature key dari webhook
 * @returns {boolean} Valid atau tidak
 */
function validateWebhookSignature(orderId, statusCode, grossAmount, signatureKey) {
    const hash = crypto.createHash('sha512')
        .update(orderId + statusCode + grossAmount + midtransConfig.serverKey)
        .digest('hex');
    
    return hash === signatureKey;
}

module.exports = {
    midtransConfig,
    createSnapToken,
    getTransactionStatus,
    validateWebhookSignature
};
