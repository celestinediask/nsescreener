#!/usr/bin/env python3
import http.server
import socketserver
import json
import urllib.request
import urllib.parse
import subprocess
import time
import os

PORT = 8000
COOKIE_FILE = "/tmp/nse_cookies.txt"

cache = {
    'data': None,
    'last_updated': 0,
    'ttl': 5  # 5 seconds live cache
}

def fetch_nse_direct():
    now = time.time()
    if cache['data'] and (now - cache['last_updated']) < cache['ttl']:
        return cache['data']

    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

    # Initialize cookies
    init_cmd = f'curl -s -A "{user_agent}" -c {COOKIE_FILE} "https://www.nseindia.com/market-data/top-gainers-losers" > /dev/null'
    subprocess.run(init_cmd, shell=True)

    def nse_api_call(url):
        cmd = f'curl -s -A "{user_agent}" -H "Accept: application/json, text/plain, */*" -H "Referer: https://www.nseindia.com/market-data/top-gainers-losers" -b {COOKIE_FILE} "{url}"'
        try:
            raw = subprocess.check_output(cmd, shell=True, timeout=10).decode('utf-8')
            return json.loads(raw)
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return {}

    gainers_raw = nse_api_call("https://www.nseindia.com/api/live-analysis-variations?index=gainers")
    losers_raw = nse_api_call("https://www.nseindia.com/api/live-analysis-variations?index=loosers")
    all_indices_raw = nse_api_call("https://www.nseindia.com/api/allIndices")

    def parse_items(items):
        parsed = []
        for item in items:
            ltp = float(item.get('ltp', 0))
            prev = float(item.get('prev_price', ltp))
            change = round(ltp - prev, 2)
            p_change = float(item.get('perChange', 0))
            parsed.append({
                'symbol': item.get('symbol'),
                'name': item.get('symbol'),
                'price': round(ltp, 2),
                'change': change,
                'pChange': round(p_change, 2),
                'open': float(item.get('open_price', ltp)),
                'high': float(item.get('high_price', ltp)),
                'low': float(item.get('low_price', ltp)),
                'prevClose': round(prev, 2),
                'volume': int(item.get('trade_quantity', 0))
            })
        return parsed

    # 1. NIFTY 50
    nifty_g_data = gainers_raw.get('NIFTY', {}).get('data', [])
    nifty_l_data = losers_raw.get('NIFTY', {}).get('data', [])
    top_gainers = parse_items(nifty_g_data[:10])
    top_losers = parse_items(nifty_l_data[:10])

    # 2. NIFTY 100 (NIFTY 50 + NIFTY NEXT 50 combined)
    n100_g_items = nifty_g_data + gainers_raw.get('NIFTYNEXT50', {}).get('data', [])
    n100_g_items.sort(key=lambda x: float(x.get('perChange', 0)), reverse=True)
    nifty100_gainers = parse_items(n100_g_items[:10])

    n100_l_items = nifty_l_data + losers_raw.get('NIFTYNEXT50', {}).get('data', [])
    n100_l_items.sort(key=lambda x: float(x.get('perChange', 0)))
    nifty100_losers = parse_items(n100_l_items[:10])

    # 3. NIFTY 500 / All Securities
    allsec_g_data = gainers_raw.get('allSec', {}).get('data', [])
    allsec_l_data = losers_raw.get('allSec', {}).get('data', [])
    nifty500_gainers = parse_items(allsec_g_data[:10])
    nifty500_losers = parse_items(allsec_l_data[:10])

    # 4. F&O Securities
    fo_g_data = gainers_raw.get('FOSec', {}).get('data', [])
    fo_l_data = losers_raw.get('FOSec', {}).get('data', [])
    fo_gainers = parse_items(fo_g_data[:10])
    fo_losers = parse_items(fo_l_data[:10])

    # NIFTY Index Stats
    nifty_index = {
        'name': 'NIFTY 50 INDEX',
        'price': 23858.90,
        'change': -137.35,
        'pChange': -0.57,
        'high': 23990.75,
        'low': 23811.85,
        'prevClose': 23996.25
    }

    if isinstance(all_indices_raw, dict) and 'data' in all_indices_raw:
        for idx in all_indices_raw['data']:
            if idx.get('index') == 'NIFTY 50':
                nifty_index = {
                    'name': 'NIFTY 50 INDEX',
                    'price': float(idx.get('last', 0)),
                    'change': float(idx.get('variation', 0)),
                    'pChange': float(idx.get('percentChange', 0)),
                    'high': float(idx.get('high', 0)),
                    'low': float(idx.get('low', 0)),
                    'prevClose': float(idx.get('previousClose', 0))
                }
                break

    # Master list of all stocks
    seen_symbols = set()
    all_stocks = []

    all_raw_lists = [nifty_g_data, nifty_l_data, fo_g_data, fo_l_data, allsec_g_data, allsec_l_data]
    for raw_list in all_raw_lists:
        for item in raw_list:
            sym = item.get('symbol')
            if sym and sym not in seen_symbols:
                seen_symbols.add(sym)
                ltp = float(item.get('ltp', 0))
                prev = float(item.get('prev_price', ltp))
                all_stocks.append({
                    'symbol': sym,
                    'name': sym,
                    'price': round(ltp, 2),
                    'change': round(ltp - prev, 2),
                    'pChange': round(float(item.get('perChange', 0)), 2),
                    'open': float(item.get('open_price', ltp)),
                    'high': float(item.get('high_price', ltp)),
                    'low': float(item.get('low_price', ltp)),
                    'prevClose': round(prev, 2),
                    'volume': int(item.get('trade_quantity', 0))
                })

    all_stocks.sort(key=lambda s: s['pChange'], reverse=True)

    result = {
        'timestamp': int(now),
        'formattedTime': time.strftime("%d %b %Y, %H:%M:%S IST", time.localtime()),
        'source': 'nseindia.com/market-data/top-gainers-losers',
        'index': nifty_index,
        'topGainers': top_gainers,
        'topLosers': top_losers,
        'nifty100Gainers': nifty100_gainers,
        'nifty100Losers': nifty100_losers,
        'nifty500Gainers': nifty500_gainers,
        'nifty500Losers': nifty500_losers,
        'foGainers': fo_gainers,
        'foLosers': fo_losers,
        'allStocks': all_stocks
    }

    cache['data'] = result
    cache['last_updated'] = now
    return result

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/nifty50":
            try:
                data = fetch_nse_direct()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
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
