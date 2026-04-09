import type { Page } from "playwright";
import type { GpsData } from "./types.ts";

/**
 * Extracts GPS coordinates from Mapbox GL markers on the Wolt tracking page.
 *
 * Strategy:
 * 1. Find the Mapbox map instance through React fiber internals
 * 2. Parse pixel-based CSS transforms from .mapboxgl-marker elements
 * 3. Use map.unproject() to convert pixel coordinates to lat/lng
 * 4. Identify markers by their child element's aria-label
 */
export async function extractGpsData(page: Page): Promise<GpsData> {
  return page.evaluate(() => {
    const result: {
      restaurant: { lat: number; lng: number } | null;
      destination: { lat: number; lng: number } | null;
      courier: { lat: number; lng: number } | null;
    } = {
      restaurant: null,
      destination: null,
      courier: null,
    };

    const mapContainer = document.querySelector(".mapboxgl-map");
    if (!mapContainer) return result;

    // Find the Mapbox map instance via React fiber tree
    const mapInstance = findMapInstance(mapContainer);
    if (!mapInstance || typeof mapInstance.unproject !== "function") return result;

    const markerEls = document.querySelectorAll(".mapboxgl-marker");
    if (markerEls.length === 0) return result;

    for (const el of markerEls) {
      const htmlEl = el as HTMLElement;
      const transform = htmlEl.style.transform;
      const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
      if (!match) continue;

      const x = parseFloat(match[1]!);
      const y = parseFloat(match[2]!);

      let lngLat: { lat: number; lng: number };
      try {
        const unprojected = mapInstance.unproject([x, y]);
        lngLat = { lat: unprojected.lat, lng: unprojected.lng };
      } catch {
        continue;
      }

      // Identify the marker by the aria-label on its child element
      const childLabel = htmlEl.querySelector("[aria-label]")?.getAttribute("aria-label")?.toLowerCase() ?? "";
      const innerHTML = htmlEl.innerHTML.toLowerCase();

      if (childLabel.includes("courier") || childLabel.includes("driver") || innerHTML.includes("couriermarker")) {
        result.courier = lngLat;
      } else if (childLabel.includes("store") || childLabel.includes("restaurant") || childLabel.includes("venue") || innerHTML.includes("venuemarker")) {
        result.restaurant = lngLat;
      } else if (childLabel.includes("delivery") || childLabel.includes("destination") || childLabel.includes("your")) {
        result.destination = lngLat;
      }
    }

    return result;

    function findMapInstance(container: Element): any {
      // Walk the React fiber tree from the map container to find the map ref
      const fiberKey = Object.keys(container).find(
        (k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"),
      );
      if (!fiberKey) return null;

      let fiber = (container as any)[fiberKey];
      const visited = new Set<any>();

      // Walk up the fiber tree (return pointers)
      for (let depth = 0; depth < 50 && fiber; depth++) {
        if (visited.has(fiber)) break;
        visited.add(fiber);

        // Check memoizedState chain for a ref containing the map
        let state = fiber.memoizedState;
        for (let i = 0; i < 20 && state; i++) {
          const ms = state.memoizedState;
          if (ms && typeof ms === "object") {
            // Direct map instance
            if (typeof ms.getCenter === "function" && typeof ms.unproject === "function") {
              return ms;
            }
            // React ref: { current: mapInstance }
            if (ms.current && typeof ms.current === "object" &&
                typeof ms.current.getCenter === "function" &&
                typeof ms.current.unproject === "function") {
              return ms.current;
            }
          }
          state = state.next;
        }

        // Check memoizedProps
        if (fiber.memoizedProps) {
          for (const val of Object.values(fiber.memoizedProps)) {
            if (val && typeof val === "object" &&
                typeof (val as any).getCenter === "function" &&
                typeof (val as any).unproject === "function") {
              return val;
            }
          }
        }

        fiber = fiber.return;
      }

      return null;
    }
  });
}
