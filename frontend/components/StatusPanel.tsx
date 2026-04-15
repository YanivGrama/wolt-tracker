import React from "react";
import type { TrackingEvent } from "../../src/types";
import type { ConnectionStatus } from "../hooks/useTracker";

interface StatusPanelProps {
  event: TrackingEvent | null;
  isLive: boolean;
  isTrackerActive: boolean;
  connectionStatus: ConnectionStatus;
}

const STEP_EMOJI: Record<number, string> = {
  1: "📋",
  2: "👀",
  3: "👨‍🍳",
  4: "🛵",
  5: "✅",
};

const STEP_LABELS: Record<number, string> = {
  1: "Order received",
  2: "Order confirmed",
  3: "Being prepared",
  4: "On the way",
  5: "Delivered",
};

function formatCoord(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StepBar({ step }: { step: number }) {
  return (
    <div className="steps-bar">
      {[1, 2, 3, 4, 5].map((s) => {
        const done = s <= step;
        const stepClass = done ? `step-bar-segment done step-${s}` : "step-bar-segment inactive";
        return <div key={s} className={stepClass} />;
      })}
    </div>
  );
}

function ConnectionBadge({
  status,
  isTrackerActive,
  isLive,
}: {
  status: ConnectionStatus;
  isTrackerActive: boolean;
  isLive: boolean;
}) {
  if (status === "reconnecting") {
    return (
      <span className="badge badge-reconnecting">
        <span className="pulse-dot" />
        Reconnecting
      </span>
    );
  }
  if (isTrackerActive && isLive) {
    return (
      <span className="badge badge-live">
        <span className="pulse-dot" />
        Live
      </span>
    );
  }
  if (!isLive) {
    return <span className="badge badge-history">History</span>;
  }
  return (
    <span className="badge badge-waiting">
      <span className="pulse-dot" />
      Waiting
    </span>
  );
}

export default function StatusPanel({
  event,
  isLive,
  isTrackerActive,
  connectionStatus,
}: StatusPanelProps) {
  if (!event) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📦</div>
        <div className="empty-state-title">No data yet</div>
        <div className="empty-state-desc">
          Waiting for the first tracking update…
        </div>
      </div>
    );
  }

  const step = event.status.step;

  return (
    <div className="status-card">
      {/* Header */}
      <div className="status-card-header">
        <div className="restaurant-icon">{STEP_EMOJI[step] ?? "🍕"}</div>
        <div className="status-card-name">
          <h2>{event.restaurantName}</h2>
          <div className="code">{event.trackingCode}</div>
        </div>
        <div className="status-badges">
          <ConnectionBadge
            status={connectionStatus}
            isTrackerActive={isTrackerActive}
            isLive={isLive}
          />
        </div>
      </div>

      {/* Progress steps */}
      <div className="steps-container">
        <StepBar step={step} />
        <div className="current-status">
          <div className={`status-icon-wrap step-${step}`}>
            <span style={{ fontSize: "16px" }}>{STEP_EMOJI[step]}</span>
          </div>
          <div className="status-text">
            <div className="label">
              Step {step}/5 — {event.status.label || STEP_LABELS[step]}
            </div>
            {event.status.description && (
              <div className="description">{event.status.description}</div>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="details-grid">
        {/* ETA */}
        <div className="detail-item">
          <span className="detail-icon">⏱</span>
          <div>
            <div className="detail-label">ETA</div>
            <div className={`detail-value ${event.eta.minutes !== null ? "highlight" : ""}`}>
              {event.eta.minutes !== null ? `${event.eta.minutes} min` : "—"}
            </div>
          </div>
        </div>

        {/* Updated */}
        <div className="detail-item">
          <span className="detail-icon">🕐</span>
          <div>
            <div className="detail-label">Updated</div>
            <div className="detail-value mono">{formatTime(event.timestamp)}</div>
          </div>
        </div>

        {/* Destination */}
        {event.gps.destination && (
          <div className="detail-item full">
            <span className="detail-icon">📍</span>
            <div style={{ minWidth: 0 }}>
              <div className="detail-label">Destination</div>
              <div className="detail-value truncate">
                {event.destinationAddress ??
                  formatCoord(event.gps.destination.lat, event.gps.destination.lng)}
              </div>
            </div>
          </div>
        )}

        {/* Courier */}
        {event.gps.courier && (
          <div className="detail-item full">
            <span className="detail-icon">🛵</span>
            <div>
              <div className="detail-label">Courier position</div>
              <div className="detail-value mono">
                {formatCoord(event.gps.courier.lat, event.gps.courier.lng)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
