# BZI Site — Run Doc (for preview threads)

Zero-dependency Python 3 project. No Node.js, no npm, no pip installs.

## 1. Reproduce the artifacts a fresh checkout needs

- No env files to copy and no dependencies to install — the backend uses the
  Python 3 standard library only (`server.py`).
- If `public/assets/BZI-OEP-LICENCE.jpeg` is missing, copy it from the project
  root:
  ```bash
  mkdir -p public/assets && cp "BZI OEP LICENCE.jpeg" "public/assets/BZI-OEP-LICENCE.jpeg"
  ```
- Runtime submissions land in `data/submissions/` (auto-created, git-ignored).

## 2. Run the server

Default port **8090** (loopback only; 4173 is blocked on this machine by Windows). Start detached on Windows with
PowerShell, naming the executable exactly (Start-Process does not resolve
shell shims) and redirecting stdout/stderr to DIFFERENT files:

```
powershell -NoProfile -Command "(Start-Process -FilePath 'C:\Users\MC\AppData\Local\Programs\Python\Python314\python.exe' -ArgumentList 'server.py' -WorkingDirectory 'D:\BZI SITE' -RedirectStandardOutput 'D:\BZI SITE\.freebuff\server.out.log' -RedirectStandardError 'D:\BZI SITE\.freebuff\server.err.log' -WindowStyle Hidden -PassThru).Id"
```

Verify:
```
powershell -NoProfile -Command "Get-Process -Id <pid>"
curl -s http://127.0.0.1:4173/api/health
```

Manual run (foreground): `python server.py` — overrides: `PORT=8080 python server.py`.

## Notes

- Site: http://127.0.0.1:8090/  ·  License expiry date is edited in `data/config.json`.
- If port 8090 is taken, pick a free port and pass it via the `PORT` env var /
  `-ArgumentList 'server.py'` won't accept it — set `$env:PORT` before starting.
