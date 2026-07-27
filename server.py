#!/usr/bin/env python3
import http.server
import socketserver
import json
import urllib.parse
import time
import threading
import os
from nse_fetcher import fetch_nse_data

PORT = int(os.environ.get("PORT", 8000))

cache = {
    'data': {
        'connected': False,
        'error': 'Initializing NSE connection...'
    },
    'last_updated': 0,
    'lock': threading.Lock()
}

def update_nse_cache_loop():
    while True:
        try:
            result = fetch_nse_data()
            now_ts = int(time.time())
            with cache['lock']:
                cache['data'] = result
                cache['last_updated'] = now_ts
        except Exception as e:
            print(f"Background update error: {e}")
            with cache['lock']:
                if cache['data']:
                    cache['data']['connected'] = False
        time.sleep(3.0)

updater_thread = threading.Thread(target=update_nse_cache_loop, daemon=True)
updater_thread.start()

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/nifty50":
            try:
                with cache['lock']:
                    data = cache['data']
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as e:
                try:
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e), "connected": False}).encode("utf-8"))
                except Exception:
                    pass
            return

        return http.server.SimpleHTTPRequestHandler.do_GET(self)

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        print(f"🚀 Direct NSE India Screener Server running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
