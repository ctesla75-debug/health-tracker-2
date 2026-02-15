# Health Tracker (Offline)

A fully-offline health tracker web app (PWA). No logins. No cloud. Data is stored locally on your device using IndexedDB.

## Features
- Daily Log: pick a date, tick supplements/exercises, enter measurements
- Charts: blood sugar, weight/fat, waist, blood pressure, grip strength, activity counts
- Export: JSON + CSV
- Import: JSON (merges by date)
- Clear data: all or by date range
- Works offline (service worker cache)

## Run locally (recommended)
Because browsers restrict some PWA features when opening files directly, run a tiny local web server:

### Option A: Python
```bash
python -m http.server 8000
```
Open: http://localhost:8000

### Option B: Node
```bash
npx serve .
```

## Put on GitHub Pages
1. Create a repo and upload all files/folders in this project
2. In GitHub: Settings → Pages → Deploy from branch → `main` / root
3. Open the Pages URL, then in your browser menu choose **Add to Home Screen** to install.

## Notes
- If you update the files, open Settings tab → **Refresh Offline Cache**, then reload the app.
