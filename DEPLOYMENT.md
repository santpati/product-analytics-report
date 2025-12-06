# AWS EC2 Deployment Guide

Deploy the Product Analytics Dashboard to your AWS EC2 instance.

---

## Quick Deploy (After Initial Setup)

> **Note:** You need the `Santosh-Demo.pem` SSH key file to access the EC2 instance. Contact **santpati@cisco.com** to obtain this file.

Once your EC2 is set up, use this simple workflow to deploy changes:

### Step 1: Commit and push your local changes

```bash
cd /Users/santpati/Desktop/Folders/AI/git-repo/product-analytics-report
git add .
git commit -m "Your change description"
git push origin main
```

### Step 2: Deploy to AWS (one command)

```bash
ssh -i "Santosh-Demo.pem" ec2-user@ec2-3-236-4-188.compute-1.amazonaws.com "cd product-analytics-report && ./deploy.sh"
```

That's it! ✅ View your dashboard at: **http://ec2-3-236-4-188.compute-1.amazonaws.com:8080**

### Optional: One-Click Deploy Script for Mac

Create a local script for even easier deploys:

```bash
# Create the script (run once)
cat > ~/deploy-to-aws.sh << 'EOF'
#!/bin/bash
cd /Users/santpati/Desktop/Folders/AI/git-repo/product-analytics-report

echo "📤 Pushing to GitHub..."
git add .
git commit -m "${1:-Update dashboard}" 
git push origin main

echo "🚀 Deploying to AWS..."
ssh -i "Santosh-Demo.pem" ec2-user@ec2-3-236-4-188.compute-1.amazonaws.com "cd product-analytics-report && ./deploy.sh"

echo "✅ Done! View at: http://ec2-3-236-4-188.compute-1.amazonaws.com:8080"
EOF

chmod +x ~/deploy-to-aws.sh
```

Then deploy anytime with:

```bash
~/deploy-to-aws.sh "Added new feature"
```

---

## Prerequisites (First-Time Setup)

- AWS EC2 instance (t3.micro or larger) running Amazon Linux 2
- SSH access to the instance
- Security Group configured to allow inbound traffic on port 8080
- **SSH Key File (`Santosh-Demo.pem`)** - Contact **santpati@cisco.com** to obtain this file

---

## Step 1: Configure Security Group

Before deploying, ensure port 8080 is open:

1. Go to **AWS Console** → **EC2** → **Security Groups**
2. Find the security group attached to your instance
3. Click **Edit inbound rules**
4. Add a new rule:
   - **Type:** Custom TCP
   - **Port range:** 8080
   - **Source:** 0.0.0.0/0 (or your IP for restricted access)
5. Click **Save rules**

---

## Step 2: Initial Deployment (First Time Only)

### Option A: One-Line Install

SSH into your EC2 instance and run:

```bash
ssh -i "Santosh-Demo.pem" ec2-user@ec2-3-236-4-188.compute-1.amazonaws.com
```

Then execute:

```bash
curl -sSL https://raw.githubusercontent.com/santpati/product-analytics-report/main/setup-ec2.sh | bash
```

### Option B: Manual Install

```bash
# SSH into your instance
ssh -i "Santosh-Demo.pem" ec2-user@ec2-3-236-4-188.compute-1.amazonaws.com

# Clone the repository
git clone https://github.com/santpati/product-analytics-report.git
cd product-analytics-report

# Make setup script executable and run it
chmod +x setup-ec2.sh
./setup-ec2.sh
```

---

## Step 3: Access Your Dashboard

Once deployed, access your dashboard at:

```
http://ec2-3-236-4-188.compute-1.amazonaws.com:8080
```

---

## Redeploying After Code Changes

When you push changes to GitHub, redeploy with:

```bash
# SSH into EC2
ssh -i "Santosh-Demo.pem" ec2-user@ec2-3-236-4-188.compute-1.amazonaws.com

# Run deploy script
cd product-analytics-report
./deploy.sh
```

Or as a one-liner from your local machine:

```bash
ssh -i "Santosh-Demo.pem" ec2-user@ec2-3-236-4-188.compute-1.amazonaws.com "cd product-analytics-report && ./deploy.sh"
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `sudo systemctl status adoption-tracker` | Check if server is running |
| `sudo systemctl restart adoption-tracker` | Restart the server |
| `sudo systemctl stop adoption-tracker` | Stop the server |
| `sudo journalctl -u adoption-tracker -f` | View live logs |
| `sudo journalctl -u adoption-tracker -n 100` | View last 100 log lines |

---

## Troubleshooting

### Dashboard not accessible?

1. **Check Security Group**: Ensure port 8080 is open
2. **Check service status**: `sudo systemctl status adoption-tracker`
3. **Check logs**: `sudo journalctl -u adoption-tracker -n 50`
4. **Test locally on EC2**: `curl http://localhost:8080`

### Service won't start?

```bash
# Check detailed logs
sudo journalctl -u adoption-tracker -n 100

# Try running manually to see errors
cd /home/ec2-user/product-analytics-report
source venv/bin/activate
python3 adoption_server.py
```

### Permission issues?

```bash
# Ensure correct ownership
sudo chown -R ec2-user:ec2-user /home/ec2-user/product-analytics-report
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS EC2 Instance                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  systemd service: adoption-tracker                   │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  adoption_server.py (Port 8080)             │    │   │
│  │  │  - Serves HTML dashboards                   │    │   │
│  │  │  - Proxies Pendo API requests               │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              http://ec2-xxx.compute-1.amazonaws.com:8080
```

---

## Optional: Set Up Auto-Refresh

To automatically refresh dashboard data hourly:

```bash
# Add cron job
(crontab -l 2>/dev/null; echo "0 * * * * cd /home/ec2-user/product-analytics-report && source venv/bin/activate && python3 refresh_dashboard.py >> /tmp/refresh.log 2>&1") | crontab -
```

