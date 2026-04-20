import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import { useTracker } from "./hooks/useTracker";
import StatusPanel from "./components/StatusPanel";
import Timeline from "./components/Timeline";
import DeliveryComplete from "./components/DeliveryComplete";
import ThemeToggle from "./components/ThemeToggle";
import { ArrowLeft, Share2, Bell, BellRing, Search, CircleHelp } from "./components/Icons";

const Map = lazy(() => import("./components/Map"));

// ─────────────────────────────────────────
// Push notification helpers
// ─────────────────────────────────────────

async function getVapidKey(): Promise<string> {
  try {
    const res = await fetch("/api/vapid-public-key");
    const data = (await res.json()) as { publicKey?: string };
    return data.publicKey ?? "";
  } catch {
    return "";
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush(code: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const vapidKey = await getVapidKey();
  if (!vapidKey) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), code }),
    });

    return true;
  } catch {
    return false;
  }
}

async function unsubscribeFromPush(code: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push-unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, code }),
    });
    await sub.unsubscribe();
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────
// Share button
// ─────────────────────────────────────────

function ShareButton({ code }: { code: string }) {
  const [toast, setToast] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  function share() {
    const url = `${location.origin}/track/${code}`;
    if (navigator.share) {
      navigator.share({ title: "Wolt delivery tracking", url }).catch(() => {});
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setToast(true);
        setTimeout(() => setToast(false), 2200);
      });
    } else {
      setShowFallback(true);
    }
  }

  return (
    <>
      <button className="icon-btn" onClick={share} title="Share tracking link" aria-label="Share tracking link">
        <Share2 size={13} />
        Share
      </button>

      {toast && (
        <div className="share-toast">Link copied to clipboard</div>
      )}

      {showFallback && (
        <div className="share-overlay" onClick={() => setShowFallback(false)}>
          <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="share-dialog-label">Copy this link:</p>
            <input
              readOnly
              className="share-dialog-input"
              value={`${location.origin}/track/${code}`}
              onFocus={(e) => e.target.select()}
            />
            <button className="share-dialog-close" onClick={() => setShowFallback(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────
// Notification toggle button
// ─────────────────────────────────────────

function NotificationButton({ code }: { code: string }) {
  const [notifState, setNotifState] = useState<"on" | "off" | "unsupported">("off");

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotifState("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setNotifState(sub ? "on" : "off"))
        .catch(() => setNotifState("off"));
    }
  }, []);

  async function toggle() {
    if (notifState === "unsupported") return;

    if (notifState === "on") {
      await unsubscribeFromPush(code);
      setNotifState("off");
      return;
    }

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;

    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/sw.js");
    }

    const ok = await subscribeToPush(code);
    if (ok) setNotifState("on");
  }

  if (notifState === "unsupported") return null;

  return (
    <button
      className={`icon-btn${notifState === "on" ? " active" : ""}`}
      onClick={toggle}
      title={notifState === "on" ? "Disable notifications" : "Enable notifications"}
      aria-label={notifState === "on" ? "Disable notifications" : "Enable notifications"}
    >
      {notifState === "on" ? (
        <>
          <BellRing size={13} />
          Notifs on
        </>
      ) : (
        <>
          <Bell size={13} />
          Notify me
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────
// Not found page
// ─────────────────────────────────────────

function NotFound({ code }: { code: string }) {
  return (
    <div className="not-found-state">
      <Search size={48} className="not-found-icon" />
      <h2>No tracking data found</h2>
      <p>
        We couldn't find any data for <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{code}</code>.
        The link may be expired or the tracking hasn't started yet.
      </p>
      <a href="/" className="new-track-btn">
        Track a new delivery
      </a>
    </div>
  );
}

// ─────────────────────────────────────────
// Main tracker page
// ─────────────────────────────────────────

function TrackerPage({ code }: { code: string }) {
  const tracker = useTracker(code);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setInitialLoadDone(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (tracker.events.length > 0) setInitialLoadDone(true);
  }, [tracker.events.length]);

  useEffect(() => {
    const ev = tracker.currentEvent;
    if (!ev) {
      document.title = `Tracking ${code} – Wolt Tracker`;
      return;
    }
    const eta = ev.eta.minutes !== null ? `${ev.eta.minutes} min – ` : "";
    document.title = `${eta}${ev.restaurantName} – Wolt Tracker`;
  }, [tracker.currentEvent, code]);

  const isDelivered = tracker.currentEvent?.status.step === 5;

  if (!initialLoadDone && tracker.events.length === 0) {
    return (
      <div className="tracker">
        <header className="tracker-header">
          <div className="tracker-header-left">
            <a href="/" className="back-btn" title="Back to home" aria-label="Back to home">
              <ArrowLeft size={16} />
            </a>
            <div className="tracker-brand">
              <div className="tracker-brand-icon">🛵</div>
              <span className="tracker-brand-name">Wolt Tracker</span>
            </div>
            <span className="tracker-code-pill">{code}</span>
          </div>
          <div className="tracker-header-actions">
            <ThemeToggle />
          </div>
        </header>
        <div className="loading-state">
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <p>Connecting to tracker…</p>
        </div>
      </div>
    );
  }

  if (initialLoadDone && tracker.events.length === 0) {
    return <NotFound code={code} />;
  }

  return (
    <div className="tracker">
      <header className="tracker-header">
        <div className="tracker-header-left">
          <a href="/" className="back-btn" title="Back to home" aria-label="Back to home">
            <ArrowLeft size={16} />
          </a>
          <div className="tracker-brand">
            <div className="tracker-brand-icon">🛵</div>
            <span className="tracker-brand-name">Wolt Tracker</span>
          </div>
          <span className="tracker-code-pill">{code}</span>
        </div>

        <div className="tracker-header-actions">
          <ShareButton code={code} />
          {!isDelivered && <NotificationButton code={code} />}
          <ThemeToggle />
        </div>
      </header>

      <div className="tracker-main">
        <div className="map-container">
          <Suspense fallback={
            <div className="map-placeholder">
              <div className="map-placeholder-icon">🗺️</div>
              <p>Loading map…</p>
            </div>
          }>
            <Map
              event={tracker.currentEvent}
              courierTrail={tracker.courierTrail}
              isDelivered={isDelivered}
            />
          </Suspense>

          {isDelivered ? (
            <div className="delivered-badge">
              <div className="delivered-badge-icon">✓</div>
              <div>
                <div className="delivered-badge-title">Delivered</div>
                <div className="delivered-badge-sub">Order complete</div>
              </div>
            </div>
          ) : tracker.currentEvent?.eta.minutes != null && (
            <div className="eta-badge">
              <div className="eta-badge-num">{tracker.currentEvent.eta.minutes}</div>
              <div className="eta-badge-label">min to delivery</div>
            </div>
          )}
        </div>

        <div className="tracker-panel">
          <div className="tracker-panel-scroll">
            {isDelivered && tracker.events.length > 0 && (
              <DeliveryComplete
                firstEvent={tracker.events[0]!}
                lastEvent={tracker.events[tracker.events.length - 1]!}
              />
            )}

            <StatusPanel
              event={tracker.currentEvent}
              prevEvent={tracker.currentIndex > 0 ? tracker.events[tracker.currentIndex - 1] ?? null : null}
              isLive={tracker.isLive}
              isTrackerActive={tracker.isTrackerActive}
              connectionStatus={tracker.connectionStatus}
            />
          </div>

          {tracker.events.length > 0 && (
            <div className="timeline-footer">
              <Timeline
                events={tracker.events}
                currentIndex={tracker.currentIndex}
                isLive={tracker.isLive}
                onIndexChange={tracker.setCurrentIndex}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Bootstrap: extract code from URL
// ─────────────────────────────────────────

function App() {
  const code = location.pathname.replace(/^\/track\//, "").split("?")[0]?.trim();

  if (!code) {
    return (
      <div className="not-found-state">
        <CircleHelp size={48} className="not-found-icon" />
        <h2>Invalid tracking URL</h2>
        <p>No tracking code found in the URL.</p>
        <a href="/" className="new-track-btn">Go home</a>
      </div>
    );
  }

  return <TrackerPage code={code} />;
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
