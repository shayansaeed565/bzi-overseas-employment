#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BZI — Bahauddin Zakariya International
Overseas Employment + Travel Agency website backend.

Zero-dependency Python 3 server (standard library only — no pip installs).
  * Serves the static site from ./public
  * Exposes a small JSON API: site config, jobs, flight search,
    applications, bookings, contact, newsletter, license status
  * Stores every submission as JSON under ./data/submissions

Run:   python server.py            (default port 8090)
       PORT=8080 python server.py  (override port)
"""

import json
import os
import re
import uuid
import datetime as dt
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DATA_DIR = os.path.join(BASE_DIR, "data")
SUBMISSIONS_DIR = os.path.join(DATA_DIR, "submissions")
PORT = int(os.environ.get("PORT", "8090"))
MAX_BODY = 256 * 1024


# --------------------------------------------------------------------------
# Data helpers
# --------------------------------------------------------------------------

def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return default


def load_config():
    return load_json(os.path.join(DATA_DIR, "config.json"), {})


def load_jobs():
    return load_json(os.path.join(DATA_DIR, "jobs.json"), [])


def load_flights():
    return load_json(os.path.join(DATA_DIR, "flights.json"),
                     {"airports": [], "routes": []})


def save_record(kind, record):
    os.makedirs(SUBMISSIONS_DIR, exist_ok=True)
    path = os.path.join(SUBMISSIONS_DIR, kind + ".json")
    records = load_json(path, [])
    records.append(record)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(records, fh, indent=2, ensure_ascii=False)
    return records


def iso_now():
    return dt.datetime.now(dt.timezone.utc).astimezone().isoformat(timespec="seconds")


def make_ref(prefix):
    return "%s-%s" % (prefix, uuid.uuid4().hex[:6].upper())


# --------------------------------------------------------------------------
# License / site payload
# --------------------------------------------------------------------------

def license_status(cfg):
    """Compute live status from the expiry date in config.json."""
    lic = cfg.get("license", {})
    expiry_raw = lic.get("expiryDate", "")
    try:
        expiry = dt.datetime.fromisoformat(expiry_raw).astimezone()
    except (TypeError, ValueError):
        return {"status": "unknown", "daysRemaining": None, "expiresAt": None}
    today = dt.datetime.now().astimezone()
    days = (expiry.date() - today.date()).days
    if days < 0:
        status = "expired"
    elif days <= 90:
        status = "expiring"
    else:
        status = "active"
    return {"status": status, "daysRemaining": days,
            "expiresAt": expiry.date().isoformat()}


def build_site_payload():
    cfg = load_config()
    payload = dict(cfg)
    lic = cfg.get("license", {})
    payload["license"] = dict(lic)
    payload["license"].update(license_status(cfg))
    return payload


# --------------------------------------------------------------------------
# Flight search (demo engine over data/flights.json)
# --------------------------------------------------------------------------

def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def search_flights(params):
    src = norm(params.get("from", ""))
    dst = norm(params.get("to", ""))
    routes = load_flights().get("routes", [])

    matched = []
    for r in routes:
        if norm(r.get("from")) == src and norm(r.get("to")) == dst:
            matched = r.get("options", [])
            break
    if not matched:
        # fall back to any route serving the destination
        for r in routes:
            if norm(r.get("to")) == dst:
                matched = r.get("options", [])[:2]
                break

    results = []
    for opt in matched:
        results.append({
            "airline": opt.get("airline"),
            "flight": opt.get("flight"),
            "depart": opt.get("depart"),
            "arrive": opt.get("arrive"),
            "duration": opt.get("duration"),
            "stops": opt.get("stops", 0),
            "price": opt.get("price"),
            "priceFormatted": "PKR " + format(int(opt.get("price", 0)), ",d"),
            "classes": opt.get("classes", ["Economy"]),
        })

    return {
        "query": {
            "from": params.get("from", ""),
            "to": params.get("to", ""),
            "date": params.get("date", ""),
            "passengers": params.get("passengers", "1"),
        },
        "count": len(results),
        "results": results,
    }


# --------------------------------------------------------------------------
# Input validation
# --------------------------------------------------------------------------

def clean_text(value, max_len=300):
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_len]


def valid_phone(value):
    digits = re.sub(r"\D", "", value or "")
    return 7 <= len(digits) <= 15


def valid_email(value):
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value or ""))


# --------------------------------------------------------------------------
# HTTP handler
# --------------------------------------------------------------------------

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, fmt, *args):
        pass  # keep the console quiet; errors still go to stderr

    # -- response helpers ------------------------------------------------
    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            return None
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    # -- GET routes ------------------------------------------------------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/health":
            return self._json(200, {"ok": True})
        if path == "/api/site":
            return self._json(200, build_site_payload())
        if path == "/api/jobs":
            return self._json(200, {"jobs": load_jobs()})
        if path == "/api/flight-search":
            params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
            return self._json(200, search_flights(params))
        return super().do_GET()

    # -- POST routes -----------------------------------------------------
    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/applications":
            return self._handle_application()
        if path == "/api/bookings":
            return self._handle_booking()
        if path == "/api/contact":
            return self._handle_contact()
        if path == "/api/newsletter":
            return self._handle_newsletter()
        self._json(404, {"ok": False, "error": "Not found"})

    def _handle_application(self):
        data = self._read_body() or {}
        name = clean_text(data.get("name"))
        phone = clean_text(data.get("phone"), 30)
        trade = clean_text(data.get("trade"), 80)
        if not name or len(name) < 2:
            return self._json(400, {"ok": False,
                                    "error": "Please enter your full name."})
        if not valid_phone(phone):
            return self._json(400, {"ok": False,
                                    "error": "Please enter a valid contact number."})
        if not trade:
            return self._json(400, {"ok": False,
                                    "error": "Please enter your trade / skill."})
        ref = make_ref("APP")
        record = {
            "ref": ref,
            "kind": "application",
            "name": name,
            "phone": phone,
            "trade": trade,
            "experience": clean_text(data.get("experience"), 10),
            "country": clean_text(data.get("country"), 60),
            "cvFile": clean_text(data.get("cvFile"), 120),
            "notes": clean_text(data.get("notes")),
            "createdAt": iso_now(),
        }
        save_record("applications", record)
        return self._json(201, {"ok": True, "ref": ref,
                                "message": "Application received."})

    def _handle_booking(self):
        data = self._read_body() or {}
        name = clean_text(data.get("name"))
        phone = clean_text(data.get("phone"), 30)
        frm = clean_text(data.get("from"), 60)
        to = clean_text(data.get("to"), 60)
        if not name or len(name) < 2:
            return self._json(400, {"ok": False,
                                    "error": "Please enter your full name."})
        if not valid_phone(phone):
            return self._json(400, {"ok": False,
                                    "error": "Please enter a valid contact number."})
        if not frm or not to:
            return self._json(400, {"ok": False,
                                    "error": "Please choose both departure and destination."})
        ref = make_ref("BZI")
        record = {
            "ref": ref,
            "kind": "booking",
            "name": name,
            "phone": phone,
            "from": frm,
            "to": to,
            "date": clean_text(data.get("date"), 20),
            "passengers": clean_text(data.get("passengers"), 10),
            "travelClass": clean_text(data.get("travelClass"), 30),
            "airline": clean_text(data.get("airline"), 60),
            "notes": clean_text(data.get("notes")),
            "createdAt": iso_now(),
        }
        save_record("bookings", record)
        return self._json(201, {"ok": True, "ref": ref,
                                "message": "Booking request received."})

    def _handle_contact(self):
        data = self._read_body() or {}
        name = clean_text(data.get("name"))
        phone = clean_text(data.get("phone"), 30)
        email = clean_text(data.get("email"), 120)
        message = clean_text(data.get("message"))
        if not name or len(name) < 2:
            return self._json(400, {"ok": False,
                                    "error": "Please enter your name."})
        if email and not valid_email(email):
            return self._json(400, {"ok": False,
                                    "error": "Please enter a valid email address."})
        if not message:
            return self._json(400, {"ok": False,
                                    "error": "Please write a short message."})
        ref = make_ref("MSG")
        record = {
            "ref": ref,
            "kind": "contact",
            "name": name,
            "phone": phone,
            "email": email,
            "subject": clean_text(data.get("subject"), 120),
            "message": message,
            "createdAt": iso_now(),
        }
        save_record("contacts", record)
        return self._json(201, {"ok": True, "ref": ref,
                                "message": "Message received."})

    def _handle_newsletter(self):
        data = self._read_body() or {}
        email = clean_text(data.get("email"), 120)
        if not valid_email(email):
            return self._json(400, {"ok": False,
                                    "error": "Please enter a valid email address."})
        ref = make_ref("SUB")
        record = {"ref": ref, "kind": "newsletter", "email": email,
                  "createdAt": iso_now()}
        save_record("newsletter", record)
        return self._json(201, {"ok": True, "ref": ref,
                                "message": "Subscribed. Welcome aboard!"})


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def main():
    handler = partial(Handler, directory=PUBLIC_DIR)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print("BZI server running at http://127.0.0.1:%d" % PORT)
    print("Serving static files from: %s" % PUBLIC_DIR)
    print("Submissions stored in: %s" % SUBMISSIONS_DIR)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
