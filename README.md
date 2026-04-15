# Wolt Delivery Tracker

A CLI tool that tracks Wolt food deliveries in real-time by polling the tracking page every 10 seconds. Logs all changes to JSONL files and supports replaying the full delivery history as a terminal timeline.

## Features

- Real-time tracking of order status (5 steps: ordered → seen → prepared → delivered → complete)
- ETA countdown monitoring
- Courier GPS position tracking during delivery
- Restaurant and destination GPS coordinates
- Reverse geocoding of the delivery address
- JSONL logging (only logs when something changes)
- Terminal-based history replay with colored timeline
- Support for tracking multiple orders simultaneously

## Setup

```bash
bun install
bunx playwright install chromium
```

## Usage

### Track a delivery

```bash
bun run src/index.ts track https://track.wolt.com/s/YOUR_TRACKING_CODE
```

Track multiple orders:

```bash
bun run src/index.ts track https://track.wolt.com/s/CODE1 https://track.wolt.com/s/CODE2
```

### Replay delivery history

List available logs:

```bash
bun run src/index.ts replay
```

Replay a specific order (by tracking code or file path):

```bash
bun run src/index.ts replay AJuxmW3dpkmpzPLJ0-sPyg
```

## Log Format

Each line in the JSONL log is a complete event:

```json
{
  "timestamp": "2026-04-09T11:10:02.513Z",
  "trackingCode": "AJuxmW3dpkmpzPLJ0-sPyg",
  "restaurantName": "Hummus Neri | Kiryat Ono",
  "status": { "step": 4, "label": "Being delivered", "description": "..." },
  "eta": { "minutes": 19, "rawText": "19 minutes until delivery" },
  "gps": {
    "restaurant": { "lat": 32.069, "lng": 34.864 },
    "destination": { "lat": 32.063, "lng": 34.842 },
    "courier": { "lat": 32.049, "lng": 34.855 }
  },
  "destinationAddress": "7, יצחק נבון, קריית אונו, ישראל",
  "changes": ["ETA: 18 min → 19 min", "Courier appeared at 32.049, 34.855"]
}
```

Logs are stored in the `logs/` directory, one file per tracking code.

## Web UI (Bun server)

Run the public-facing tracker as an online service:

```bash
bun run server.ts
```

Open <http://localhost:3000>, paste a Wolt tracking URL, and the page auto-redirects
to `/track/<CODE>` with live WebSocket updates, a Leaflet map, and optional push
notifications.

## Deploying to Railway

The project ships with a `Dockerfile` and `railway.json` for single-service
deployment on [Railway](https://railway.com).

1. Push the repo to GitHub and create a new Railway project from the repo.
   Railway auto-detects `railway.json` and builds the Dockerfile.
2. Add a **persistent volume** mounted at `/app/logs` so JSONL history survives
   restarts.
3. Set environment variables:
   - `VAPID_PUBLIC_KEY` – generated with `bun -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"`
   - `VAPID_PRIVATE_KEY` – (from the same command)
   - `VAPID_CONTACT_EMAIL` – e.g. `mailto:you@example.com`
   - `PORT` is injected by Railway automatically.
4. Deploy. Railway probes `/health` for readiness.

The image is based on `mcr.microsoft.com/playwright:v1.59.1-jammy` (Chromium
pre-installed) with Bun layered on top, so the tracker child processes can drive
Playwright without any extra setup.
