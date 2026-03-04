#!/bin/bash
# =============================================================================
# Deploy Script for Product Analytics Report
# Run this on EC2 to pull latest changes and restart the server
# =============================================================================

set -e  # Exit on any error

APP_DIR="/home/ec2-user/product-analytics-report"
SERVICE_NAME="adoption-tracker"
BACKUP_DIR="/home/ec2-user/analytics-backups"
DB_FILE="analytics.db"

echo "=========================================="
echo "  🚀 Deploying Product Analytics Report"
echo "=========================================="

# Navigate to app directory
cd "$APP_DIR"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup analytics database before deployment
echo ""
echo "💾 Backing up analytics database..."
if [ -f "$DB_FILE" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    cp "$DB_FILE" "$BACKUP_DIR/${DB_FILE%.db}_backup_$TIMESTAMP.db"
    cp "$DB_FILE" "/tmp/analytics_deploy_backup.db"
    echo "   ✅ Backup saved to $BACKUP_DIR/${DB_FILE%.db}_backup_$TIMESTAMP.db"
    
    # Keep only last 10 backups to save space
    ls -t "$BACKUP_DIR"/analytics_backup_*.db 2>/dev/null | tail -n +11 | xargs -r rm
else
    echo "   ⚠️  No analytics.db found (first deployment?)"
fi

# Pull latest changes from git
echo ""
echo "📥 Pulling latest changes from git..."
git pull origin main

# Restore analytics database if it was overwritten/deleted
if [ -f "/tmp/analytics_deploy_backup.db" ] && [ ! -f "$DB_FILE" ]; then
    echo ""
    echo "🔄 Restoring analytics database..."
    cp "/tmp/analytics_deploy_backup.db" "$DB_FILE"
    echo "   ✅ Database restored"
fi

# Activate virtual environment
echo ""
echo "🐍 Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies
echo ""
echo "📦 Installing dependencies..."
pip install -r requirements.txt --quiet

# Refresh dashboard data
echo ""
echo "📊 Refreshing dashboard data..."
python3 refresh_dashboard.py || echo "⚠️  Dashboard refresh failed (API may be unavailable)"

# Restart the service
echo ""
echo "🔄 Restarting the server..."
sudo systemctl restart $SERVICE_NAME

# Check status
sleep 2
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    echo ""
    echo "=========================================="
    echo "  ✅ Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "  Dashboard URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-hostname):8080"
    echo ""
else
    echo ""
    echo "❌ Service failed to start. Check logs with:"
    echo "   sudo journalctl -u $SERVICE_NAME -n 50"
fi

