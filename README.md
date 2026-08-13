# Bahauddin Zakariya International — Recruitment & Travel Website

Govt. Approved OEP (License No. 3165/MTN) website combining **overseas manpower
recruitment** with a full **travel agency** (air tickets, Umrah/Hajj packages,
visa assistance), built with a zero-dependency Python backend.

## Stack

- **Frontend** — vanilla HTML / CSS / JS (no build step, no framework).
  Premium design system in `public/css/style.css`; behaviour in `public/js/main.js`.
- **Backend** — `server.py`, Python 3 standard library only (no pip installs).
  Serves the static site and a JSON API. Submissions are stored as JSON files
  under `data/submissions/` (git-ignored).

## Run

Requires **Python 3.10+** (no other dependencies).

```bash
python server.py            # serves http://127.0.0.1:8090
PORT=8080 python server.py  # different port (PowerShell: $env:PORT=8080)
```

## API

| Method | Path                 | Purpose                                        |
|--------|----------------------|------------------------------------------------|
| GET    | `/api/site`          | Company + license config incl. live status     |
| GET    | `/api/jobs`          | Open vacancy listings                          |
| GET    | `/api/flight-search?from=&to=&date=&passengers=` | Demo fare search          |
| POST   | `/api/applications`  | Job application (name, phone, trade, …)        |
| POST   | `/api/bookings`      | Flight booking request                         |
| POST   | `/api/contact`       | Contact form message                           |
| POST   | `/api/newsletter`    | Newsletter subscription                        |

Each POST validates input and returns a reference like `APP-4F2A9C`. All
submissions land in `data/submissions/*.json`.

## Editing content (important)

- **License expiry date** — the countdown visible all over the site is driven by
  `data/config.json` → `license.expiryDate`. Set the REAL date from your license
  document (format `YYYY-MM-DD`). Status flips to `expiring` within 90 days and
  `expired` after the date. This is currently a placeholder.
- **Jobs** — edit `data/jobs.json`.
- **Flight fares** — demo data in `data/flights.json` (routes + options). Prices
  are indicative; confirm fares with the airline/GDS at booking time.
- **Phones, emails, address, socials** — `data/config.json` → `company`.
- **Photos** — drop a real CEO photo into `public/` and replace the monogram
  block in `public/index.html` (search for `monogram`). The license document is
  `public/assets/BZI-OEP-LICENCE.jpeg` (copy of the file in the project root).

## Going to production

1. Set the real license expiry date in `data/config.json`.
2. Run behind a reverse proxy (nginx/Caddy) with a domain + HTTPS.
3. Point the WhatsApp / social links at your real accounts.
4. For email delivery of submissions, forward `data/submissions/*.json` or
   replace `save_record()` with an SMTP/WhatsApp API call.
