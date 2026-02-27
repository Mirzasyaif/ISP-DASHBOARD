// Alert Rules for ISP Dashboard Monitoring
// POINT 2: Alert System Implementation

module.exports = {
  // Alert severity levels
  SEVERITY: {
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info'
  },

  // Alert rules configuration
  RULES: {
    // System health rules
    SYSTEM_MEMORY_CRITICAL: {
      name: 'system_memory_critical',
      condition: (healthData) => parseFloat(healthData.system.memory.usedPercent) > 90,
      severity: 'critical',
      message: '🔥 CRITICAL: System memory usage above 90%',
      threshold: 90
    },
    
    SYSTEM_MEMORY_WARNING: {
      name: 'system_memory_warning',
      condition: (healthData) => parseFloat(healthData.system.memory.usedPercent) > 80,
      severity: 'warning',
      message: '⚠️ WARNING: System memory usage above 80%',
      threshold: 80
    },
    
    SYSTEM_CPU_CRITICAL: {
      name: 'system_cpu_critical',
      condition: (healthData) => parseFloat(healthData.system.cpu.loadavg[0]) > 85,
      severity: 'critical',
      message: '🔥 CRITICAL: System CPU load above 85%',
      threshold: 85
    },
    
    SYSTEM_CPU_WARNING: {
      name: 'system_cpu_warning',
      condition: (healthData) => parseFloat(healthData.system.cpu.loadavg[0]) > 70,
      severity: 'warning',
      message: '⚠️ WARNING: System CPU load above 70%',
      threshold: 70
    },

    // ISP Dashboard specific rules
    MIKROTIK_DISCONNECTED: {
      name: 'mikrotik_disconnected',
      condition: (healthData) => healthData.dashboard.mikrotikStatus !== 'OK',
      severity: 'critical',
      message: '🔥 CRITICAL: Mikrotik connection lost',
      details: 'Cannot connect to Mikrotik router. PPPoE monitoring disabled.'
    },
    
    API_FAILURE: {
      name: 'api_failure',
      condition: (healthData) => healthData.dashboard.apiStatus !== 'OK',
      severity: 'critical',
      message: '🔥 CRITICAL: API server not responding',
      details: 'Dashboard API endpoint failed. Check backend service.'
    },
    
    DATABASE_FAILURE: {
      name: 'database_failure',
      condition: (healthData) => healthData.dashboard.databaseStatus !== 'OK',
      severity: 'critical',
      message: '🔥 CRITICAL: Database connection failed',
      details: 'Cannot access customer/payment database.'
    },

    // Payment monitoring rules
    PAYMENT_SYNC_FAILED: {
      name: 'payment_sync_failed',
      condition: (healthData) => healthData.dashboard.paymentSyncStatus === 'FAILED',
      severity: 'warning',
      message: '⚠️ WARNING: Payment sync failed',
      details: 'Payment status not synchronized with Mikrotik users.'
    },
    
    HIGH_UNPAID_COUNT: {
      name: 'high_unpaid_count',
      condition: (stats) => stats.unpaidCount > 10, // More than 10 unpaid users
      severity: 'warning',
      message: (stats) => `⚠️ WARNING: ${stats.unpaidCount} users unpaid`,
      details: 'Consider bulk disconnect operation.'
    },

    // ISP operation rules
    LOW_ACTIVE_USERS: {
      name: 'low_active_users',
      condition: (stats) => stats.activeUsers < 5 && stats.totalUsers > 30,
      severity: 'warning',
      message: (stats) => `⚠️ WARNING: Only ${stats.activeUsers}/${stats.totalUsers} users online`,
      details: 'Potential network issue or maintenance needed.'
    }
  },

  // Evaluate all rules against current health data
  evaluateAll: function(healthData, stats = {}) {
    const alerts = [];
    
    Object.values(this.RULES).forEach(rule => {
      try {
        // Check if rule condition is met
        const conditionMet = rule.condition(healthData || stats);
        
        if (conditionMet) {
          const alert = {
            id: `${rule.name}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            rule: rule.name,
            severity: rule.severity,
            message: typeof rule.message === 'function' ? rule.message(stats) : rule.message,
            details: rule.details || '',
            data: healthData || stats
          };
          
          alerts.push(alert);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    });
    
    return alerts;
  },

  // Format alert for notification
  formatAlert: function(alert) {
    const emoji = {
      critical: '🔥',
      warning: '⚠️',
      info: 'ℹ️'
    }[alert.severity] || 'ℹ️';
    
    return `${emoji} **${alert.severity.toUpperCase()}**: ${alert.message}\n` +
           `📅 ${new Date(alert.timestamp).toLocaleString('id-ID')}\n` +
           (alert.details ? `📝 ${alert.details}\n` : '') +
           `🔗 Health Score: ${alert.data?.overallScore || 'N/A'}`;
  },

  // Check if alert should be suppressed (prevent duplicates)
  shouldSendAlert: function(alert, lastAlertTime, cooldownMinutes = {
    critical: 5,
    warning: 30,
    info: 60
  }) {
    const now = Date.now();
    const cooldownMs = cooldownMinutes[alert.severity] * 60 * 1000;
    
    // Always send if no previous alert
    if (!lastAlertTime) return true;
    
    // Check cooldown period
    const timeSinceLastAlert = now - lastAlertTime;
    return timeSinceLastAlert > cooldownMs;
  }
};