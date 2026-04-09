import type { BrowserContext, Page } from "playwright";
import { extractPageData } from "./extractor.ts";
import { extractGpsData } from "./map-extractor.ts";
import { reverseGeocode } from "./geocoder.ts";
import { diffSnapshots } from "./diff.ts";
import { appendEvent, getLogPath } from "./logger.ts";
import type { TrackingSnapshot, TrackingEvent } from "./types.ts";

const POLL_INTERVAL_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

export interface TrackerOptions {
  url: string;
  context: BrowserContext;
  onDone?: (code: string) => void;
}

function extractCode(url: string): string {
  const match = url.match(/\/s\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? "unknown";
}

/**
 * Tracks a single Wolt delivery order by polling the page every 10 seconds.
 * Only logs when something has changed. Stops when the order is delivered.
 */
export async function startTracker(opts: TrackerOptions): Promise<void> {
  const { url, context, onDone } = opts;
  const trackingCode = extractCode(url);
  let page: Page | null = null;
  let previousSnapshot: TrackingSnapshot | null = null;
  let destinationAddress: string | null = null;
  let consecutiveErrors = 0;
  let stopped = false;

  const logPath = getLogPath(trackingCode);
  console.log(`[${trackingCode}] Tracking started → ${logPath}`);

  try {
    page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    await dismissCookieBanner(page);

    // Wait for key content to appear
    await page.waitForSelector("h1", { timeout: 15_000 }).catch(() => {});

    while (!stopped) {
      try {
        const snapshot = await pollOnce(page, trackingCode, previousSnapshot, destinationAddress);
        if (snapshot) {
          previousSnapshot = snapshot.data;
          if (snapshot.address) {
            destinationAddress = snapshot.address;
          }
          consecutiveErrors = 0;
        }

        if (previousSnapshot?.status.step === 5) {
          console.log(`[${trackingCode}] Order delivered. Stopping.`);
          stopped = true;
          break;
        }

        await sleep(POLL_INTERVAL_MS);
      } catch (err) {
        consecutiveErrors++;
        const backoff = Math.min(1000 * 2 ** consecutiveErrors, MAX_BACKOFF_MS);
        console.error(`[${trackingCode}] Poll error (attempt ${consecutiveErrors}), retrying in ${backoff}ms`);
        await sleep(backoff);

        // Re-navigate if the page seems broken
        if (consecutiveErrors >= 3) {
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
            await dismissCookieBanner(page);
            await page.waitForSelector("h1", { timeout: 15_000 }).catch(() => {});
          } catch {
            // will retry on next loop iteration
          }
        }
      }
    }
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    onDone?.(trackingCode);
  }
}

async function pollOnce(
  page: Page,
  trackingCode: string,
  previousSnapshot: TrackingSnapshot | null,
  destinationAddress: string | null,
): Promise<{ data: TrackingSnapshot; address: string | null } | null> {
  const pageData = await extractPageData(page);
  const gpsData = await extractGpsData(page);

  const snapshot: TrackingSnapshot = {
    restaurantName: pageData.restaurantName,
    status: pageData.status,
    eta: pageData.eta,
    gps: gpsData,
  };

  const changes = diffSnapshots(previousSnapshot, snapshot);
  if (changes.length === 0) return null;

  // Reverse geocode destination on first extraction
  let address = destinationAddress;
  if (!address && gpsData.destination) {
    address = await reverseGeocode(gpsData.destination);
  }

  const event: TrackingEvent = {
    timestamp: new Date().toISOString(),
    trackingCode,
    restaurantName: snapshot.restaurantName,
    status: snapshot.status,
    eta: snapshot.eta,
    gps: snapshot.gps,
    destinationAddress: address,
    changes,
  };

  appendEvent(event);
  console.log(`[${trackingCode}] ${changes.join(" | ")}`);

  return { data: snapshot, address };
}

async function dismissCookieBanner(page: Page): Promise<void> {
  try {
    const acceptButton = page.getByRole("button", { name: /accept/i });
    if (await acceptButton.isVisible({ timeout: 3_000 })) {
      await acceptButton.click();
      await sleep(500);
    }
  } catch {
    // No cookie banner or already dismissed
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export { extractCode };
