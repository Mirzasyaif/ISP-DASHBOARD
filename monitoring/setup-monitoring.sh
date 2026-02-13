#!/bin/bash

# Advanced monitoring setup untuk ISP Dashboard (Phase 5)
# Script ini menginstal dan mengkonfigurasi monitoring + alerting system

set -e

echo "Setting up Advanced Monitoring & Alerting for ISP Dashboard (Phase 5)..."

# Update package list
apt-get update

# Install monitoring tools
apt-get install -y \
    curl \
    jq \
    net-tools \
    htop \
    nethogs \
    iftop \
    iotop \
    dstat \
    sysstat

# Create monitoring directory
mkdir -p /var/log/monitoring

# Create basic monitoring script
cat > /usr/local/bin/monitor-dashboard.sh << 'EOF'
#!/bin/bash
# Basic monitoring script untuk ISP Dashboard

LOGFILE="/var/log/monitoring/dashboard-$(date +%Y-%m-%d).log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOGFILE
}

# Check service status
check_service() {
    SERVICE="$1"
    if systemctl is-active --quiet "$SERVICE"; then
        log "Service $SERVICE: RUNNING"
    else
        log "WARNING: Service $SERVICE: STOPPED"
    fi
}

# Check disk usage
check_disk() {
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 90 ]; then
        log "CRITICAL: Disk usage: ${DISK_USAGE}%"
    elif [ $DISK_USAGE -gt 80 ]; then
        log "WARNING: Disk usage: ${DISK_USAGE}%"
    else
        log "Disk usage: ${DISK_USAGE}% - OK"
    fi
}

# Check memory usage
check_memory() {
    MEM_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}')
    if (( $(echo "$MEM_USAGE > 90" | bc -l) )); then
        log "CRITICAL: Memory usage: ${MEM_USAGE}%"
    elif (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
        log "WARNING: Memory usage: ${MEM_USAGE}%"
    else
        log "Memory usage: ${MEM_USAGE}% - OK"
    fi
}

# Check application health
check_app_health() {
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
        log "Application health: OK"
    else
        log "WARNING: Application health check failed"
    fi
}

# Main monitoring loop
log "=== Starting monitoring cycle ==="
check_service "nginx"
check_service "docker"
check_disk
check_memory
check_app_health
log "=== Monitoring cycle completed ==="
EOF

chmod +x /usr/local/bin/monitor-dashboard.sh

# Create systemd service untuk monitoring
cat > /etc/systemd/system/dashboard-monitor.service << 'EOF'
[Unit]
Description=ISP Dashboard Monitoring Service
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/monitor-dashboard.sh
User=root

[Install]
WantedBy=multi-user.target
EOF

# Create systemd timer untuk menjalankan monitoring setiap 5 menit
cat > /etc/systemd/system/dashboard-monitor.timer << 'EOF'
[Unit]
Description=Run ISP Dashboard Monitoring every 5 minutes

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start the timer
systemctl daemon-reload
systemctl enable dashboard-monitor.timer
systemctl start dashboard-monitor.timer

echo "Monitoring setup completed!"
echo "Monitoring logs: /var/log/monitoring/"
echo "Manual run: /usr/local/bin/monitor-dashboard.sh"
echo "Timer status: systemctl status dashboard-monitor.timer"