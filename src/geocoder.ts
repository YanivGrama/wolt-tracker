import type { Coordinates } from "./types.ts";

const cache = new Map<string, string>();
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100;

function cacheKey(coords: Coordinates): string {
  return `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Reverse-geocodes a coordinate pair to a human-readable address using
 * OpenStreetMap Nominatim. Results are cached to avoid redundant requests.
 * Respects Nominatim's 1 request/second rate limit.
 */
export async function reverseGeocode(coords: Coordinates): Promise<string | null> {
  const key = cacheKey(coords);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    await throttle();

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(coords.lat));
    url.searchParams.set("lon", String(coords.lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "WoltTracker/1.0 (personal delivery tracking tool)",
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };

    const address = data.display_name ?? null;
    if (address) {
      cache.set(key, address);
    }
    return address;
  } catch {
    return null;
  }
}
