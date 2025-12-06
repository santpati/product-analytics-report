#!/bin/bash
# =============================================================================
# Deploy Script for Product Analytics Report
# Run this on EC2 to pull latest changes and restart the server
# =============================================================================

set -e  # Exit on any error

APP_DIR="/home/ec2-user/product-analytics-report"
SERVICE_NAME="adoption-tracker"

echo "=========================================="
echo "  🚀 Deploying Product Analytics Report"
echo "=========================================="

# Navigate to app directory
cd "$APP_DIR"

# Pull latest changes from git
echo ""
echo "📥 Pulling latest changes from git..."
git pull origin main

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

