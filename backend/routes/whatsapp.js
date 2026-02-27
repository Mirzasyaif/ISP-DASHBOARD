const express = require('express');
const router = express.Router();
const db = require('../models/db-sqlite');
const { authenticateAPI } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappGowaController');

// Get all users with WhatsApp info
router.get('/users', authenticateAPI, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        
        // Format data untuk WhatsApp controller
        const formattedUsers = users.map(user => ({
            id: user.id,
            pppoe_username: user.pppoe_username,
            name: user.name || user.full_name || user.pppoe_username,
            phone_number: user.phone_number || user.phone || null,
            monthly_fee: user.monthly_fee,
            due_date: user.due_date,
            status: user.status,
            category: user.category,
            last_paid_month: user.last_paid_month,
            // WhatsApp status indicator
            whatsapp_ready: !!(user.phone_number || user.phone),
            notification_status: getNotificationStatus(user.due_date)
        }));
        
        res.json({ success: true, users: formattedUsers });
    } catch (error) {
        console.error('[WhatsApp API ERROR] Failed to get users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper untuk menentukan status notifikasi berdasarkan due_date
function getNotificationStatus(dueDate) {
    if (!dueDate) return 'no-due-date';
    
    const today = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 3) return 'ok';
    if (diffDays >= 0) return 'upcoming';
    if (diffDays >= -1) return 'due-today';
    if (diffDays >= -3) return 'overdue-1-3';
    return 'overdue-3+';
}

// Get notification statistics
router.get('/stats', authenticateAPI, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        
        const stats = {
            total_users: users.length,
            users_with_phone: users.filter(u => u.phone_number || u.phone).length,
            users_without_phone: users.filter(u => !u.phone_number && !u.phone).length,
            
            // Status due date
            users_with_due_date: users.filter(u => u.due_date).length,
            users_without_due_date: users.filter(u => !u.due_date).length,
            
            // Notification categories
            upcoming_3_days: users.filter(u => {
                if (!u.due_date) return false;
                const diff = Math.floor((new Date(u.due_date) - new Date()) / (1000 * 60 * 60 * 24));
                return diff >= 0 && diff <= 3;
            }).length,
            
            overdue_users: users.filter(u => {
                if (!u.due_date) return false;
                return new Date(u.due_date) < new Date();
            }).length
        };
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('[WhatsApp API ERROR] Failed to get stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send test notification to a single user
router.post('/send-test', authenticateAPI, async (req, res) => {
    try {
        const { userId, status } = req.body;
        
        if (!userId || !status) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId and status are required' 
            });
        }
        
        // Get user data
        const user = await db.getUserById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        // Validate phone number
        const phone = user.phone_number || user.phone;
        if (!phone) {
            return res.status(400).json({ 
                success: false, 
                error: 'User has no phone number' 
            });
        }
        
        // Validate status
        const validStatuses = ['H-3', 'H-0', 'D+1'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: `Status must be one of: ${validStatuses.join(', ')}` 
            });
        }
        
        console.log(`[WhatsApp API] Sending test notification to ${phone} (status: ${status})`);
        
        // Send notification
        const result = await whatsappController.sendBillingNotification(user, status);
        
        if (result) {
            res.json({ 
                success: true, 
                message: 'Notification sent successfully',
                data: {
                    userId: user.id,
                    username: user.pppoe_username,
                    phone: phone,
                    status: status,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to send notification' 
            });
        }
        
    } catch (error) {
        console.error('[WhatsApp API ERROR] Failed to send test notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user phone number
router.put('/update-phone', authenticateAPI, async (req, res) => {
    try {
        const { userId, phoneNumber } = req.body;
        
        if (!userId || !phoneNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId and phoneNumber are required' 
            });
        }
        
        // Update di database
        const result = await db.updateUserPhoneNumber(userId, phoneNumber);
        
        if (result) {
            res.json({ 
                success: true, 
                message: 'Phone number updated successfully',
                data: {
                    userId,
                    phoneNumber,
                    updated_at: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to update phone number' 
            });
        }
        
    } catch (error) {
        console.error('[WhatsApp API ERROR] Failed to update phone number:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send bulk notifications (for testing)
router.post('/send-bulk-test', authenticateAPI, async (req, res) => {
    try {
        const { status, limit = 5 } = req.body;
        
        if (!status) {
            return res.status(400).json({ 
                success: false, 
                error: 'status is required' 
            });
        }
        
        // Get users with phone numbers
        const users = await db.getAllUsers();
        const usersWithPhone = users.filter(u => u.phone_number || u.phone).slice(0, limit);
        
        if (usersWithPhone.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No users with phone numbers found' 
            });
        }
        
        console.log(`[WhatsApp API] Sending bulk test to ${usersWithPhone.length} users (status: ${status})`);
        
        // Send notifications
        const results = [];
        for (const user of usersWithPhone) {
            try {
                const success = await whatsappController.sendBillingNotification(user, status);
                results.push({
                    userId: user.id,
                    username: user.pppoe_username,
                    phone: user.phone_number || user.phone,
                    success,
                    timestamp: new Date().toISOString()
                });
                
                // Delay sedikit antara pengiriman
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                results.push({
                    userId: user.id,
                    username: user.pppoe_username,
                    phone: user.phone_number || user.phone,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        res.json({ 
            success: true, 
            message: `Bulk test completed: ${successCount} success, ${failCount} failed`,
            results,
            summary: {
                total: results.length,
                success: successCount,
                failed: failCount
            }
        });
        
    } catch (error) {
        console.error('[WhatsApp API ERROR] Failed to send bulk test:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check WhatsApp service status
router.get('/service-status', authenticateAPI, async (req, res) => {
    try {
        const axios = require('axios');
        const GOWA_API_URL = process.env.GOWA_API_URL || 'http://localhost:3000';
        const GOWA_USERNAME = process.env.GOWA_USERNAME || '';
        const GOWA_PASSWORD = process.env.GOWA_PASSWORD || '';
        const GOWA_DEVICE_ID = process.env.GOWA_DEVICE_ID || 'Isp';
        
        let serviceStatus = {
            service: 'GOWA',
            api_url: GOWA_API_URL,
            device_id: GOWA_DEVICE_ID,
            connected: false,
            logged_in: false,
            message: 'Checking GOWA service status...',
            timestamp: new Date().toISOString()
        };
        
        try {
            const headers = {
                'Content-Type': 'application/json',
                'X-Device-Id': GOWA_DEVICE_ID
            };
            
            // Add Basic Auth if credentials are provided
            if (GOWA_USERNAME && GOWA_PASSWORD) {
                const auth = Buffer.from(`${GOWA_USERNAME}:${GOWA_PASSWORD}`).toString('base64');
                headers['Authorization'] = `Basic ${auth}`;
            }
            
            // Check device status
            const response = await axios.get(
                `${GOWA_API_URL}/devices/${GOWA_DEVICE_ID}/status`,
                { headers, timeout: 5000 }
            );
            
            if (response.data && response.data.code === 'SUCCESS') {
                serviceStatus.connected = response.data.results.is_connected;
                serviceStatus.logged_in = response.data.results.is_logged_in;
                serviceStatus.message = serviceStatus.logged_in 
                    ? 'GOWA service is ready and logged in'
                    : 'GOWA service is connected but not logged in';
            } else {
                serviceStatus.message = 'GOWA service returned unexpected response';
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                serviceStatus.message = 'Cannot connect to GOWA API service';
            } else if (error.code === 'ETIMEDOUT') {
                serviceStatus.message = 'Timeout connecting to GOWA API';
            } else if (error.response && error.response.status === 404) {
                serviceStatus.message = 'Device not found in GOWA';
            } else {
                serviceStatus.message = `Error checking GOWA status: ${error.message}`;
            }
        }
        
        res.json({ success: true, status: serviceStatus });
        
    } catch (error) {
        console.error('[WhatsApp API ERROR] Failed to check service status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
