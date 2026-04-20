import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import { useTracker } from "./hooks/useTracker";
import StatusPanel from "./components/StatusPanel";
import Timeline from "./components/Timeline";
import DeliveryComplete from "./components/DeliveryComplete";
import ThemeToggle from "./components/ThemeToggle";
import LanguageToggle from "./components/LanguageToggle";
import ResizeHandle from "./components/ResizeHandle";
import { ArrowLeft, Share2, Bell, BellRing, Search, CircleHelp } from "./components/Icons";
import { LocaleProvider, useLocale } from "./i18n";

const Map = lazy(() => import("./components/Map"));

const PANEL_WIDTH_KEY = "wolt-tracker-panel-width";
const DEFAULT_PANEL_WIDTH = 360;

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
  const { t } = useLocale();
  const [toast, setToast] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  function share() {
    const url = `${location.origin}/track/${code}`;
    if (navigator.share) {
      navigator.share({ title: t("tracker.share.title"), url }).catch(() => {});
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
      <button className="icon-btn" onClick={share} title={t("tracker.share.title")} aria-label={t("tracker.share.title")}>
        <Share2 size={13} />
        {t("tracker.share")}
      </button>

      {toast && (
        <div className="share-toast">{t("tracker.share.toast")}</div>
      )}

      {showFallback && (
        <div className="share-overlay" onClick={() => setShowFallback(false)}>
          <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="share-dialog-label">{t("tracker.share.label")}</p>
            <input
              readOnly
              className="share-dialog-input"
              value={`${location.origin}/track/${code}`}
              dir="ltr"
              onFocus={(e) => e.target.select()}
            />
            <button className="share-dialog-close" onClick={() => setShowFallback(false)}>
              {t("tracker.share.done")}
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
  const { t } = useLocale();
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
      title={notifState === "on" ? t("tracker.notif.disable") : t("tracker.notif.enable")}
      aria-label={notifState === "on" ? t("tracker.notif.disable") : t("tracker.notif.enable")}
    >
      {notifState === "on" ? (
        <>
          <BellRing size={13} />
          {t("tracker.notif.on")}
        </>
      ) : (
        <>
          <Bell size={13} />
          {t("tracker.notif.off")}
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────
// Not found page
// ─────────────────────────────────────────

function NotFound({ code }: { code: string }) {
  const { t } = useLocale();
  return (
    <div className="not-found-state">
      <Search size={48} className="not-found-icon" />
      <h2>{t("tracker.notfound.title")}</h2>
      <p>
        {t("tracker.notfound.desc1")}{" "}
        <code dir="ltr" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{code}</code>.{" "}
        {t("tracker.notfound.desc2")}
      </p>
      <a href="/" className="new-track-btn">
        {t("tracker.notfound.btn")}
      </a>
    </div>
  );
}

// ─────────────────────────────────────────
// Main tracker page
// ─────────────────────────────────────────

function TrackerPage({ code }: { code: string }) {
  const { t } = useLocale();
  const tracker = useTracker(code);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = localStorage.getItem(PANEL_WIDTH_KEY);
    return stored ? Number(stored) : DEFAULT_PANEL_WIDTH;
  });

  const handleResize = useCallback((w: number) => {
    setPanelWidth(w);
    localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(w)));
  }, []);

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
            <a href="/" className="back-btn" title={t("tracker.back")} aria-label={t("tracker.back")}>
              <ArrowLeft size={16} />
            </a>
            <div className="tracker-brand">
              <div className="tracker-brand-icon">🛵</div>
              <span className="tracker-brand-name">{t("brand")}</span>
            </div>
            <span className="tracker-code-pill" dir="ltr">{code}</span>
          </div>
          <div className="tracker-header-actions">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        <div className="loading-state">
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <p>{t("tracker.connecting")}</p>
        </div>
      </div>
    );
  }

  if (initialLoadDone && tracker.events.length === 0) {
    return <NotFound code={code} />;
  }

  const gridCols = `1fr auto ${panelWidth}px`;

  return (
    <div className="tracker">
      <header className="tracker-header">
        <div className="tracker-header-left">
          <a href="/" className="back-btn" title={t("tracker.back")} aria-label={t("tracker.back")}>
            <ArrowLeft size={16} />
          </a>
          <div className="tracker-brand">
            <div className="tracker-brand-icon">🛵</div>
            <span className="tracker-brand-name">{t("brand")}</span>
          </div>
          <span className="tracker-code-pill" dir="ltr">{code}</span>
        </div>

        <div className="tracker-header-actions">
          <ShareButton code={code} />
          {!isDelivered && <NotificationButton code={code} />}
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div
        className="tracker-main"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="map-container">
          <Suspense fallback={
            <div className="map-placeholder">
              <div className="map-placeholder-icon">🗺️</div>
              <p>{t("map.loading")}</p>
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
                <div className="delivered-badge-title">{t("tracker.delivered")}</div>
                <div className="delivered-badge-sub">{t("tracker.delivered.sub")}</div>
              </div>
            </div>
          ) : tracker.currentEvent?.eta.minutes != null && (
            <div className="eta-badge">
              <div className="eta-badge-num" dir="ltr">{tracker.currentEvent.eta.minutes}</div>
              <div className="eta-badge-label">{t("tracker.eta.min")}</div>
            </div>
          )}
        </div>

        <ResizeHandle onResize={handleResize} />

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
  const { t } = useLocale();
  const code = location.pathname.replace(/^\/track\//, "").split("?")[0]?.trim();

  if (!code) {
    return (
      <div className="not-found-state">
        <CircleHelp size={48} className="not-found-icon" />
        <h2>{t("tracker.invalid.title")}</h2>
        <p>{t("tracker.invalid.desc")}</p>
        <a href="/" className="new-track-btn">{t("tracker.invalid.btn")}</a>
      </div>
    );
  }

  return <TrackerPage code={code} />;
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <LocaleProvider>
    <App />
  </LocaleProvider>,
);
