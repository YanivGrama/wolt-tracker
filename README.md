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
