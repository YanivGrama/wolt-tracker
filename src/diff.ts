import type { TrackingSnapshot, Coordinates } from "./types.ts";

const GPS_TOLERANCE = 0.0001; // ~11 meters

function coordsEqual(a: Coordinates | null, b: Coordinates | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    Math.abs(a.lat - b.lat) < GPS_TOLERANCE &&
    Math.abs(a.lng - b.lng) < GPS_TOLERANCE
  );
}

function formatCoord(c: Coordinates | null): string {
  if (!c) return "unknown";
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

/**
 * Compares two tracking snapshots and returns a list of human-readable change
 * descriptions. Returns an empty array if nothing meaningful changed.
 */
export function diffSnapshots(
  prev: TrackingSnapshot | null,
  curr: TrackingSnapshot,
): string[] {
  if (!prev) {
    return [`Initial tracking: ${curr.restaurantName} — step ${curr.status.step} (${curr.status.label}), ETA ${curr.eta.minutes ?? "?"} min`];
  }

  const changes: string[] = [];

  if (prev.status.step !== curr.status.step || prev.status.label !== curr.status.label) {
    changes.push(
      `Status: step ${prev.status.step} "${prev.status.label}" → step ${curr.status.step} "${curr.status.label}"`,
    );
  }

  if (prev.eta.minutes !== curr.eta.minutes) {
    const prevEta = prev.eta.minutes ?? "?";
    const currEta = curr.eta.minutes ?? "?";
    changes.push(`ETA: ${prevEta} min → ${currEta} min`);
  }

  if (!coordsEqual(prev.gps.restaurant, curr.gps.restaurant)) {
    changes.push(
      `Restaurant GPS: ${formatCoord(prev.gps.restaurant)} → ${formatCoord(curr.gps.restaurant)}`,
    );
  }

  if (!coordsEqual(prev.gps.destination, curr.gps.destination)) {
    changes.push(
      `Destination GPS: ${formatCoord(prev.gps.destination)} → ${formatCoord(curr.gps.destination)}`,
    );
  }

  if (!coordsEqual(prev.gps.courier, curr.gps.courier)) {
    if (!prev.gps.courier && curr.gps.courier) {
      changes.push(`Courier appeared at ${formatCoord(curr.gps.courier)}`);
    } else if (prev.gps.courier && !curr.gps.courier) {
      changes.push(`Courier position lost`);
    } else {
      changes.push(
        `Courier moved: ${formatCoord(prev.gps.courier)} → ${formatCoord(curr.gps.courier)}`,
      );
    }
  }

  if (prev.restaurantName !== curr.restaurantName) {
    changes.push(`Restaurant name: "${prev.restaurantName}" → "${curr.restaurantName}"`);
  }

  return changes;
}
