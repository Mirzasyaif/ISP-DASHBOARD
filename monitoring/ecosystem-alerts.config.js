module.exports = {
  apps: [{
    name: 'isp-dashboard-alerts',
    script: './start-alerts.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      MONITORING_PORT: 3002,
      API_KEY: process.env.API_KEY || 'demo-key',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID
    },
    env_production: {
      NODE_ENV: 'production',
      MONITORING_PORT: 3002
    },
    error_file: '../logs/alert-service-error.log',
    out_file: '../logs/alert-service-out.log',
    log_file: '../logs/alert-service-combined.log',
    time: true,
    merge_logs: true,
    kill_timeout: 3000,
    listen_timeout: 3000,
    shutdown_with_message: true
  }]
};