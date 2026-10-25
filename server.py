import http.server
import socketserver
import json
import urllib.request
import urllib.error
import os
import sys
import csv
import io
import re
from datetime import datetime

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/14elN4KYfUWcq73Pk-J30qxA8rWxh5a9DzJ1axYVzJgs/edit?usp=sharing"
LOCAL_CSV_FALLBACK = r"C:\Users\avidk\Downloads\Audit Checklist - Remote Optometry - ET NPS Detractor Audits.csv"

CONFIG_FILE = os.path.join(DIRECTORY, "sheet_config.json")

def get_sheet_id(url):
    m = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
    return m.group(1) if m else "14elN4KYfUWcq73Pk-J30qxA8rWxh5a9DzJ1axYVzJgs"

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "sheetUrl": DEFAULT_SHEET_URL,
        "lastSynced": None,
        "syncSource": "Local Initial Dataset"
    }

def save_config(cfg):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print("Error saving config:", e)

month_map = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
}

def parse_date(date_str):
    if not date_str or not date_str.strip():
        return None
    s = date_str.strip()
    s = s.replace('2.26', '2026')
    m = re.match(r'^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})$', s)
    if m:
        day = int(m.group(1))
        mon_str = m.group(2).lower()
        mon = month_map.get(mon_str[:3], 9)
        yr = int(m.group(3))
        if yr < 100:
            yr += 2000
        return f"{yr:04d}-{mon:02d}-{day:02d}"
    
    m = re.match(r'^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$', s)
    if m:
        p1, p2, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if yr < 100:
            yr += 2000
        if p1 > 12:
            day, mon = p1, p2
        elif p2 > 12:
            day, mon = p2, p1
        else:
            if p1 == 10 and p2 <= 31:
                mon, day = p1, p2
            else:
                day, mon = p1, p2
        return f"{yr:04d}-{mon:02d}-{day:02d}"
    return s

def clean_feedback(val):
    if not val or not val.strip():
        return "Pending / Not Closed"
    v = val.strip().lower()
    if any(k in v for k in ['yes', 'verbal', 'given', 'berval']):
        return "Closed (Given)"
    elif 'no' in v:
        return "Pending / Not Closed"
    elif 'na' in v:
        return "N/A"
    return "Pending / Not Closed"

def clean_pass_fail(val):
    if not val or not val.strip():
        return "Pending / Unassigned"
    v = val.strip().lower()
    if 'pass' in v:
        return "Pass"
    elif 'fail' in v:
        return "Fail"
    elif 'not performed' in v:
        return "Not Performed"
    return "Other"

def clean_validation(val):
    if not val or not val.strip():
        return "Pending Validation"
    v = val.strip().lower()
    if 'not validated' in v:
        return "Not Validated"
    elif 'validated' in v:
        return "Validated"
    return "Pending Validation"

def process_csv_content(csv_text, source_name="Google Sheet"):
    # Use io.StringIO to properly preserve quotes and multiline headers
    reader = csv.DictReader(io.StringIO(csv_text))
    records = []
    
    # Helper to find field loosely
    def get_field(row, key_term):
        for k, v in row.items():
            if k and key_term.lower() in k.lower():
                return v.strip()
        return ''

    for idx, r in enumerate(reader):
        resp_id = r.get('Response ID', '').strip()
        qa = r.get('Quality Analyst', '').strip()
        pf = get_field(r, 'Audit Pass/Fail')
        audit_dt_raw = r.get('AUDIT DATE', '').strip()
        
        if not resp_id and not qa and not pf and not audit_dt_raw:
            continue
            
        norm_audit_date = parse_date(audit_dt_raw)
        raw_resp_date = r.get('Response Date', '').strip()
        norm_resp_date = parse_date(raw_resp_date)
        
        fb_raw = get_field(r, 'Feedback\n(connect+mail)') or get_field(r, 'Feedback')
        val_raw = get_field(r, 'Audit Validation')
        bucket_raw = get_field(r, "Auditor's Bucket")
        
        records.append({
            "id": idx + 1,
            "responseId": resp_id,
            "responseDate": norm_resp_date,
            "responseDateRaw": raw_resp_date,
            "week": r.get(' WEEK', '').strip(),
            "month": r.get('Month', '').strip(),
            "qa": qa if qa else "Unassigned",
            "roName": r.get('RO Name', '').strip() or "Unknown",
            "roId": get_field(r, 'RO Optom ID'),
            "category": r.get('Category', '').strip() or "Mature",
            "roc": r.get('ROC', '').strip() or "Unassigned",
            "facilityCode": r.get('Facility Code', '').strip(),
            "cxL1": r.get('Customer L1 Bucket', '').strip(),
            "cxL2": r.get('Customer L2 Bucket', '').strip(),
            "cxComment": r.get('Customer Comment', '').strip(),
            "sme": r.get('SME', '').strip(),
            "auditCategory": r.get('Audit Category', '').strip() or "ET NPS D%",
            "eyeTestDate": r.get('Eye Test Date', '').strip(),
            "queueId": r.get('Queue ID', '').strip(),
            "engagementId": get_field(r, 'Engagement ID'),
            "engagementDuration": get_field(r, 'Engagement Duration'),
            "auditDate": norm_audit_date,
            "auditDateRaw": audit_dt_raw,
            "passFailRaw": pf,
            "passFailStatus": clean_pass_fail(pf),
            "auditorBucket": bucket_raw,
            "auditorComment": r.get("Auditor's Comment", '').strip(),
            "feedbackRaw": fb_raw,
            "feedbackStatus": clean_feedback(fb_raw),
            "validationRaw": val_raw,
            "validationStatus": clean_validation(val_raw),
            "videoShown": r.get('Video Shown to RO', '').strip() or "Pending",
            "correlation": get_field(r, 'Correlates with your Finding'),
            "remarksCorrelation": r.get('Remarks for Correlation- Cx L1/L2 Buckets', '').strip(),
            "cycleTime": r.get('Eye test Cycle time', '').strip(),
            "nineSteps": r.get('9 Steps Performed', '').strip(),
            "history": r.get('History', '').strip(),
            "ar": r.get('AR', '').strip(),
            "pgp": r.get('PGP', '').strip(),
            "pdAdjustment": r.get('PD & phoropter adjustment', '').strip(),
            "distanceVision": r.get('Monocular Distance vision', '').strip(),
            "subjectiveRefraction": r.get('Subjective refraction in professional way as related and expected', '').strip(),
            "fogging": r.get('Sph Correction/Fogging', '').strip(),
            "duochrome": r.get('Duochrome', '').strip(),
            "jcc": r.get('JCC Performed', '').strip(),
            "binocularBalancing": r.get('Binocular Balancing', '').strip(),
            "nearVision": r.get('Near Vision Check', '').strip(),
            "walkingTrial": get_field(r, 'Walking Trial'),
            "prescriptionExplanation": r.get('Prescription Explanation and recommendation', '').strip(),
            "handover": r.get('Handover to store team', '').strip(),
            "confidence": r.get('How was the confidence of the Optometrist', '').strip(),
            "communicationTone": r.get('How was the communication tone of the optometrist throughout the eye test', '').strip(),
            "speechRate": get_field(r, 'Speech Rate'),
            "remoteControl": get_field(r, 'Remote Control'),
            "storeAssistance": r.get('How was the store staff assistance', '').strip(),
            "productPitched": r.get('Which Product was pitched at STEP 9 ?', '').strip()
        })

    json_path = os.path.join(DIRECTORY, "data.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    js_path = os.path.join(DIRECTORY, "data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(f"window.AUDIT_DATA = {json.dumps(records, ensure_ascii=False)};\n")

    cfg = load_config()
    cfg["lastSynced"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cfg["syncSource"] = source_name
    cfg["recordCount"] = len(records)
    save_config(cfg)

    return records

def find_local_csv():
    """Search multiple known paths for a local audit CSV export."""
    candidates = [
        LOCAL_CSV_FALLBACK,
        os.path.join(os.path.expanduser("~"), "Downloads", "Audit Checklist - Remote Optometry - ET NPS Detractor Audits.csv"),
        os.path.join(os.path.expanduser("~"), "Desktop", "Audit Checklist - Remote Optometry - ET NPS Detractor Audits.csv"),
    ]
    # Also scan Downloads for any recent CSV with "Audit" in name
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    if os.path.isdir(downloads):
        for fname in sorted(os.listdir(downloads), reverse=True):
            if fname.endswith(".csv") and ("Audit" in fname or "audit" in fname or "Detractor" in fname):
                candidates.append(os.path.join(downloads, fname))
    
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None

def sync_from_google_sheet(sheet_url):
    sheet_id = get_sheet_id(sheet_url)
    export_urls = [
        f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv",
        f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv"
    ]
    
    content = None
    
    for url in export_urls:
        try:
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    raw_bytes = response.read()
                    text = raw_bytes.decode('utf-8', errors='replace')
                    if "Response ID" in text or "Quality Analyst" in text:
                        content = text
                        break
        except Exception as e:
            pass

    if content:
        records = process_csv_content(content, source_name="Google Sheet Live API")
        return {
            "success": True,
            "source": "Google Sheet Live API",
            "message": f"Successfully synced {len(records)} records directly from Google Sheet!",
            "recordsCount": len(records),
            "recordCount": len(records),
            "lastSynced": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    
    local_csv = find_local_csv()
    if local_csv:
        try:
            with open(local_csv, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            records = process_csv_content(content, source_name="Local Google Sheet Export")
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            return {
                "success": True,
                "source": "Local Google Sheet Export (Cached/Downloaded)",
                "message": f"Synced {len(records)} records from local CSV export.",
                "recordsCount": len(records),
                "recordCount": len(records),
                "lastSynced": now,
                "timestamp": now
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    return {
        "success": False,
        "error": "Google Sheet is private (requires sign-in). Share the sheet as 'Anyone with the link can view' to enable live sync."
    }


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/config':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            cfg = load_config()
            self.wfile.write(json.dumps(cfg).encode('utf-8'))
            return
        elif self.path.startswith('/api/sync'):
            cfg = load_config()
            result = sync_from_google_sheet(cfg.get("sheetUrl", DEFAULT_SHEET_URL))
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return
        
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/sync':
            length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(length) if length > 0 else b'{}'
            try:
                data = json.loads(body.decode('utf-8'))
                url = data.get('sheetUrl') or load_config().get("sheetUrl", DEFAULT_SHEET_URL)
            except Exception:
                url = DEFAULT_SHEET_URL
            
            result = sync_from_google_sheet(url)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return
        elif self.path == '/api/update-config':
            length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(length) if length > 0 else b'{}'
            try:
                data = json.loads(body.decode('utf-8'))
                cfg = load_config()
                if 'sheetUrl' in data:
                    cfg['sheetUrl'] = data['sheetUrl']
                save_config(cfg)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "config": cfg}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
            return

        super().do_POST()

def run():
    os.chdir(DIRECTORY)
    # Sync initial content with io.StringIO on launch
    if os.path.exists(LOCAL_CSV_FALLBACK):
        try:
            with open(LOCAL_CSV_FALLBACK, "r", encoding="utf-8", errors="replace") as f:
                process_csv_content(f.read(), "Initial Launch Load")
        except Exception as e:
            print("Initial process error:", e)

    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"=====================================================")
            print(f"  Remote Optometry QA Dashboard Server Started!")
            print(f"  URL: http://localhost:{PORT}")
            print(f"=====================================================")
            httpd.serve_forever()
    except OSError as e:
        if "address already in use" in str(e).lower() or e.errno == 10048:
            alt_port = 8085
            with socketserver.TCPServer(("", alt_port), Handler) as httpd:
                print(f"Port {PORT} in use, running on http://localhost:{alt_port}")
                httpd.serve_forever()
        else:
            raise e

if __name__ == "__main__":
    run()
