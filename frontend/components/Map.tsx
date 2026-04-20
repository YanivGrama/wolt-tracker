import React, { useEffect, useRef, useMemo, useState } from "react";
import type { TrackingEvent, Coordinates } from "../../src/types";
import { MapIcon, Radio, CheckCircle } from "./Icons";

declare const L: typeof import("leaflet");

function useLeafletReady(): boolean {
  const [ready, setReady] = useState(typeof L !== "undefined");
  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => {
      if (typeof L !== "undefined") {
        setReady(true);
        clearInterval(id);
      }
    }, 100);
    const timeout = setTimeout(() => clearInterval(id), 15_000);
    return () => { clearInterval(id); clearTimeout(timeout); };
  }, [ready]);
  return ready;
}

const RESTAURANT_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2316a34a" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`,
);

const DESTINATION_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23009DE0" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`,
);

const COURIER_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="13" fill="%23f97316" stroke="white" stroke-width="2"/><text x="14" y="19" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">🛵</text></svg>`,
);

interface MapProps {
  event: TrackingEvent | null;
  courierTrail: Coordinates[];
  isDelivered?: boolean;
}

export default function Map({ event, courierTrail, isDelivered = false }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof L.map> | null>(null);
  const markersRef = useRef<{
    restaurant?: ReturnType<typeof L.marker>;
    destination?: ReturnType<typeof L.marker>;
    courier?: ReturnType<typeof L.marker>;
    trail?: ReturnType<typeof L.polyline>;
  }>({});

  const hasLeaflet = useLeafletReady();

  const hasAnyGps = useMemo(() => {
    if (!event) return false;
    return !!(event.gps.restaurant || event.gps.destination || event.gps.courier);
  }, [event]);

  useEffect(() => {
    if (!containerRef.current || !hasLeaflet || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [32.07, 34.78],
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

  const prevGpsKey = useRef("");

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

    function upsertMarker(
      key: "restaurant" | "destination" | "courier",
      coords: { lat: number; lng: number } | null,
      icon: ReturnType<typeof L.icon>,
      popup: string,
    ) {
      if (coords) {
        const pos: [number, number] = [coords.lat, coords.lng];
        if (markersRef.current[key]) {
          markersRef.current[key]!.setLatLng(pos);
        } else {
          markersRef.current[key] = L.marker(pos, { icon }).addTo(map).bindPopup(popup);
        }
      } else if (markersRef.current[key]) {
        markersRef.current[key]!.remove();
        markersRef.current[key] = undefined;
      }
    }

    upsertMarker(
      "restaurant",
      event.gps.restaurant,
      restaurantIcon,
      `<strong>${event.restaurantName}</strong><br/>Restaurant`,
    );

    const destPopup = event.destinationAddress
      ? `<strong>Destination</strong><br/>${event.destinationAddress}`
      : "<strong>Delivery destination</strong>";
    upsertMarker("destination", event.gps.destination, destinationIcon, destPopup);
    upsertMarker("courier", event.gps.courier, courierIcon, "<strong>Courier</strong>");

    const gpsKey = [
      event.gps.restaurant ? `r:${event.gps.restaurant.lat},${event.gps.restaurant.lng}` : "",
      event.gps.destination ? `d:${event.gps.destination.lat},${event.gps.destination.lng}` : "",
      event.gps.courier ? `c:${event.gps.courier.lat},${event.gps.courier.lng}` : "",
    ].join("|");

    if (gpsKey !== prevGpsKey.current) {
      prevGpsKey.current = gpsKey;
      const pts: [number, number][] = [];
      if (event.gps.restaurant) pts.push([event.gps.restaurant.lat, event.gps.restaurant.lng]);
      if (event.gps.destination) pts.push([event.gps.destination.lat, event.gps.destination.lng]);
      if (event.gps.courier) pts.push([event.gps.courier.lat, event.gps.courier.lng]);
      if (pts.length > 0) {
        map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [event, hasLeaflet]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLeaflet) return;

    const trail: [number, number][] = courierTrail.map((c) => [c.lat, c.lng]);

    if (markersRef.current.trail) {
      if (trail.length <= 1) {
        markersRef.current.trail.remove();
        markersRef.current.trail = undefined;
      } else {
        markersRef.current.trail.setLatLngs(trail);
      }
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
        <div className="map-placeholder-icon">
          <MapIcon size={28} />
        </div>
        <div className="map-placeholder-title">Map loading…</div>
        <div className="map-placeholder-desc">Fetching tiles, one sec.</div>
      </div>
    );
  }

  if (!hasAnyGps) {
    if (isDelivered) {
      return (
        <div className="map-placeholder delivered">
          <div className="map-placeholder-icon">
            <CheckCircle size={28} />
          </div>
          <div className="map-placeholder-title">Delivered</div>
          <div className="map-placeholder-desc">
            Your order arrived. Location data isn't available for this delivery.
          </div>
        </div>
      );
    }
    return (
      <div className="map-placeholder">
        <div className="map-placeholder-icon">
          <Radio size={28} />
        </div>
        <div className="map-placeholder-title">Waiting for location…</div>
        <div className="map-placeholder-desc">
          We'll pin the courier as soon as GPS data comes through.
        </div>
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
