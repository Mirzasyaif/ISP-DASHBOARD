// Start Alert Service for ISP Dashboard
// Integration point for monitoring system

const AlertService = require('./alert-service.js');
const express = require('express');
const app = express();
const PORT = process.env.MONITORING_PORT || 3001;

// Simple status endpoint
app.get('/status', (req, res) => {
  const status = AlertService.getStatus();
  res.json({
    service: 'isp-dashboard-alerts',
    status: 'running',
    uptime: process.uptime(),
    ...status
  });
});

// Alert history endpoint
app.get('/history', (req, res) => {
  res.json({
    count: AlertService.alertHistory.length,
    alerts: AlertService.alertHistory.slice(-50) // Last 50 alerts
  });
});

// Manual trigger endpoint
app.post('/check', async (req, res) => {
  try {
    await AlertService.performHealthCheck();
    res.json({ 
      message: 'Manual health check triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server and alert service
async function start() {
  try {
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Alert Service API listening on port ${PORT}`);
    });
    
    // Initialize alert service
    await AlertService.init();
    
    console.log('✅ ISP Dashboard Alert System fully operational');
    console.log(`📊 API: http://localhost:${PORT}/status`);
    
    // Handle graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    console.error('❌ Failed to start Alert Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
function gracefulShutdown() {
  console.log('🛑 Received shutdown signal, stopping alert service...');
  
  AlertService.stop();
  
  setTimeout(() => {
    console.log('👋 Alert Service shutdown complete');
    process.exit(0);
  }, 1000);
}

// Start if run directly
if (require.main === module) {
  start();
}

module.exports = {
  start,
  AlertService,
  app
};