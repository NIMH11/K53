import os
import json
import csv
from datetime import datetime
from flask import Flask, send_from_directory, request, jsonify, send_file

# Base paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.join(BASE_DIR, "reports")
os.makedirs(REPORT_DIR, exist_ok=True)

# Static files live in project root
app = Flask(__name__, static_folder='.', static_url_path='')


@app.route('/')
def index():
    # Serve the main page
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_proxy(path):
    # Serve any other static files (CSS, JS, JSON, etc.)
    return send_from_directory('.', path)


@app.route('/report', methods=['POST'])
def report():
    """
    Receive a report from the front-end and:
      1) Save full JSON into reports/report-*.json
      2) Append a concise row to reports/log.csv
    """
    data = request.get_json(silent=True) or {}

    timestamp_iso = datetime.utcnow().isoformat()
    user_agent = request.headers.get('User-Agent', '')

    # Full JSON payload
    json_payload = dict(data)
    json_payload['_timestamp'] = timestamp_iso
    json_payload['_user_agent'] = user_agent

    # Reasonably unique filename
    safe_id = str(data.get('id', 'unknown')).replace('/', '_')
    fname = f"report-{timestamp_iso.replace(':', '-')}--{safe_id}.json"
    json_path = os.path.join(REPORT_DIR, fname)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_payload, f, ensure_ascii=False, indent=2)

    # CSV log
    log_path = os.path.join(REPORT_DIR, 'log.csv')
    file_exists = os.path.isfile(log_path)

    fieldnames = [
        'timestamp',
        'id',
        'question',
        'marked_correct_index',
        'marked_correct_text',
        'selected_correct_index',
        'selected_correct_letter',
        'selected_correct_text',
        'reason',
        'details',
        'user_agent',
    ]

    row = {
        'timestamp': timestamp_iso,
        'id': data.get('id', ''),
        'question': data.get('question', ''),
        'marked_correct_index': data.get('marked_correct_index', ''),
        'marked_correct_text': data.get('marked_correct_text', ''),
        'selected_correct_index': data.get('selected_correct_index', ''),
        'selected_correct_letter': data.get('selected_correct_letter', ''),
        'selected_correct_text': data.get('selected_correct_text', ''),
        'reason': data.get('reason', ''),
        'details': data.get('details', ''),
        'user_agent': user_agent,
    }

    with open(log_path, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)

    return jsonify({'ok': True, 'saved': os.path.basename(json_path)})


@app.route('/download-reports')
def download_reports():
    """
    Download reports/log.csv from the server.
    """
    log_path = os.path.join(REPORT_DIR, 'log.csv')
    if not os.path.exists(log_path):
        return "No reports yet", 404

    return send_file(
        log_path,
        mimetype='text/csv',
        as_attachment=True,
        download_name='reports.csv'
    )


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
