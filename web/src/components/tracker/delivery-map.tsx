"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Coordinates, TrackingEvent } from "@/lib/types";

const RESTAURANT_ICON = new L.Icon({
  iconUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2300b33c" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`,
    ),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const DESTINATION_ICON = new L.Icon({
  iconUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23009de0" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`,
    ),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const COURIER_ICON = new L.Icon({
  iconUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="10" fill="%23f97316" stroke="white" stroke-width="2"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-family="sans-serif">🛵</text></svg>`,
    ),
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

interface DeliveryMapProps {
  event: TrackingEvent | null;
  courierTrail: Coordinates[];
}

function FitBounds({
  points,
}: {
  points: Coordinates[];
}) {
  const map = useMap();
  const prevBoundsRef = useRef<string>("");

  useEffect(() => {
    if (points.length === 0) return;
    const boundsKey = points.map((p) => `${p.lat},${p.lng}`).join("|");
    if (boundsKey === prevBoundsRef.current) return;
    prevBoundsRef.current = boundsKey;

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [points, map]);

  return null;
}

export default function DeliveryMap({ event, courierTrail }: DeliveryMapProps) {
  const defaultCenter: [number, number] = [32.07, 34.78]; // Tel Aviv area

  const allPoints = useMemo(() => {
    if (!event) return [];
    const pts: Coordinates[] = [];
    if (event.gps.restaurant) pts.push(event.gps.restaurant);
    if (event.gps.destination) pts.push(event.gps.destination);
    if (event.gps.courier) pts.push(event.gps.courier);
    return pts;
  }, [event]);

  const trailLatLngs: [number, number][] = useMemo(
    () => courierTrail.map((c) => [c.lat, c.lng]),
    [courierTrail],
  );

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      className="h-full w-full rounded-lg"
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <FitBounds points={allPoints} />

      {event?.gps.restaurant && (
        <Marker
          position={[event.gps.restaurant.lat, event.gps.restaurant.lng]}
          icon={RESTAURANT_ICON}
        >
          <Popup>
            <strong>{event.restaurantName}</strong>
            <br />
            Restaurant
          </Popup>
        </Marker>
      )}

      {event?.gps.destination && (
        <Marker
          position={[event.gps.destination.lat, event.gps.destination.lng]}
          icon={DESTINATION_ICON}
        >
          <Popup>
            <strong>Delivery destination</strong>
            {event.destinationAddress && (
              <>
                <br />
                {event.destinationAddress}
              </>
            )}
          </Popup>
        </Marker>
      )}

      {event?.gps.courier && (
        <Marker
          position={[event.gps.courier.lat, event.gps.courier.lng]}
          icon={COURIER_ICON}
        >
          <Popup>
            <strong>Courier</strong>
            <br />
            {event.gps.courier.lat.toFixed(5)}, {event.gps.courier.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}

      {trailLatLngs.length > 1 && (
        <Polyline
          positions={trailLatLngs}
          pathOptions={{
            color: "#f97316",
            weight: 3,
            opacity: 0.8,
            dashArray: "6 4",
          }}
        />
      )}
    </MapContainer>
  );
}
