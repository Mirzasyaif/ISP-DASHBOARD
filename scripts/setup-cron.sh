#!/bin/bash

# Setup cron job for database backup

# Configuration
SCRIPT_PATH="/home/mirza/.openclaw/workspace/isp-dashboard/scripts/backup-db.sh"
CRON_JOB="0 2 * * * $SCRIPT_PATH"

echo "Setting up cron job for ISP Dashboard database backup..."

# Check if cron job already exists
if crontab -l | grep -q "backup-db.sh"; then
    echo "Cron job already exists."
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added: Daily backup at 2:00 AM"
fi

# List current cron jobs
echo ""
echo "Current cron jobs:"
crontab -l

# Create backup directory
BACKUP_DIR="/home/mirza/backups/isp-dashboard"
mkdir -p "$BACKUP_DIR"
echo ""
echo "Backup directory created: $BACKUP_DIR"

# Test backup script manually
echo ""
echo "Testing backup script..."
$SCRIPT_PATH

echo ""
echo "✅ Cron setup complete!"
echo "Backups will run daily at 2:00 AM"
echo "Backup directory: $BACKUP_DIR"
echo "Restore script: ./scripts/restore-db.sh <backup_file>"