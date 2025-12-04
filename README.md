# Pendo Dashboard Daily Snapshot

This tool automatically captures screenshots of your Pendo dashboard and emails them to you daily.

## Features

- 📸 Captures full-page screenshots of your Pendo dashboard
- 📧 Sends screenshots via email with a formatted message
- ⏰ Can be scheduled to run daily via cron
- 📁 Saves screenshots locally in a `screenshots/` folder

## Setup Instructions

### 1. Install Dependencies

Run the setup script:

```bash
chmod +x setup.sh
./setup.sh
```

This will:
- Create a Python virtual environment
- Install required packages (Playwright)
- Download the Chromium browser for screenshots

### 2. Configure Email Settings

#### Option A: Using Gmail

1. Copy the example environment file:
   ```bash
   cp config.example.txt .env
   ```

2. Edit the `.env` file:
   ```bash
   nano .env
   ```

3. For Gmail, you need an **App Password** (not your regular password):
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification if not already enabled
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Generate an app password for "Mail"
   - Use that 16-character password in your `.env` file

4. Update `.env` with your details:
   ```
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SENDER_EMAIL=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password-here
   ```

#### Option B: Using Cisco Email (if available)

If you have access to Cisco's SMTP server:
```
SMTP_SERVER=outbound.cisco.com
SMTP_PORT=25
SENDER_EMAIL=visbhatt@cisco.com
EMAIL_PASSWORD=your-cisco-password
```

### 3. Configure Pendo Authentication (if needed)

If your Pendo dashboard requires login, you'll need to edit the script to handle authentication:

1. Open `pendo_dashboard_snapshot.py`
2. Find the section marked with "If Pendo requires authentication"
3. Uncomment and modify the login code to match your Pendo login flow

Alternatively, you can use Playwright's authentication state persistence:
```python
# After logging in once manually, save the authentication state
context.storage_state(path="auth.json")

# Then in subsequent runs, load it:
context = browser.new_context(storage_state="auth.json")
```

### 4. Test the Script

Before scheduling, test that everything works:

```bash
source venv/bin/activate
export $(cat .env | xargs)  # Load environment variables
python pendo_dashboard_snapshot.py
```

Check that:
- Screenshot is saved in the `screenshots/` folder
- Email is received at visbhatt@cisco.com

## Scheduling Daily Snapshots

### Using Cron (macOS/Linux)

1. Create a wrapper script to load the environment:

```bash
cat > run_snapshot.sh << 'EOF'
#!/bin/bash
cd /Users/visbhatt/Documents/code/sample-app
source venv/bin/activate
export $(cat .env | xargs)
python pendo_dashboard_snapshot.py >> logs/snapshot.log 2>&1
EOF

chmod +x run_snapshot.sh
```

2. Create logs directory:
```bash
mkdir -p logs
```

3. Edit your crontab:
```bash
crontab -e
```

4. Add this line to run daily at 9 AM:
```
0 9 * * * /Users/visbhatt/Documents/code/sample-app/run_snapshot.sh
```

Or for 5 PM daily:
```
0 17 * * * /Users/visbhatt/Documents/code/sample-app/run_snapshot.sh
```

5. Save and exit. Verify with:
```bash
crontab -l
```

### Cron Time Examples

- `0 9 * * *` - Every day at 9:00 AM
- `0 17 * * *` - Every day at 5:00 PM
- `0 9 * * 1-5` - Weekdays only at 9:00 AM
- `0 */6 * * *` - Every 6 hours

### Using launchd (macOS alternative)

Create a LaunchAgent plist file:

```bash
cat > ~/Library/LaunchAgents/com.pendo.snapshot.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pendo.snapshot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/visbhatt/Documents/code/sample-app/run_snapshot.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/visbhatt/Documents/code/sample-app/logs/snapshot.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/visbhatt/Documents/code/sample-app/logs/snapshot_error.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.pendo.snapshot.plist
```

## Troubleshooting

### Email not sending

- Verify your SMTP credentials are correct
- For Gmail, ensure you're using an App Password, not your regular password
- Check that your email provider allows SMTP access
- Look at the logs: `cat logs/snapshot.log`

### Screenshot is blank or shows login page

- You may need to configure authentication (see step 3 above)
- Try increasing the wait time in the script
- Test by running the script manually to see what's captured

### Cron job not running

- Check cron logs: `grep CRON /var/log/system.log`
- Ensure the script has execute permissions: `chmod +x run_snapshot.sh`
- Test the wrapper script manually: `./run_snapshot.sh`
- On macOS, you may need to give cron Full Disk Access in System Preferences

### Screenshots taking up too much space

The script saves all screenshots locally. To clean up old screenshots:

```bash
# Delete screenshots older than 7 days
find screenshots/ -name "*.png" -mtime +7 -delete
```

Add this to your cron job:
```
0 9 * * * /Users/visbhatt/Documents/code/sample-app/run_snapshot.sh && find /Users/visbhatt/Documents/code/sample-app/screenshots/ -name "*.png" -mtime +7 -delete
```

## File Structure

```
sample-app/
├── pendo_dashboard_snapshot.py  # Main script
├── requirements.txt              # Python dependencies
├── setup.sh                      # Setup script
├── run_snapshot.sh              # Cron wrapper script
├── .env                         # Email configuration (create from config.example.txt)
├── config.example.txt           # Example configuration
├── README.md                    # This file
├── venv/                        # Python virtual environment
├── screenshots/                 # Saved screenshots
└── logs/                        # Execution logs
```

## Security Notes

- Never commit your `.env` file to version control
- Keep your email credentials secure
- Consider using environment-specific credentials
- Regularly rotate your app passwords

## Support

For issues or questions, contact: visbhatt@cisco.com

