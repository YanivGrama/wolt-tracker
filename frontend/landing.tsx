import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import { Zap, Bell, LinkIcon, Link2, AlertCircle } from "./components/Icons";
import ThemeToggle from "./components/ThemeToggle";

const WOLT_URL_RE = /https?:\/\/track\.wolt\.com\/(?:[^/]+\/)?s\/([A-Za-z0-9_-]+)/;

interface LogEntry {
  code: string;
  restaurantName: string;
  eventCount: number;
  startedAt?: string;
  lastUpdatedAt?: string;
  lastStep: number;
}

function stepColor(step: number): string {
  if (step >= 5) return "var(--step-5)";
  if (step >= 4) return "var(--step-4)";
  if (step >= 3) return "var(--step-3)";
  return "var(--step-inactive)";
}

function stepLabel(step: number): string {
  const labels: Record<number, string> = {
    0: "Not started",
    1: "Received",
    2: "Confirmed",
    3: "Preparing",
    4: "On the way",
    5: "Delivered",
  };
  return labels[step] ?? "Unknown";
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

function RecentDeliveries() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((data: { logs: LogEntry[] }) => setLogs(data.logs?.slice(0, 8) ?? []))
      .catch(() => {});
  }, []);

  if (logs.length === 0) return null;

  return (
    <div className="recent-section">
      <div className="recent-label">Recent deliveries</div>
      <div className="recent-grid">
        {logs.map((log) => (
          <a
            key={log.code}
            href={`/track/${log.code}`}
            className="recent-card"
          >
            <div className="recent-card-name">{log.restaurantName}</div>
            <div className="recent-card-meta">{log.code.slice(0, 14)}…</div>
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
          </a>
        ))}
      </div>
    </div>
  );
}

function LandingPage() {
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
      setError("That doesn't look like a valid Wolt tracking link. It should start with track.wolt.com.");
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
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = `/track/${data.code}`;
    } catch {
      setError("Network error. Please check your connection and try again.");
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
        <span className="landing-title">Wolt Tracker</span>
        <div style={{ marginLeft: "auto" }}>
          <ThemeToggle />
        </div>
      </header>

      <main className="landing-body">
        <div className="landing-hero">
          <h1>
            Track your Wolt delivery<br />
            in <span className="accent">real time</span>.
          </h1>
          <p>
            Paste your tracking link below — we'll show you exactly where your
            courier is and when to expect your order.
          </p>
          <div className="feature-chips">
            <span className="feature-chip">
              <Zap size={14} className="chip-icon" /> Real-time
            </span>
            <span className="feature-chip">
              <Bell size={14} className="chip-icon" /> Push alerts
            </span>
            <span className="feature-chip">
              <LinkIcon size={14} className="chip-icon" /> Shareable
            </span>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ width: "100%" }}>
          <div className="input-wrapper">
            <label htmlFor="tracking-url" className="sr-only">Wolt tracking URL</label>
            <span className="input-icon">
              <Link2 size={16} />
            </span>

            <input
              ref={inputRef}
              id="tracking-url"
              type="url"
              className={`url-input${error ? " error" : ""}`}
              placeholder="Paste your Wolt tracking link…"
              value={value}
              onChange={onChange}
              onPaste={onPaste}
              onKeyDown={onKeyDown}
              disabled={loading}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
            <div className="input-hint" id="url-hint">
              Link looks like: track.wolt.com/…/s/AbCdEf…
            </div>
          )}

          {hasValue && !loading && (
            <button type="submit" className="track-btn">
              Track delivery
            </button>
          )}
        </form>

        <RecentDeliveries />
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<LandingPage />);
