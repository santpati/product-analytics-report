#!/bin/bash
# =============================================================================
# Initial EC2 Setup Script for Product Analytics Report
# Run this ONCE on a fresh EC2 instance
# =============================================================================

set -e  # Exit on any error

APP_DIR="/home/ec2-user/product-analytics-report"
REPO_URL="https://github.com/santpati/product-analytics-report.git"
SERVICE_NAME="adoption-tracker"

echo "=========================================="
echo "  🔧 Initial EC2 Setup"
echo "=========================================="

# Update system packages
echo ""
echo "📦 Updating system packages..."
sudo yum update -y

# Install Python 3 and Git
echo ""
echo "🐍 Installing Python 3 and Git..."
sudo yum install -y python3 python3-pip git

# Clone the repository
echo ""
echo "📥 Cloning repository..."
if [ -d "$APP_DIR" ]; then
    echo "   Directory exists, pulling latest..."
    cd "$APP_DIR"
    git pull origin main
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Create virtual environment
echo ""
echo "🐍 Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo ""
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create systemd service file
echo ""
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << EOF
[Unit]
Description=Adoption Tracker Dashboard Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin:/usr/bin
ExecStart=$APP_DIR/venv/bin/python3 $APP_DIR/adoption_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
echo ""
echo "🔄 Enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

# Generate initial dashboard
echo ""
echo "📊 Generating initial dashboard..."
python3 refresh_dashboard.py || echo "⚠️  Dashboard refresh failed (API may be unavailable)"

# Check status
sleep 2
echo ""
echo "=========================================="
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    PUBLIC_DNS=$(curl -s http://169.254.169.254/latest/meta-data/public-hostname)
    echo "  ✅ Setup Complete!"
    echo "=========================================="
    echo ""
    echo "  Dashboard URL: http://$PUBLIC_DNS:8080"
    echo ""
    echo "  Useful commands:"
    echo "    • View logs:     sudo journalctl -u $SERVICE_NAME -f"
    echo "    • Restart:       sudo systemctl restart $SERVICE_NAME"
    echo "    • Stop:          sudo systemctl stop $SERVICE_NAME"
    echo "    • Deploy update: ./deploy.sh"
    echo ""
    echo "  ⚠️  Make sure port 8080 is open in your EC2 Security Group!"
    echo ""
else
    echo "  ❌ Service failed to start"
    echo "=========================================="
    echo ""
    echo "  Check logs with: sudo journalctl -u $SERVICE_NAME -n 50"
fi

