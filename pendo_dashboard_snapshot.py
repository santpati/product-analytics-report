#!/usr/bin/env python3
"""
Pendo Dashboard Snapshot Script
Takes a screenshot of the Pendo dashboard and emails it daily.
"""

import os
from datetime import datetime
from playwright.sync_api import sync_playwright
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from pathlib import Path

# Configuration
PENDO_URL = "https://app.pendo.io/s/4871315295174656/dashboards/XPkAW_fMm8YaobbFQagw0oilxys?dateType=7&accountId=20482_ciscospaces.app"
RECIPIENT_EMAIL = "visbhatt@cisco.com"
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"

# Email configuration - you'll need to set these
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "your-email@example.com")
SENDER_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")

def take_dashboard_screenshot():
    """Take a screenshot of the Pendo dashboard."""
    print(f"Taking screenshot at {datetime.now()}")
    
    # Create screenshots directory if it doesn't exist
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    screenshot_path = SCREENSHOT_DIR / f"pendo_dashboard_{timestamp}.png"
    
    with sync_playwright() as p:
        # Launch browser (headless mode)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080}
        )
        page = context.new_page()
        
        # Navigate to the dashboard
        print(f"Navigating to {PENDO_URL}")
        page.goto(PENDO_URL)
        
        # Wait for the page to load completely
        # You may need to adjust this selector based on Pendo's actual structure
        page.wait_for_load_state('networkidle')
        
        # If Pendo requires authentication, you'll need to handle login here
        # Example:
        # page.fill('input[name="email"]', 'your-email')
        # page.fill('input[name="password"]', 'your-password')
        # page.click('button[type="submit"]')
        # page.wait_for_load_state('networkidle')
        
        # Take screenshot
        page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"Screenshot saved to {screenshot_path}")
        
        browser.close()
    
    return screenshot_path

def send_email_with_screenshot(screenshot_path):
    """Send an email with the dashboard screenshot attached."""
    print("Preparing email...")
    
    # Create message
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = RECIPIENT_EMAIL
    msg['Subject'] = f"Pendo Dashboard Snapshot - {datetime.now().strftime('%Y-%m-%d')}"
    
    # Email body
    body = f"""
    <html>
    <body>
        <h2>Pendo Dashboard Daily Snapshot</h2>
        <p>Date: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
        <p>Please find the attached screenshot of your Pendo dashboard.</p>
        <br>
        <p>Dashboard URL: <a href="{PENDO_URL}">View Dashboard</a></p>
    </body>
    </html>
    """
    msg.attach(MIMEText(body, 'html'))
    
    # Attach screenshot
    with open(screenshot_path, 'rb') as f:
        img_data = f.read()
        image = MIMEImage(img_data, name=screenshot_path.name)
        msg.attach(image)
    
    # Send email
    try:
        print(f"Connecting to SMTP server {SMTP_SERVER}:{SMTP_PORT}")
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Email sent successfully to {RECIPIENT_EMAIL}")
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise

def main():
    """Main function to take screenshot and send email."""
    try:
        screenshot_path = take_dashboard_screenshot()
        send_email_with_screenshot(screenshot_path)
        print("Dashboard snapshot completed successfully!")
    except Exception as e:
        print(f"Error: {e}")
        raise

if __name__ == "__main__":
    main()


