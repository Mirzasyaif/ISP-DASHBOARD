#!/bin/bash

# Restore script for ISP Dashboard database

# Configuration
BACKUP_DIR="/home/mirza/backups/isp-dashboard"
DB_PATH="/home/mirza/.openclaw/workspace/isp-dashboard/backend/data/db.json"
RESTORE_FILE="$1"

# Check if backup file is provided
if [ -z "$RESTORE_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/db_backup_*.json.gz 2>/dev/null | awk '{print $9}'
    exit 1
fi

# Check if backup file exists
if [ ! -f "$RESTORE_FILE" ]; then
    echo "Error: Backup file not found: $RESTORE_FILE"
    exit 1
fi

# Create temporary backup of current database
if [ -f "$DB_PATH" ]; then
    CURRENT_BACKUP="/tmp/db_current_backup_$(date +%s).json"
    cp "$DB_PATH" "$CURRENT_BACKUP"
    echo "Current database backed up to: $CURRENT_BACKUP"
fi

# Decompress and restore
gunzip -c "$RESTORE_FILE" > "$DB_PATH"

# Validate JSON
if python3 -m json.tool "$DB_PATH" > /dev/null 2>&1; then
    echo "✅ Database restored successfully from: $RESTORE_FILE"
    echo "Restored file: $DB_PATH"
    echo ""
    echo "Next steps:"
    echo "1. Restart the ISP Dashboard server: pm2 restart isp-dashboard"
    echo "2. Verify the data at: http://localhost:3000"
else
    echo "❌ Error: Restored file is not valid JSON"
    
    # Restore from current backup if available
    if [ -f "$CURRENT_BACKUP" ]; then
        cp "$CURRENT_BACKUP" "$DB_PATH"
        echo "Restored original database from backup"
    fi
    
    exit 1
fi