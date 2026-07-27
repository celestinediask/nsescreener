from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from nse_fetcher import fetch_nse_data

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            data = fetch_nse_data()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 's-maxage=5, stale-while-revalidate=10')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e), 'connected': False}).encode('utf-8'))
