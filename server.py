# Lightweight static server + report sink
# Usage:
#   python server.py
# Then open: http://localhost:8080
#
# When the frontend posts to /report, we save a JSON file into ./reports/
# and append the row to ./reports/log.csv

from http.server import SimpleHTTPRequestHandler, HTTPServer
import json, os, time, csv
from urllib.parse import urlparse

PORT = 8080
REPORT_DIR = os.path.join(os.path.dirname(__file__), "reports")
os.makedirs(REPORT_DIR, exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/report":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
            return

        length = int(self.headers.get('content-length', 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body.decode('utf-8'))
        except Exception as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(("Bad JSON: %s" % e).encode('utf-8'))
            return

        # Save individual JSON
        ts = int(time.time()*1000)
        base = f"{ts}-{data.get('id','noid')}"
        json_path = os.path.join(REPORT_DIR, f"{base}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Append to CSV log
        csv_path = os.path.join(REPORT_DIR, "log.csv")
        header = ["timestamp","id","question","marked_correct_index","marked_correct_text",
                  "selected_correct_index","selected_correct_letter","selected_correct_text",
                  "reason","details"]
        write_header = not os.path.exists(csv_path)
        with open(csv_path, "a", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            if write_header:
                w.writerow(header)
            w.writerow([
                data.get("timestamp"),
                data.get("id",""),
                data.get("question",""),
                data.get("marked_correct_index",""),
                data.get("marked_correct_text",""),
                data.get("selected_correct_index",""),
                data.get("selected_correct_letter",""),
                data.get("selected_correct_text",""),
                data.get("reason",""),
                data.get("details",""),
            ])

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "saved": os.path.basename(json_path)}).encode('utf-8'))

def run():
    httpd = HTTPServer(("", PORT), Handler)
    print(f"Serving on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == "__main__":
    run()
