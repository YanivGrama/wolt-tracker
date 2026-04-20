import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import { Zap, Bell, LinkIcon, Link2, AlertCircle } from "./components/Icons";
import ThemeToggle from "./components/ThemeToggle";
import { LocaleProvider, useLocale, timeLocale } from "./i18n";

const WOLT_URL_RE = /https?:\/\/track\.wolt\.com\/(?:[^/]+\/)?s\/([A-Za-z0-9_-]+)/;

interface LogEntry {
  code: string;
  restaurantName: string;
  eventCount: number;
  startedAt?: string;
  lastUpdatedAt?: string;
  lastStep: number;
  isActive?: boolean;
}

function stepColor(step: number): string {
  if (step >= 5) return "var(--step-5)";
  if (step >= 4) return "var(--step-4)";
  if (step >= 3) return "var(--step-3)";
  return "var(--step-inactive)";
}

function cardStepClass(step: number): string {
  if (step >= 5) return "step-delivered";
  if (step >= 4) return "step-active";
  if (step >= 3) return "step-preparing";
  return "step-default";
}

function durationStr(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return "";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function RecentDeliveries() {
  const { t, locale } = useLocale();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  function stepLabel(step: number): string {
    return t(`step.${step}` as any);
  }

  function timeAgo(iso?: string): string {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t("time.justNow");
    if (mins < 60) return t("time.mAgo", { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("time.hAgo", { n: hours });
    return new Date(iso).toLocaleDateString(timeLocale(locale));
  }

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((data: { logs: LogEntry[] }) => setLogs(data.logs?.slice(0, 8) ?? []))
      .catch(() => {});
  }, []);

  if (logs.length === 0) return null;

  return (
    <div className="recent-section">
      <div className="recent-label">{t("landing.recent.title")}</div>
      <div className="recent-grid">
        {logs.map((log) => {
          const dur = durationStr(log.startedAt, log.lastUpdatedAt);
          return (
            <a
              key={log.code}
              href={`/track/${log.code}`}
              className={`recent-card ${cardStepClass(log.lastStep)}`}
            >
              <div className="recent-card-name">{log.restaurantName}</div>
              <div className="recent-card-meta" dir="ltr">{log.code.slice(0, 14)}…</div>
              <div className="recent-card-status">
                <div
                  className="step-dot"
                  style={{ background: stepColor(log.lastStep) }}
                />
                <span className="recent-card-step">
                  {stepLabel(log.lastStep)}
                </span>
                {log.lastUpdatedAt && (
                  <span className="recent-card-time">
                    {timeAgo(log.lastUpdatedAt)}
                  </span>
                )}
              </div>
              {(dur || log.eventCount > 0) && (
                <div className="recent-card-duration">
                  {dur && <span>{dur} {t("landing.recent.total")}</span>}
                  {dur && log.eventCount > 0 && <span> · </span>}
                  {log.eventCount > 0 && (
                    <span className="recent-card-events">{log.eventCount} {t("landing.recent.events")}</span>
                  )}
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function LandingPage() {
  const { t } = useLocale();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleUrl(raw: string) {
    const url = raw.trim();
    if (!url) { setError(""); return; }

    const match = url.match(WOLT_URL_RE);
    if (!match) {
      setError(t("landing.error.invalid"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = (await res.json()) as { code?: string; error?: string };

      if (!res.ok || !data.code) {
        setError(data.error ?? t("landing.error.generic"));
        setLoading(false);
        return;
      }

      window.location.href = `/track/${data.code}`;
    } catch {
      setError(t("landing.error.network"));
      setLoading(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    setTimeout(() => handleUrl(pasted), 0);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setValue(val);
    setError("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleUrl(value);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleUrl(value);
  }

  const hasValue = value.trim().length > 0;

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-logo">🛵</div>
        <span className="landing-title">{t("brand")}</span>
        <div style={{ marginInlineStart: "auto" }}>
          <ThemeToggle />
        </div>
      </header>

      <main className="landing-body">
        <div className="landing-hero">
          <h1>
            {t("landing.hero.title1")}<br />
            <span className="accent">{t("landing.hero.title2")}</span>
          </h1>
          <p>{t("landing.hero.subtitle")}</p>
          <div className="feature-chips">
            <span className="feature-chip">
              <Zap size={14} className="chip-icon" /> {t("landing.chip.realtime")}
            </span>
            <span className="feature-chip">
              <Bell size={14} className="chip-icon" /> {t("landing.chip.push")}
            </span>
            <span className="feature-chip">
              <LinkIcon size={14} className="chip-icon" /> {t("landing.chip.share")}
            </span>
          </div>
        </div>

        <div className="landing-input-card">
          <form onSubmit={onSubmit} style={{ width: "100%" }}>
            <div className="input-wrapper">
              <label htmlFor="tracking-url" className="sr-only">{t("landing.input.label")}</label>
              <span className="input-icon">
                <Link2 size={16} />
              </span>

              <input
                ref={inputRef}
                id="tracking-url"
                type="url"
                className={`url-input${error ? " error" : ""}`}
                placeholder={t("landing.input.placeholder")}
                value={value}
                onChange={onChange}
                onPaste={onPaste}
                onKeyDown={onKeyDown}
                disabled={loading}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                dir="ltr"
                aria-describedby={error ? "url-error" : !hasValue ? "url-hint" : undefined}
                aria-invalid={!!error}
              />

              {loading && (
                <span className="input-spinner">
                  <span className="spinner" />
                </span>
              )}
            </div>

            {error && (
              <div className="input-error" id="url-error" role="alert">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            {!error && !hasValue && (
              <div className="input-hint" id="url-hint" dir="ltr">
                {t("landing.input.hint")}
              </div>
            )}

            {hasValue && !loading && (
              <button type="submit" className="track-btn">
                {t("landing.input.btn")}
              </button>
            )}
          </form>
        </div>

        <RecentDeliveries />
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <LocaleProvider>
    <LandingPage />
  </LocaleProvider>,
);
