#!/bin/bash
# Restore analytics.db from the most recent backup in analytics-backups/
# Run ON THE EC2 INSTANCE as ec2-user.

set -euo pipefail

APP_DIR="/home/ec2-user/product-analytics-report"
BACKUP_DIR="/home/ec2-user/analytics-backups"
DB_FILE="$APP_DIR/analytics.db"
SERVICE_NAME="adoption-tracker"

cd "$APP_DIR"

LATEST=$(ls -t "$BACKUP_DIR"/analytics_backup_*.db 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  echo "No backup found in $BACKUP_DIR"
  exit 1
fi

echo "Restoring analytics.db from:"
echo "  $LATEST"
cp "$LATEST" "$DB_FILE"

if command -v sqlite3 >/dev/null 2>&1; then
  COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM analytics_events;")
  echo "Events in restored database: $COUNT"
fi

echo "Restarting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"
sleep 2
sudo systemctl is-active "$SERVICE_NAME"
echo "Done. Verify: curl -s http://localhost:8080/api/analytics/stats"
