import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";

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
    5: "Delivered ✓",
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
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {stepLabel(log.lastStep)}
              </span>
              {log.lastUpdatedAt && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-subtle)",
                    marginLeft: "auto",
                  }}
                >
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

  // Focus input on mount
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

      // Redirect to tracker page
      window.location.href = `/track/${data.code}`;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    // Let React update the input value, then validate
    setTimeout(() => handleUrl(pasted), 0);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setValue(val);
    setError("");
    // Clear error when user is typing
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
      {/* Header */}
      <header className="landing-header">
        <div className="landing-logo">🛵</div>
        <span className="landing-title">Wolt Tracker</span>
      </header>

      {/* Body */}
      <main className="landing-body">
        {/* Hero text */}
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
            <span className="feature-chip">⚡ Real-time</span>
            <span className="feature-chip">🔔 Push alerts</span>
            <span className="feature-chip">🔗 Shareable</span>
          </div>
        </div>

        {/* URL input form */}
        <form onSubmit={onSubmit} style={{ width: "100%" }}>
          <div className="input-wrapper">
            {/* Link icon */}
            <span className="input-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </span>

            <input
              ref={inputRef}
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
            />

            {/* Spinner or clear */}
            {loading && (
              <span className="input-spinner">
                <span className="spinner" />
              </span>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="input-error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Hint */}
          {!error && !hasValue && (
            <div className="input-hint">
              Link looks like: track.wolt.com/…/s/AbCdEf…
            </div>
          )}

          {/* Track button (shows when user has typed something) */}
          {hasValue && !loading && (
            <button type="submit" className="track-btn">
              Track delivery →
            </button>
          )}
        </form>

        {/* Recent deliveries */}
        <RecentDeliveries />
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<LandingPage />);
