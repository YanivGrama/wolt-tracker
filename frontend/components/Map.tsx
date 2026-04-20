import React, { useEffect, useRef, useMemo, useState } from "react";
import type { TrackingEvent, Coordinates } from "../../src/types";
import { useLocale } from "../i18n";
import { MapIcon, Radio, CheckCircle } from "./Icons";

declare const L: typeof import("leaflet");

const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

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

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

function useDarkMode(): boolean {
  const [dark, setDark] = useState(isDarkMode);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function emojiIcon(emoji: string, size: number, borderColor: string) {
  return L.divIcon({
    className: "",
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));text-align:center;border:none;background:none">${emoji}</div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, size + 2],
    popupAnchor: [0, -(size + 2)],
  });
}

interface MapProps {
  event: TrackingEvent | null;
  courierTrail: Coordinates[];
  isDelivered?: boolean;
}

export default function Map({ event, courierTrail, isDelivered = false }: MapProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof L.map> | null>(null);
  const tileRef = useRef<ReturnType<typeof L.tileLayer> | null>(null);
  const markersRef = useRef<{
    restaurant?: ReturnType<typeof L.marker>;
    destination?: ReturnType<typeof L.marker>;
    courier?: ReturnType<typeof L.marker>;
    trail?: ReturnType<typeof L.polyline>;
  }>({});

  const hasLeaflet = useLeafletReady();
  const dark = useDarkMode();

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

    tileRef.current = L.tileLayer(
      dark ? TILE_DARK : TILE_LIGHT,
      { attribution: TILE_ATTR, maxZoom: 19 },
    ).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      markersRef.current = {};
    };
  }, [hasLeaflet]);

  useEffect(() => {
    if (!mapRef.current || !tileRef.current || !hasLeaflet) return;
    const url = dark ? TILE_DARK : TILE_LIGHT;
    tileRef.current.setUrl(url);
  }, [dark, hasLeaflet]);

  const prevGpsKey = useRef("");

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLeaflet || !event) return;

    const restaurantIcon = emojiIcon("🍽️", 32, "#16a34a");
    const destinationIcon = emojiIcon("📍", 32, "#009DE0");
    const courierIcon = emojiIcon("🛵", 30, "#f97316");

    function upsertMarker(
      key: "restaurant" | "destination" | "courier",
      coords: { lat: number; lng: number } | null,
      icon: ReturnType<typeof L.divIcon>,
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
      `<strong>${event.restaurantName}</strong><br/>${t("map.restaurant")}`,
    );

    const destPopup = event.destinationAddress
      ? `<strong>${t("map.destination")}</strong><br/>${event.destinationAddress}`
      : `<strong>${t("map.destination")}</strong>`;
    upsertMarker("destination", event.gps.destination, destinationIcon, destPopup);
    upsertMarker("courier", event.gps.courier, courierIcon, `<strong>${t("map.courier")}</strong>`);

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
  }, [event, hasLeaflet, t]);

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
        <div className="map-placeholder-title">{t("map.loading")}</div>
        <div className="map-placeholder-desc">{t("map.loadingDesc")}</div>
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
          <div className="map-placeholder-title">{t("map.delivered")}</div>
          <div className="map-placeholder-desc">{t("map.deliveredDesc")}</div>
        </div>
      );
    }
    return (
      <div className="map-placeholder">
        <div className="map-placeholder-icon">
          <Radio size={28} />
        </div>
        <div className="map-placeholder-title">{t("map.waiting")}</div>
        <div className="map-placeholder-desc">{t("map.waitingDesc")}</div>
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
