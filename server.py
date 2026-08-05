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

history_store = {
    'index': [],  # list of {time: timestamp, price: val, change: val, pChange: val}
    'stocks': {} # symbol -> list of {time: timestamp, price: val, pChange: val}
}
MAX_HISTORY_POINTS = 300

def update_nse_cache_loop():
    while True:
        try:
            result = fetch_nse_data()
            now_ts = int(time.time())
            with cache['lock']:
                cache['data'] = result
                cache['last_updated'] = now_ts
                
                if result.get('connected') or result.get('niftyIndex'):
                    idx = result.get('niftyIndex', {})
                    if idx and idx.get('price'):
                        history_store['index'].append({
                            'time': now_ts,
                            'price': idx['price'],
                            'change': idx.get('change', 0),
                            'pChange': idx.get('pChange', 0)
                        })
                        if len(history_store['index']) > MAX_HISTORY_POINTS:
                            history_store['index'].pop(0)

                    stocks = result.get('allStocks', [])
                    for s in stocks:
                        sym = s.get('symbol')
                        if sym and s.get('price'):
                            if sym not in history_store['stocks']:
                                history_store['stocks'][sym] = []
                            history_store['stocks'][sym].append({
                                'time': now_ts,
                                'price': s['price'],
                                'pChange': s.get('pChange', 0)
                            })
                            if len(history_store['stocks'][sym]) > MAX_HISTORY_POINTS:
                                history_store['stocks'][sym].pop(0)
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

        if path == "/api/history":
            try:
                query = urllib.parse.parse_qs(parsed_url.query)
                symbol = query.get('symbol', ['index'])[0]
                with cache['lock']:
                    if symbol == 'index':
                        hist = history_store['index']
                    else:
                        hist = history_store['stocks'].get(symbol, [])
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({'symbol': symbol, 'history': hist}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
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
