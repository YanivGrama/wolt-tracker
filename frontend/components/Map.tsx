import React, { useEffect, useRef, useMemo } from "react";
import type { TrackingEvent, Coordinates } from "../../src/types";

// Leaflet is loaded via CDN in tracker.html, so it's available as a global
declare const L: typeof import("leaflet");

const RESTAURANT_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2316a34a" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`,
);

const DESTINATION_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232563eb" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`,
);

const COURIER_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="13" fill="%23f97316" stroke="white" stroke-width="2"/><text x="14" y="19" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">🛵</text></svg>`,
);

interface MapProps {
  event: TrackingEvent | null;
  courierTrail: Coordinates[];
}

export default function Map({ event, courierTrail }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof L.map> | null>(null);
  const markersRef = useRef<{
    restaurant?: ReturnType<typeof L.marker>;
    destination?: ReturnType<typeof L.marker>;
    courier?: ReturnType<typeof L.marker>;
    trail?: ReturnType<typeof L.polyline>;
  }>({});

  // Check if Leaflet is available
  const hasLeaflet = typeof L !== "undefined";

  // No GPS data at all
  const hasAnyGps = useMemo(() => {
    if (!event) return false;
    return !!(event.gps.restaurant || event.gps.destination || event.gps.courier);
  }, [event]);

  // ── Initialise map ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || !hasLeaflet || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [32.07, 34.78], // Tel Aviv default
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      },
    ).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [hasLeaflet]);

  // ── Update markers when event changes ─────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLeaflet || !event) return;

    const makeIcon = (svg: string, size: [number, number], anchor: [number, number]) =>
      L.icon({
        iconUrl: `data:image/svg+xml,${svg}`,
        iconSize: size,
        iconAnchor: anchor,
        popupAnchor: [0, -anchor[1]],
      });

    const restaurantIcon = makeIcon(RESTAURANT_SVG, [32, 32], [16, 32]);
    const destinationIcon = makeIcon(DESTINATION_SVG, [32, 32], [16, 32]);
    const courierIcon = makeIcon(COURIER_SVG, [28, 28], [14, 14]);

    // Restaurant marker
    if (event.gps.restaurant) {
      const pos: [number, number] = [event.gps.restaurant.lat, event.gps.restaurant.lng];
      if (markersRef.current.restaurant) {
        markersRef.current.restaurant.setLatLng(pos);
      } else {
        markersRef.current.restaurant = L.marker(pos, { icon: restaurantIcon })
          .addTo(map)
          .bindPopup(`<strong>${event.restaurantName}</strong><br/>Restaurant`);
      }
    }

    // Destination marker
    if (event.gps.destination) {
      const pos: [number, number] = [event.gps.destination.lat, event.gps.destination.lng];
      if (markersRef.current.destination) {
        markersRef.current.destination.setLatLng(pos);
      } else {
        const popup = event.destinationAddress
          ? `<strong>Destination</strong><br/>${event.destinationAddress}`
          : "<strong>Delivery destination</strong>";
        markersRef.current.destination = L.marker(pos, { icon: destinationIcon })
          .addTo(map)
          .bindPopup(popup);
      }
    }

    // Courier marker
    if (event.gps.courier) {
      const pos: [number, number] = [event.gps.courier.lat, event.gps.courier.lng];
      if (markersRef.current.courier) {
        markersRef.current.courier.setLatLng(pos);
      } else {
        markersRef.current.courier = L.marker(pos, { icon: courierIcon })
          .addTo(map)
          .bindPopup("<strong>Courier</strong>");
      }
    } else if (markersRef.current.courier) {
      // Courier disappeared — remove marker
      markersRef.current.courier.remove();
      markersRef.current.courier = undefined;
    }

    // Fit bounds to all visible points
    const pts: [number, number][] = [];
    if (event.gps.restaurant) pts.push([event.gps.restaurant.lat, event.gps.restaurant.lng]);
    if (event.gps.destination) pts.push([event.gps.destination.lat, event.gps.destination.lng]);
    if (event.gps.courier) pts.push([event.gps.courier.lat, event.gps.courier.lng]);
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 15 });
    }
  }, [event, hasLeaflet]);

  // ── Update courier trail ───────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLeaflet) return;

    const trail: [number, number][] = courierTrail.map((c) => [c.lat, c.lng]);

    if (markersRef.current.trail) {
      markersRef.current.trail.setLatLngs(trail);
    } else if (trail.length > 1) {
      markersRef.current.trail = L.polyline(trail, {
        color: "#f97316",
        weight: 3,
        opacity: 0.7,
        dashArray: "6 5",
      }).addTo(map);
    }
  }, [courierTrail, hasLeaflet]);

  if (!hasLeaflet) {
    return (
      <div className="map-placeholder">
        <div className="map-placeholder-icon">🗺️</div>
        <p>Map loading…</p>
      </div>
    );
  }

  if (!hasAnyGps) {
    return (
      <div className="map-placeholder">
        <div className="map-placeholder-icon">📡</div>
        <p>Waiting for location data…</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", width: "100%" }}
    />
  );
}
