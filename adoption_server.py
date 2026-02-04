#!/usr/bin/env python3
"""
Adoption Tracker Server
Serves the dashboard and proxies Pendo API calls to avoid CORS issues
Includes usage analytics tracking with SQLite storage
"""

import http.server
import socketserver
import json
import urllib.request
import urllib.error
import ssl
import sqlite3
import threading
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
import os

PORT = 8080
PENDO_API_KEY = '7d0eb12c-2c01-406a-9614-39a27227ca72.us'
PENDO_BASE_URL = 'https://app.pendo.io/api/v1'
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'analytics.db')

# SSL context to ignore certificate verification
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Thread-local storage for database connections
_db_local = threading.local()

def get_db_connection():
    """Get a thread-local database connection"""
    if not hasattr(_db_local, 'conn'):
        _db_local.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _db_local.conn.row_factory = sqlite3.Row
    return _db_local.conn

def init_database():
    """Initialize the SQLite database with required tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create analytics_events table for tracking all events
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analytics_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            tenant_id TEXT,
            duration_days INTEGER,
            report_type TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_agent TEXT,
            ip_address TEXT
        )
    ''')
    
    # Create indexes for efficient querying
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_event_type ON analytics_events(event_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON analytics_events(timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tenant_id ON analytics_events(tenant_id)')
    
    conn.commit()
    conn.close()
    print("📊 Analytics database initialized")

class AdoptionHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        
        # Serve main page
        if parsed.path == '/' or parsed.path == '/index.html':
            self.path = '/adoption_tracker.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        
        # Serve analytics dashboard
        if parsed.path == '/analytics':
            self.path = '/analytics.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        
        # Analytics API endpoints
        if parsed.path == '/api/analytics/stats':
            self.handle_analytics_stats()
            return
        
        if parsed.path == '/api/analytics/timeseries':
            self.handle_analytics_timeseries()
            return
        
        if parsed.path == '/api/analytics/audit':
            self.handle_analytics_audit()
            return
        
        # Proxy Pendo API GET requests
        if parsed.path.startswith('/api/pendo/'):
            self.proxy_pendo_get(parsed.path[11:], parse_qs(parsed.query))
            return
        
        return http.server.SimpleHTTPRequestHandler.do_GET(self)
    
    def do_POST(self):
        parsed = urlparse(self.path)
        
        # Analytics tracking endpoint
        if parsed.path == '/api/analytics/track':
            self.handle_analytics_track()
            return
        
        # Proxy Pendo API POST requests
        if parsed.path.startswith('/api/pendo/'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else None
            self.proxy_pendo_post(parsed.path[11:], body)
            return
        
        self.send_error(404, 'Not Found')
    
    def handle_analytics_track(self):
        """Track an analytics event"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b'{}'
            data = json.loads(body.decode('utf-8'))
            
            event_type = data.get('event_type', 'unknown')
            tenant_id = data.get('tenant_id', '')
            duration_days = data.get('duration_days', 0)
            report_type = data.get('report_type', '')
            user_agent = self.headers.get('User-Agent', '')
            ip_address = self.client_address[0] if self.client_address else ''
            
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO analytics_events (event_type, tenant_id, duration_days, report_type, user_agent, ip_address)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (event_type, tenant_id, duration_days, report_type, user_agent, ip_address))
            conn.commit()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'id': cursor.lastrowid}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def handle_analytics_stats(self):
        """Get aggregate analytics statistics"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Total reports generated (load_data events)
            cursor.execute("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'load_data'")
            reports_generated = cursor.fetchone()[0]
            
            # Total reports downloaded
            cursor.execute("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'download_report'")
            reports_downloaded = cursor.fetchone()[0]
            
            # Unique tenants
            cursor.execute("SELECT COUNT(DISTINCT tenant_id) FROM analytics_events WHERE tenant_id != ''")
            unique_tenants = cursor.fetchone()[0]
            
            # Total sessions (unique combinations of tenant_id + date)
            cursor.execute("""
                SELECT COUNT(DISTINCT tenant_id || DATE(timestamp)) 
                FROM analytics_events 
                WHERE event_type = 'load_data' AND tenant_id != ''
            """)
            total_sessions = cursor.fetchone()[0]
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'reports_generated': reports_generated,
                'reports_downloaded': reports_downloaded,
                'unique_tenants': unique_tenants,
                'total_sessions': total_sessions
            }).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def handle_analytics_timeseries(self):
        """Get timeseries data for the last 7 days"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Get daily counts for the last 7 days
            cursor.execute("""
                SELECT 
                    DATE(timestamp) as date,
                    SUM(CASE WHEN event_type = 'load_data' THEN 1 ELSE 0 END) as reports_generated,
                    SUM(CASE WHEN event_type = 'download_report' THEN 1 ELSE 0 END) as reports_downloaded
                FROM analytics_events
                WHERE timestamp >= DATE('now', '-7 days')
                GROUP BY DATE(timestamp)
                ORDER BY date ASC
            """)
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    'date': row['date'],
                    'reports_generated': row['reports_generated'],
                    'reports_downloaded': row['reports_downloaded']
                })
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def handle_analytics_audit(self):
        """Get audit trail - latest 50 records"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    id,
                    event_type,
                    tenant_id,
                    duration_days,
                    report_type,
                    timestamp
                FROM analytics_events
                ORDER BY timestamp DESC
                LIMIT 50
            """)
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    'id': row['id'],
                    'event_type': row['event_type'],
                    'tenant_id': row['tenant_id'],
                    'duration_days': row['duration_days'],
                    'report_type': row['report_type'],
                    'timestamp': row['timestamp']
                })
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def proxy_pendo_get(self, endpoint, params):
        url = f"{PENDO_BASE_URL}/{endpoint}"
        if params:
            query_string = '&'.join([f"{k}={v[0]}" for k, v in params.items()])
            url = f"{url}?{query_string}"
        
        try:
            req = urllib.request.Request(url)
            req.add_header('X-Pendo-Integration-Key', PENDO_API_KEY)
            req.add_header('Content-Type', 'application/json')
            
            with urllib.request.urlopen(req, context=ssl_context) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def proxy_pendo_post(self, endpoint, body):
        url = f"{PENDO_BASE_URL}/{endpoint}"
        
        try:
            req = urllib.request.Request(url, data=body, method='POST')
            req.add_header('X-Pendo-Integration-Key', PENDO_API_KEY)
            req.add_header('Content-Type', 'application/json')
            
            with urllib.request.urlopen(req, context=ssl_context) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else str(e)
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': error_body}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Pendo-Integration-Key')
        self.end_headers()
    
    def log_message(self, format, *args):
        # Custom logging
        print(f"[{self.log_date_time_string()}] {args[0]}")

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Initialize the analytics database
    init_database()
    
    with socketserver.TCPServer(("", PORT), AdoptionHandler) as httpd:
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║           🚀 ADOPTION TRACKER SERVER RUNNING 🚀              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  📍 Open in browser: http://localhost:{PORT}                  ║
║  📊 Analytics Dashboard: http://localhost:{PORT}/analytics    ║
║                                                              ║
║  Features:                                                   ║
║    • Dynamic tenant selection                                ║
║    • Duration filter (7-180 days)                            ║
║    • Real-time Pendo API data                                ║
║    • Space Explorer (Desk Booking) analytics                 ║
║    • Indoor Navigation analytics                             ║
║    • Usage Analytics Dashboard                               ║
║                                                              ║
║  Press Ctrl+C to stop the server                             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
""")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

if __name__ == '__main__':
    main()

