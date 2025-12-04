#!/usr/bin/env python3
"""
Adoption Tracker Server
Serves the dashboard and proxies Pendo API calls to avoid CORS issues
"""

import http.server
import socketserver
import json
import urllib.request
import urllib.error
import ssl
from urllib.parse import urlparse, parse_qs
import os

PORT = 8080
PENDO_API_KEY = '7d0eb12c-2c01-406a-9614-39a27227ca72.us'
PENDO_BASE_URL = 'https://app.pendo.io/api/v1'

# SSL context to ignore certificate verification
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

class AdoptionHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        
        # Serve main page
        if parsed.path == '/' or parsed.path == '/index.html':
            self.path = '/adoption_tracker.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        
        # Proxy Pendo API GET requests
        if parsed.path.startswith('/api/pendo/'):
            self.proxy_pendo_get(parsed.path[11:], parse_qs(parsed.query))
            return
        
        return http.server.SimpleHTTPRequestHandler.do_GET(self)
    
    def do_POST(self):
        parsed = urlparse(self.path)
        
        # Proxy Pendo API POST requests
        if parsed.path.startswith('/api/pendo/'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else None
            self.proxy_pendo_post(parsed.path[11:], body)
            return
        
        self.send_error(404, 'Not Found')
    
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
    os.chdir('/Users/visbhatt/Documents/code/sample-app')
    
    with socketserver.TCPServer(("", PORT), AdoptionHandler) as httpd:
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║           🚀 ADOPTION TRACKER SERVER RUNNING 🚀              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  📍 Open in browser: http://localhost:{PORT}                  ║
║                                                              ║
║  Features:                                                   ║
║    • Dynamic tenant selection                                ║
║    • Duration filter (7-180 days)                            ║
║    • Real-time Pendo API data                                ║
║    • Space Explorer (Desk Booking) analytics                 ║
║    • Indoor Navigation analytics                             ║
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

