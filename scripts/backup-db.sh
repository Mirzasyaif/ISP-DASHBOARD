#!/bin/bash

# Backup script for ISP Dashboard database
# To be run via cron: 0 2 * * * /path/to/backup-db.sh

# Configuration
BACKUP_DIR="/home/mirza/backups/isp-dashboard"
DB_PATH="/home/mirza/.openclaw/workspace/isp-dashboard/backend/data/db.json"
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.json"

# Copy database file
cp "$DB_PATH" "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Remove old backups (older than RETENTION_DAYS)
find "$BACKUP_DIR" -name "db_backup_*.json.gz" -mtime +$RETENTION_DAYS -delete

# Log the backup
echo "[$(date)] Backup created: $BACKUP_FILE.gz" >> "$BACKUP_DIR/backup.log"

# Optional: Send notification via Telegram
# Uncomment and configure if you have curl and Telegram bot
# TELEGRAM_TOKEN="YOUR_BOT_TOKEN"
# TELEGRAM_CHAT_ID="YOUR_CHAT_ID"
# BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE.gz" 2>/dev/null || echo "unknown")
# curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
#   -d chat_id="$TELEGRAM_CHAT_ID" \
#   -d text="✅ Database backup created: $BACKUP_FILE.gz ($BACKUP_SIZE bytes)"