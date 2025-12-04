#!/bin/bash
# Setup script for Pendo Dashboard Snapshot

echo "Setting up Pendo Dashboard Snapshot tool..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Install Playwright browsers
echo "Installing Playwright browsers..."
playwright install chromium

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy config.example.txt to .env and configure your email settings:"
echo "   cp config.example.txt .env"
echo "   nano .env"
echo ""
echo "2. Test the script manually:"
echo "   source venv/bin/activate"
echo "   python pendo_dashboard_snapshot.py"
echo ""
echo "3. Set up the daily cron job (see README.md for instructions)"

