"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TrackingEvent, Coordinates } from "@/lib/types";

interface UseTrackerOptions {
  refreshInterval: number;
}

interface UseTrackerResult {
  events: TrackingEvent[];
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
  currentEvent: TrackingEvent | null;
  courierTrail: Coordinates[];
  isTracking: boolean;
  isLive: boolean;
  trackingCode: string | null;
  startTracking: (url: string) => Promise<void>;
  stopTracking: () => Promise<void>;
  loadLog: (code: string) => Promise<void>;
}

function extractCode(url: string): string | null {
  const match = url.match(/\/s\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

export function useTracker({ refreshInterval }: UseTrackerOptions): UseTrackerResult {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingUrlRef = useRef<string | null>(null);

  const currentEvent = events[currentIndex] ?? null;

  // Build courier trail up to the current event index
  const courierTrail: Coordinates[] = [];
  for (let i = 0; i <= currentIndex; i++) {
    const ev = events[i];
    if (ev?.gps.courier) {
      const prev = courierTrail[courierTrail.length - 1];
      if (!prev || prev.lat !== ev.gps.courier.lat || prev.lng !== ev.gps.courier.lng) {
        courierTrail.push(ev.gps.courier);
      }
    }
  }

  // When user moves slider, stop following live
  const handleIndexChange = useCallback(
    (i: number) => {
      setCurrentIndex(i);
      setIsLive(i === events.length - 1);
    },
    [events.length],
  );

  // Poll for new events
  const pollEvents = useCallback(async () => {
    if (!trackingCode) return;

    try {
      const lastTimestamp =
        events.length > 0 ? events[events.length - 1]!.timestamp : undefined;
      const params = new URLSearchParams({ code: trackingCode });
      if (lastTimestamp) params.set("after", lastTimestamp);

      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      const newEvents: TrackingEvent[] = data.events;

      if (newEvents.length > 0) {
        setEvents((prev) => {
          const merged = lastTimestamp ? [...prev, ...newEvents] : newEvents;
          return merged;
        });
      }
    } catch {
      // Silently retry next interval
    }
  }, [trackingCode, events]);

  // Keep current index at latest when isLive
  useEffect(() => {
    if (isLive && events.length > 0) {
      setCurrentIndex(events.length - 1);
    }
  }, [events.length, isLive]);

  // Set up polling interval
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (trackingCode) {
      pollEvents();
      pollRef.current = setInterval(pollEvents, refreshInterval);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [trackingCode, refreshInterval, pollEvents]);

  const startTracking = useCallback(async (url: string) => {
    const code = extractCode(url);
    if (!code) return;

    trackingUrlRef.current = url;
    setTrackingCode(code);
    setEvents([]);
    setCurrentIndex(0);
    setIsLive(true);
    setIsTracking(true);

    try {
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, action: "start" }),
      });
    } catch {
      // Tracker might already be running externally
    }
  }, []);

  const stopTracking = useCallback(async () => {
    if (trackingUrlRef.current) {
      try {
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trackingUrlRef.current, action: "stop" }),
        });
      } catch {
        // ignore
      }
    }
    setIsTracking(false);
  }, []);

  const loadLog = useCallback(async (code: string) => {
    setTrackingCode(code);
    setIsTracking(false);
    setIsLive(false);

    try {
      const res = await fetch(`/api/events?code=${code}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events);
      setCurrentIndex(0);
    } catch {
      // ignore
    }
  }, []);

  return {
    events,
    currentIndex,
    setCurrentIndex: handleIndexChange,
    currentEvent,
    courierTrail,
    isTracking,
    isLive,
    trackingCode,
    startTracking,
    stopTracking,
    loadLog,
  };
}
