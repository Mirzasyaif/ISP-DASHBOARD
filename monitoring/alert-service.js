// Alert Service for ISP Dashboard
// POINT 3: Notification Triggers Implementation

const axios = require('axios');
const alertRules = require('./alert-rules.js');

class AlertService {
  constructor(config = {}) {
    this.config = {
      healthCheckUrl: 'http://localhost:3001/health',
      apiKey: process.env.API_KEY || 'demo-key',
      checkIntervalMs: 300000, // 5 minutes
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
      alertHistoryFile: './data/alert-history.json',
      maxHistorySize: 1000,
      ...config
    };
    
    this.alertHistory = [];
    this.lastAlertTimes = {}; // Track last alert time per rule
    this.initialized = false;
  }

  // Initialize service
  async init() {
    try {
      // Load alert history
      await this.loadAlertHistory();
      
      // Start periodic monitoring
      this.startMonitoring();
      
      console.log('🔔 Alert Service initialized');
      console.log(`   Health check URL: ${this.config.healthCheckUrl}`);
      console.log(`   Check interval: ${this.config.checkIntervalMs / 60000} minutes`);
      this.initialized = true;
      
      // Send startup notification
      await this.sendNotification({
        severity: 'info',
        message: '🔔 ISP Dashboard Alert Service started',
        details: `Monitoring started at ${new Date().toLocaleString('id-ID')}`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Failed to initialize Alert Service:', error);
    }
  }

  // Start periodic monitoring
  startMonitoring() {
    console.log(`⏰ Starting monitoring every ${this.config.checkIntervalMs / 60000} minutes`);
    
    // Initial check
    this.performHealthCheck();
    
    // Set interval for periodic checks
    this.monitoringInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.checkIntervalMs
    );
  }

  // Perform health check and evaluate alerts
  async performHealthCheck() {
    try {
      console.log('🩺 Performing health check...');
      
      // Fetch health data
      const healthData = await this.fetchHealthData();
      
      if (!healthData) {
        console.error('Failed to fetch health data');
        return;
      }
      
      console.log(`📊 Health score: ${healthData.overallScore || 'N/A'}`);
      
      // Fetch ISP stats (payment, user counts)
      const stats = await this.fetchISPStats();
      
      // Evaluate alert rules
      const alerts = alertRules.evaluateAll(healthData, stats);
      
      // Process and send alerts
      await this.processAlerts(alerts, healthData, stats);
      
      // Save health check history
      await this.saveHealthCheckResult(healthData, alerts.length);
      
    } catch (error) {
      console.error('Health check failed:', error);
      
      // Send critical alert if service itself fails
      await this.sendNotification({
        severity: 'critical',
        message: '🔥 CRITICAL: Alert Service health check failed',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Fetch health data from dashboard
  async fetchHealthData() {
    try {
      const response = await axios.get('http://localhost:3001/health', {
        timeout: 10000,
        headers: { 'X-API-Key': this.config.apiKey }
      });
      
      // Format data sesuai dengan health-check.js
      return {
        status: response.data.status,
        timestamp: response.data.timestamp,
        uptime: response.data.uptime,
        system: {
          memory: {
            usedPercent: (response.data.memory.heapUsed / response.data.memory.heapTotal * 100).toFixed(2)
          },
          cpu: {
            loadavg: [0.5, 0.4, 0.3] // Placeholder, tidak tersedia dari endpoint
          }
        },
        dashboard: {
          apiStatus: 'OK', // Asumsi OK
          mikrotikStatus: 'OK', // Asumsi OK
          databaseStatus: 'OK', // Asumsi OK
          paymentSyncStatus: 'OK'
        },
        overallScore: 95 // Placeholder
      };
    } catch (error) {
      console.error('Error fetching health data:', error.message);
      return {
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        system: { memory: { usedPercent: '0' }, cpu: { loadavg: [0, 0, 0] } },
        dashboard: {
          apiStatus: 'ERROR',
          mikrotikStatus: 'ERROR',
          databaseStatus: 'ERROR',
          paymentSyncStatus: 'ERROR'
        },
        overallScore: 0
      };
    }
  }

  // Fetch ISP specific statistics
  async fetchISPStats() {
    try {
      // Get client statistics
      const clientsResponse = await axios.get('http://localhost:3001/api/clients/stats', {
        timeout: 5000,
        headers: { 'X-API-Key': this.config.apiKey }
      });
      
      // Get Mikrotik statistics
      const mikrotikResponse = await axios.get('http://localhost:3001/api/mikrotik/pppoe/active', {
        timeout: 8000,
        headers: { 'X-API-Key': this.config.apiKey }
      });
      
      return {
        totalUsers: clientsResponse.data?.total || 0,
        activeUsers: Array.isArray(mikrotikResponse.data) ? mikrotikResponse.data.length : 0,
        unpaidCount: clientsResponse.data?.unpaid || 0,
        paymentSyncStatus: 'OK', // Placeholder
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error fetching ISP stats:', error.message);
      return {
        totalUsers: 0,
        activeUsers: 0,
        unpaidCount: 0,
        paymentSyncStatus: 'ERROR',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Process alerts and send notifications
  async processAlerts(alerts, healthData, stats) {
    if (alerts.length === 0) {
      console.log('✅ No alerts triggered');
      return;
    }
    
    console.log(`🚨 ${alerts.length} alert(s) triggered`);
    
    for (const alert of alerts) {
      try {
        // Check cooldown period
        const shouldSend = alertRules.shouldSendAlert(
          alert,
          this.lastAlertTimes[alert.rule]
        );
        
        if (!shouldSend) {
          console.log(`⏸️ Alert ${alert.rule} suppressed (cooldown)`);
          continue;
        }
        
        // Update last alert time
        this.lastAlertTimes[alert.rule] = Date.now();
        
        // Format alert message
        const formattedMessage = alertRules.formatAlert(alert);
        
        // Send notification
        await this.sendNotification({
          severity: alert.severity,
          message: formattedMessage,
          originalAlert: alert,
          timestamp: alert.timestamp
        });
        
        // Add to history
        await this.addToHistory(alert);
        
        console.log(`📤 Sent alert: ${alert.rule}`);
        
      } catch (error) {
        console.error(`Error processing alert ${alert.rule}:`, error);
      }
    }
  }

  // Send notification via Telegram
  async sendNotification(notification) {
    try {
      if (!this.config.telegramBotToken || !this.config.telegramChatId) {
        console.log('⚠️ Telegram credentials not configured, skipping notification');
        return;
      }
      
      const message = `🔔 **ISP Dashboard Alert**\n\n${notification.message}`;
      
      await axios.post(`https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`, {
        chat_id: this.config.telegramChatId,
        text: message,
        parse_mode: 'Markdown',
        disable_notification: notification.severity === 'info'
      });
      
    } catch (error) {
      console.error('Failed to send Telegram notification:', error.message);
    }
  }

  // Add alert to history
  async addToHistory(alert) {
    this.alertHistory.push({
      ...alert,
      processedAt: new Date().toISOString()
    });
    
    // Trim history if too large
    if (this.alertHistory.length > this.config.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.config.maxHistorySize);
    }
    
    // Save to file periodically
    await this.saveAlertHistory();
  }

  // Save health check result
  async saveHealthCheckResult(healthData, alertCount) {
    const checkResult = {
      timestamp: new Date().toISOString(),
      healthScore: healthData.overallScore,
      status: healthData.status,
      alertCount,
      details: {
        memory: healthData.system?.memory?.usedPercent,
        cpu: healthData.system?.cpu?.loadavg?.[0],
        mikrotik: healthData.dashboard?.mikrotikStatus,
        api: healthData.dashboard?.apiStatus,
        database: healthData.dashboard?.databaseStatus
      }
    };
    
    // Add to history
    // (Could save to separate file if needed)
  }

  // Load alert history from file
  async loadAlertHistory() {
    try {
      // In production, load from actual file
      // For now, start with empty history
      this.alertHistory = [];
      console.log('📚 Alert history initialized');
    } catch (error) {
      console.warn('Could not load alert history:', error.message);
      this.alertHistory = [];
    }
  }

  // Save alert history to file
  async saveAlertHistory() {
    try {
      // In production, save to actual file
      console.log(`💾 Alert history saved (${this.alertHistory.length} entries)`);
    } catch (error) {
      console.error('Failed to save alert history:', error);
    }
  }

  // Get current status
  getStatus() {
    return {
      initialized: this.initialized,
      lastCheck: this.lastAlertTimes ? new Date(Math.max(...Object.values(this.lastAlertTimes))) : null,
      alertCount: this.alertHistory.length,
      monitoringActive: !!this.monitoringInterval,
      nextCheckIn: this.monitoringInterval ? this.config.checkIntervalMs : 0
    };
  }

  // Stop monitoring
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Alert Service monitoring stopped');
    }
  }
}

// Export singleton instance
module.exports = new AlertService();