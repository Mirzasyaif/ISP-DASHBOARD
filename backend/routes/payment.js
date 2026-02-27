const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { checkBill, createPayment, checkPaymentStatus, handleWebhook } = require('../controllers/paymentController');

// Setup multer untuk upload file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/payment-proofs';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Hanya file gambar (JPEG, JPG, PNG, GIF) atau PDF yang diperbolehkan'));
        }
    }
});

// Cek tagihan user berdasarkan username
router.get('/bill/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await checkBill(username);
        res.json(result);
    } catch (error) {
        console.error('Error in GET /bill/:username:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Buat payment token
router.post('/create', async (req, res) => {
    try {
        const { username, payment_method } = req.body;
        
        if (!username) {
            return res.status(400).json({ success: false, message: 'Username is required' });
        }
        
        const result = await createPayment({ username, payment_method });
        res.json(result);
    } catch (error) {
        console.error('Error in POST /create:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Cek status pembayaran
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await checkPaymentStatus(orderId);
        res.json(result);
    } catch (error) {
        console.error('Error in GET /status/:orderId:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Upload bukti transfer
router.post('/upload-proof', upload.single('proof_image'), async (req, res) => {
    try {
        const { username, payment_method } = req.body;
        const proofImage = req.file;
        
        if (!username) {
            return res.status(400).json({ success: false, message: 'Username is required' });
        }
        
        if (!proofImage) {
            return res.status(400).json({ success: false, message: 'Bukti transfer is required' });
        }
        
        const db = require('../models/db-sqlite');
        const user = await db.getClientByUsername(username);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        }
        
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const existingPayment = await db.getPaymentByUserAndMonth(user.id, currentMonthYear);
        
        if (existingPayment && existingPayment.status === 'paid') {
            return res.status(400).json({ success: false, message: 'Tagihan bulan ini sudah lunas' });
        }
        
        // Simpan bukti transfer ke database
        const proofData = {
            id: Date.now().toString(),
            user_id: user.id,
            username: username,
            month_year: currentMonthYear,
            amount: user.monthly_fee,
            payment_method: payment_method || 'manual',
            proof_image: proofImage.filename,
            proof_path: proofImage.path,
            status: 'pending_verification',
            created_at: new Date().toISOString()
        };
        
        await db.createPaymentProof(proofData);
        
        console.log(`[PAYMENT PROOF] User ${username} uploaded proof for ${currentMonthYear}`);
        
        res.json({ 
            success: true, 
            message: 'Bukti transfer berhasil diupload. Admin akan memverifikasi pembayaran.',
            proof_id: proofData.id
        });
    } catch (error) {
        console.error('Error in POST /upload-proof:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get payment proofs by status
router.get('/proofs/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const db = require('../models/db-sqlite');
        const proofs = await db.getPaymentProofsByStatus(status);
        res.json({ success: true, proofs });
    } catch (error) {
        console.error('Error in GET /proofs/:status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Approve payment proof
router.post('/approve-proof/:proofId', async (req, res) => {
    try {
        const { proofId } = req.params;
        const db = require('../models/db-sqlite');
        
        const proof = await db.getPaymentProofById(proofId);
        if (!proof) {
            return res.status(404).json({ success: false, message: 'Bukti pembayaran tidak ditemukan' });
        }
        
        // Update proof status
        await db.updatePaymentProofStatus(proofId, 'approved', 'admin');
        
        // Create payment record
        const existingPayment = await db.getPaymentByUserAndMonth(proof.user_id, proof.month_year);
        if (existingPayment) {
            await db.updatePaymentStatus(existingPayment.id, 'paid', new Date().toISOString(), proof.payment_method);
        } else {
            await db.createPaymentRecord({
                id: Date.now().toString(),
                user_id: proof.user_id,
                month_year: proof.month_year,
                amount: proof.amount,
                status: 'paid',
                paid_at: new Date().toISOString(),
                payment_method: proof.payment_method
            });
        }
        
        // Update client payment status
        await db.updateClientPaymentStatus(proof.user_id, proof.month_year, 'paid');
        
        // Send WhatsApp notification (non-blocking)
        const { sendPaymentConfirmation } = require('../controllers/whatsappGowaController');
        const user = await db.getClientById(proof.user_id);
        if (user) {
            // Send notification asynchronously, don't wait for it
            sendPaymentConfirmation(user, {
                amount: proof.amount,
                month_year: proof.month_year,
                payment_method: proof.payment_method,
                transaction_id: proofId
            }).catch(err => {
                console.error(`[WhatsApp ERROR] Failed to send notification:`, err.message);
            });
        }
        
        console.log(`[PAYMENT APPROVED] Proof ${proofId} approved for user ${proof.username}`);
        
        res.json({ success: true, message: 'Pembayaran berhasil disetujui' });
    } catch (error) {
        console.error('Error in POST /approve-proof/:proofId:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reject payment proof
router.post('/reject-proof/:proofId', async (req, res) => {
    try {
        const { proofId } = req.params;
        const db = require('../models/db-sqlite');
        
        const proof = await db.getPaymentProofById(proofId);
        if (!proof) {
            return res.status(404).json({ success: false, message: 'Bukti pembayaran tidak ditemukan' });
        }
        
        // Update proof status
        await db.updatePaymentProofStatus(proofId, 'rejected', 'admin');
        
        console.log(`[PAYMENT REJECTED] Proof ${proofId} rejected for user ${proof.username}`);
        
        res.json({ success: true, message: 'Pembayaran berhasil ditolak' });
    } catch (error) {
        console.error('Error in POST /reject-proof/:proofId:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Webhook dari Midtrans (tanpa authentication)
router.post('/webhook', async (req, res) => {
    try {
        const result = await handleWebhook(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error in POST /webhook:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Serve uploaded files
router.use('/uploads', express.static('uploads'));

module.exports = router;
