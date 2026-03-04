#!/bin/bash
# =============================================================================
# Backup Script for Analytics Database
# Creates timestamped backups and maintains last 30 days of backups
# Can be run manually or via cron
# =============================================================================

APP_DIR="/home/ec2-user/product-analytics-report"
BACKUP_DIR="/home/ec2-user/analytics-backups"
DB_FILE="analytics.db"
RETENTION_DAYS=30

cd "$APP_DIR"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "❌ No analytics.db found in $APP_DIR"
    exit 1
fi

# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/analytics_backup_$TIMESTAMP.db"

echo "💾 Backing up analytics database..."
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup created: $BACKUP_FILE ($SIZE)"
    
    # Get record count
    if command -v sqlite3 &> /dev/null; then
        COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM analytics_events;")
        echo "📊 Total events in database: $COUNT"
    fi
    
    # Clean up old backups (keep last 30 days)
    echo ""
    echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "analytics_backup_*.db" -mtime +$RETENTION_DAYS -delete
    
    # Show remaining backups
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/analytics_backup_*.db 2>/dev/null | wc -l)
    echo "📁 Total backups retained: $BACKUP_COUNT"
else
    echo "❌ Backup failed!"
    exit 1
fi
