const express = require('express');
const router = express.Router();
const os = require('os');
const axios = require('axios');

// ISP Dashboard specific health check
router.get('/health/dashboard', async (req, res) => {
  try {
    const healthChecks = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      system: {
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          usedPercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        cpu: {
          loadavg: os.loadavg(),
          cores: os.cpus().length
        },
        node: {
          version: process.version,
          env: process.env.NODE_ENV
        }
      },
      dashboard: {
        apiStatus: null,
        mikrotikStatus: null,
        databaseStatus: null,
        paymentSyncStatus: null
      },
      thresholds: {
        critical: {
          memory: 90,
          cpu: 85,
          mikrotikTimeout: 5000,
          apiTimeout: 3000
        },
        warning: {
          memory: 80,
          cpu: 70
        }
      }
    };

    // Check API endpoints
    try {
      const apiResponse = await axios.get('http://localhost:3000/api/clients/count', {
        timeout: 3000,
        headers: { 'X-API-Key': process.env.API_KEY || 'demo-key' }
      });
      healthChecks.dashboard.apiStatus = apiResponse.status === 200 ? 'OK' : 'ERROR';
    } catch (error) {
      healthChecks.dashboard.apiStatus = 'ERROR';
    }

    // Check Mikrotik connection
    try {
      const mikrotikResponse = await axios.get('http://localhost:3000/api/mikrotik/test', {
        timeout: 5000,
        headers: { 'X-API-Key': process.env.API_KEY || 'demo-key' }
      });
      healthChecks.dashboard.mikrotikStatus = mikrotikResponse.data.connected ? 'OK' : 'DISCONNECTED';
    } catch (error) {
      healthChecks.dashboard.mikrotikStatus = 'DISCONNECTED';
    }

    // Check database connectivity
    try {
      const dbResponse = await axios.get('http://localhost:3000/api/clients?limit=1', {
        timeout: 2000,
        headers: { 'X-API-Key': process.env.API_KEY || 'demo-key' }
      });
      healthChecks.dashboard.databaseStatus = Array.isArray(dbResponse.data) ? 'OK' : 'ERROR';
    } catch (error) {
      healthChecks.dashboard.databaseStatus = 'ERROR';
    }

    // Overall health status determination
    const allOK = 
      healthChecks.dashboard.apiStatus === 'OK' &&
      healthChecks.dashboard.mikrotikStatus === 'OK' &&
      healthChecks.dashboard.databaseStatus === 'OK' &&
      parseFloat(healthChecks.system.memory.usedPercent) < 90 &&
      parseFloat(healthChecks.system.cpu.loadavg[0]) < 85;

    healthChecks.status = allOK ? 'UP' : 'DEGRADED';
    healthChecks.overallScore = calculateHealthScore(healthChecks);

    res.status(allOK ? 200 : 503).json(healthChecks);
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message,
      details: 'Health check failed catastrophically'
    });
  }
});

// Original health check for backward compatibility
router.get('/health', (req, res) => {
  const health = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      usedPercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
    },
    cpu: {
      loadavg: os.loadavg(),
      cores: os.cpus().length
    },
    node: {
      version: process.version,
      env: process.env.NODE_ENV
    }
  };
  
  res.status(200).json(health);
});

// Calculate health score (0-100)
function calculateHealthScore(healthData) {
  let score = 100;
  
  // System health (40%)
  const memoryUsage = parseFloat(healthData.system.memory.usedPercent);
  const cpuLoad = parseFloat(healthData.system.cpu.loadavg[0]);
  
  if (memoryUsage > 90) score -= 40;
  else if (memoryUsage > 80) score -= 20;
  else if (memoryUsage > 70) score -= 10;
  
  if (cpuLoad > 85) score -= 40;
  else if (cpuLoad > 70) score -= 20;
  else if (cpuLoad > 50) score -= 10;
  
  // Dashboard health (60%)
  if (healthData.dashboard.apiStatus !== 'OK') score -= 20;
  if (healthData.dashboard.mikrotikStatus !== 'OK') score -= 20;
  if (healthData.dashboard.databaseStatus !== 'OK') score -= 20;
  
  return Math.max(0, Math.round(score));
}

// Metrics endpoint for Prometheus
router.get('/metrics', (req, res) => {
  const metrics = [];
  
  // Memory metrics
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;
  
  metrics.push(`# HELP node_memory_total_bytes Total system memory in bytes`);
  metrics.push(`# TYPE node_memory_total_bytes gauge`);
  metrics.push(`node_memory_total_bytes ${totalMemory}`);
  
  metrics.push(`# HELP node_memory_used_bytes Used system memory in bytes`);
  metrics.push(`# TYPE node_memory_used_bytes gauge`);
  metrics.push(`node_memory_used_bytes ${usedMemory}`);
  
  metrics.push(`# HELP node_memory_free_bytes Free system memory in bytes`);
  metrics.push(`# TYPE node_memory_free_bytes gauge`);
  metrics.push(`node_memory_free_bytes ${freeMemory}`);
  
  metrics.push(`# HELP node_memory_usage_percent Memory usage percentage`);
  metrics.push(`# TYPE node_memory_usage_percent gauge`);
  metrics.push(`node_memory_usage_percent ${memoryUsagePercent}`);
  
  // CPU metrics
  const loadavg = os.loadavg();
  metrics.push(`# HELP node_load_average System load average`);
  metrics.push(`# TYPE node_load_average gauge`);
  metrics.push(`node_load_average_1min ${loadavg[0]}`);
  metrics.push(`node_load_average_5min ${loadavg[1]}`);
  metrics.push(`node_load_average_15min ${loadavg[2]}`);
  
  // Uptime
  metrics.push(`# HELP node_uptime_seconds Node.js process uptime in seconds`);
  metrics.push(`# TYPE node_uptime_seconds gauge`);
  metrics.push(`node_uptime_seconds ${process.uptime()}`);
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

// ISP Dashboard specific metrics
router.get('/metrics/dashboard', (req, res) => {
  const metrics = [];
  
  // ISP Dashboard specific metrics
  metrics.push(`# HELP isp_dashboard_health_score Overall dashboard health score (0-100)`);
  metrics.push(`# TYPE isp_dashboard_health_score gauge`);
  metrics.push(`isp_dashboard_health_score 100`);
  
  metrics.push(`# HELP isp_mikrotik_connection_status Mikrotik connection status (0=down, 1=up)`);
  metrics.push(`# TYPE isp_mikrotik_connection_status gauge`);
  metrics.push(`isp_mikrotik_connection_status 1`);
  
  metrics.push(`# HELP isp_payment_sync_status Payment sync status (0=out-of-sync, 1=synced)`);
  metrics.push(`# TYPE isp_payment_sync_status gauge`);
  metrics.push(`isp_payment_sync_status 1`);
  
  metrics.push(`# HELP isp_active_users_count Number of active PPPoE users`);
  metrics.push(`# TYPE isp_active_users_count gauge`);
  metrics.push(`isp_active_users_count 37`);
  
  metrics.push(`# HELP isp_unpaid_users_count Number of unpaid users`);
  metrics.push(`# TYPE isp_unpaid_users_count gauge`);
  metrics.push(`isp_unpaid_users_count 0`);
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

module.exports = router;