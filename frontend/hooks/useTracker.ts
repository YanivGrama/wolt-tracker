import { useState, useEffect, useCallback, useRef } from "react";
import type { TrackingEvent, Coordinates } from "../../src/types";

export type ConnectionStatus = "connecting" | "live" | "polling" | "reconnecting" | "idle";

export interface UseTrackerResult {
  events: TrackingEvent[];
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
  currentEvent: TrackingEvent | null;
  courierTrail: Coordinates[];
  isLive: boolean;
  isTrackerActive: boolean;
  connectionStatus: ConnectionStatus;
  /** Fetch full history for a code (history replay mode) */
  loadHistory: (code: string) => Promise<void>;
}

export function useTracker(code: string): UseTrackerResult {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [isTrackerActive, setIsTrackerActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollTs = useRef<string>("");
  const isMountedRef = useRef(true);

  // ── Event helpers ──────────────────────────────────────────────────────────

  const appendEvents = useCallback((newEvents: TrackingEvent[]) => {
    if (!isMountedRef.current) return;
    setEvents((prev) => {
      const existingTs = new Set(prev.map((e) => e.timestamp));
      const unique = newEvents.filter((e) => !existingTs.has(e.timestamp));
      if (unique.length === 0) return prev;
      const merged = [...prev, ...unique].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp),
      );
      if (unique[unique.length - 1]) {
        lastPollTs.current = unique[unique.length - 1]!.timestamp;
      }
      return merged;
    });
  }, []);

  // ── Polling fallback ───────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setConnectionStatus("polling");

    pollRef.current = setInterval(async () => {
      if (!isMountedRef.current) return;
      try {
        const after = lastPollTs.current;
        const params = new URLSearchParams({ code });
        if (after) params.set("after", after);
        const res = await fetch(`/api/events?${params}`);
        if (!res.ok) return;
        const data = (await res.json()) as { events: TrackingEvent[] };
        appendEvents(data.events ?? []);
      } catch {
        // Silently retry
      }
    }, 2000);
  }, [code, appendEvents]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────

  const connectWs = useCallback(() => {
    if (!isMountedRef.current) return;

    wsRef.current?.close();
    setConnectionStatus("connecting");

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws/${code}`);
    wsRef.current = ws;

    // Keepalive ping every 25s
    let pingInterval: ReturnType<typeof setInterval>;

    ws.onopen = () => {
      if (!isMountedRef.current) { ws.close(); return; }
      reconnectAttempts.current = 0;
      stopPolling();
      setConnectionStatus("live");
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
    };

    ws.onmessage = (e) => {
      if (!isMountedRef.current) return;
      let msg: { type: string; event?: TrackingEvent; active?: boolean };
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }

      if (msg.type === "event" && msg.event) {
        appendEvents([msg.event]);
      } else if (msg.type === "delivered") {
        if (msg.event) appendEvents([msg.event]);
        setIsTrackerActive(false);
      } else if (msg.type === "tracker_stopped") {
        setIsTrackerActive(false);
      } else if (msg.type === "status") {
        setIsTrackerActive(msg.active ?? false);
      }
    };

    ws.onerror = () => {
      /* handled in onclose */
    };

    ws.onclose = () => {
      clearInterval(pingInterval);
      if (!isMountedRef.current) return;
      setConnectionStatus("reconnecting");
      startPolling(); // fall back to polling while reconnecting

      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30_000);
      reconnectAttempts.current++;

      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) connectWs();
      }, delay);
    };
  }, [code, appendEvents, startPolling, stopPolling]);

  // ── Initial load + WS connect ─────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;

    // Load existing events first
    fetch(`/api/events?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data: { events: TrackingEvent[] }) => {
        if (!isMountedRef.current) return;
        const evts = data.events ?? [];
        setEvents(evts);
        if (evts.length > 0) {
          lastPollTs.current = evts[evts.length - 1]!.timestamp;
          setCurrentIndexState(evts.length - 1);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMountedRef.current) connectWs();
      });

    // Also check /api/status to know if tracker is live
    fetch(`/api/status/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data: { active: boolean }) => {
        if (isMountedRef.current) setIsTrackerActive(data.active);
      })
      .catch(() => {});

    return () => {
      isMountedRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
      stopPolling();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-advance to latest when isLive ─────────────────────────────────────

  useEffect(() => {
    if (isLive && events.length > 0) {
      setCurrentIndexState(events.length - 1);
    }
  }, [events.length, isLive]);

  // ── Public index setter ────────────────────────────────────────────────────

  const setCurrentIndex = useCallback(
    (i: number) => {
      setCurrentIndexState(i);
      setIsLive(i === events.length - 1);
    },
    [events.length],
  );

  // ── History loader (for replaying old deliveries) ─────────────────────────

  const loadHistory = useCallback(async (histCode: string) => {
    try {
      const res = await fetch(`/api/events?code=${encodeURIComponent(histCode)}`);
      const data = (await res.json()) as { events: TrackingEvent[] };
      const evts = data.events ?? [];
      setEvents(evts);
      setCurrentIndexState(0);
      setIsLive(false);
      if (evts.length > 0) lastPollTs.current = evts[evts.length - 1]!.timestamp;
    } catch {
      // ignore
    }
  }, []);

  // ── Courier trail ──────────────────────────────────────────────────────────

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

  return {
    events,
    currentIndex,
    setCurrentIndex,
    currentEvent: events[currentIndex] ?? null,
    courierTrail,
    isLive,
    isTrackerActive,
    connectionStatus,
    loadHistory,
  };
}
