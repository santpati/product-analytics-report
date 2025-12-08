# Quick Start Guide

Get your Pendo dashboard snapshots up and running in 5 minutes!

## Step 1: Run Setup (2 minutes)

```bash
cd /Users/visbhatt/Documents/code/sample-app
./setup.sh
```

## Step 2: Configure Email (2 minutes)

```bash
# Copy the example config
cp config.example.txt .env

# Edit with your credentials
nano .env
```

**For Gmail users:**
- Set `SENDER_EMAIL` to your Gmail address
- For `EMAIL_PASSWORD`, you need a Gmail App Password:
  1. Visit: https://myaccount.google.com/apppasswords
  2. Generate a new app password
  3. Copy the 16-character password into `.env`

**For Cisco email:**
```
SMTP_SERVER=outbound.cisco.com
SMTP_PORT=25
SENDER_EMAIL=visbhatt@cisco.com
EMAIL_PASSWORD=your-password
```

## Step 3: Test It (1 minute)

```bash
source venv/bin/activate
export $(cat .env | xargs)
python pendo_dashboard_snapshot.py
```

Check your email at visbhatt@cisco.com - you should receive the dashboard snapshot!

## Step 4: Schedule Daily Emails

### Option A: Quick Cron Setup

```bash
# Create wrapper script
cat > run_snapshot.sh << 'EOF'
#!/bin/bash
cd /Users/visbhatt/Documents/code/sample-app
source venv/bin/activate
export $(cat .env | xargs)
python pendo_dashboard_snapshot.py >> logs/snapshot.log 2>&1
EOF

chmod +x run_snapshot.sh
mkdir -p logs

# Add to cron (runs daily at 9 AM)
(crontab -l 2>/dev/null; echo "0 9 * * * /Users/visbhatt/Documents/code/sample-app/run_snapshot.sh") | crontab -
```

### Option B: Choose Your Schedule

Edit cron:
```bash
crontab -e
```

Add one of these lines:
```
0 9 * * * /Users/visbhatt/Documents/code/sample-app/run_snapshot.sh    # Daily at 9 AM
0 17 * * * /Users/visbhatt/Documents/code/sample-app/run_snapshot.sh   # Daily at 5 PM
0 9 * * 1-5 /Users/visbhatt/Documents/code/sample-app/run_snapshot.sh  # Weekdays at 9 AM
```

## Done! 🎉

Your dashboard will now be emailed to you automatically every day.

### View Logs

```bash
tail -f logs/snapshot.log
```

### Manual Run

```bash
source venv/bin/activate
export $(cat .env | xargs)
python pendo_dashboard_snapshot.py
```

## Troubleshooting

**Email not received?**
- Check logs: `cat logs/snapshot.log`
- Verify credentials in `.env`
- For Gmail, ensure you're using an App Password

**Screenshot shows login page?**
- You may need to configure Pendo authentication in the script
- See README.md for authentication setup

**Cron not running?**
- Test manually: `./run_snapshot.sh`
- Check logs: `cat logs/snapshot.log`
- Verify cron: `crontab -l`

For detailed documentation, see [README.md](README.md)


