import React from "react";
import type { TrackingEvent } from "../../src/types";
import type { ConnectionStatus } from "../hooks/useTracker";
import { Clock, MapPin, Bike, ArrowRight } from "./Icons";

interface StatusPanelProps {
  event: TrackingEvent | null;
  prevEvent: TrackingEvent | null;
  isLive: boolean;
  isTrackerActive: boolean;
  connectionStatus: ConnectionStatus;
}

const STEP_EMOJI: Record<number, string> = {
  1: "\u{1F4CB}",
  2: "\u{1F440}",
  3: "\u{1F468}\u200D\u{1F373}",
  4: "\u{1F6F5}",
  5: "\u2705",
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

function StepBar({ step, prevStep }: { step: number; prevStep?: number }) {
  return (
    <div className="steps-bar">
      {[1, 2, 3, 4, 5].map((s) => {
        const done = s <= step;
        const justChanged = prevStep !== undefined && s > prevStep && s <= step;
        let cls = done ? `step-bar-segment done step-${s}` : "step-bar-segment inactive";
        if (justChanged) cls += " step-just-changed";
        return <div key={s} className={cls} />;
      })}
    </div>
  );
}

function StatusTransition({ prevStep, currStep }: { prevStep: number; currStep: number }) {
  if (prevStep === currStep) return null;
  return (
    <div className="status-transition">
      <div className="status-transition-from">
        <span className={`status-transition-badge step-color-${prevStep}`}>
          {STEP_EMOJI[prevStep]} {STEP_LABELS[prevStep] ?? `Step ${prevStep}`}
        </span>
      </div>
      <ArrowRight size={14} className="status-transition-arrow" />
      <div className="status-transition-to">
        <span className={`status-transition-badge step-color-${currStep}`}>
          {STEP_EMOJI[currStep]} {STEP_LABELS[currStep] ?? `Step ${currStep}`}
        </span>
      </div>
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
      <span className="badge badge-reconnecting" role="status">
        <span className="pulse-dot" />
        Reconnecting
      </span>
    );
  }
  if (status === "idle") {
    return <span className="badge badge-history" role="status">History</span>;
  }
  if (isTrackerActive && isLive) {
    return (
      <span className="badge badge-live" role="status">
        <span className="pulse-dot" />
        Live
      </span>
    );
  }
  if (!isLive) {
    return <span className="badge badge-history" role="status">History</span>;
  }
  return (
    <span className="badge badge-waiting" role="status">
      <span className="pulse-dot" />
      Waiting
    </span>
  );
}

export default function StatusPanel({
  event,
  prevEvent,
  isLive,
  isTrackerActive,
  connectionStatus,
}: StatusPanelProps) {
  if (!event) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">{"\u{1F4E6}"}</div>
        <div className="empty-state-title">No data yet</div>
        <div className="empty-state-desc">
          Waiting for the first tracking update…
        </div>
      </div>
    );
  }

  const step = event.status.step;
  const prevStep = prevEvent?.status.step;
  const stepChanged = prevStep !== undefined && prevStep !== step;

  return (
    <div className="status-card">
      <div className="status-card-header">
        <div className="restaurant-icon">{STEP_EMOJI[step] ?? "\u{1F355}"}</div>
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

      <div className="steps-container">
        <StepBar step={step} prevStep={stepChanged ? prevStep : undefined} />

        {stepChanged && (
          <StatusTransition prevStep={prevStep!} currStep={step} />
        )}

        <div className="current-status">
          <div className={`status-icon-wrap step-${step}`}>
            <span>{STEP_EMOJI[step]}</span>
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

      <div className="details-grid">
        <div className="detail-item">
          <span className="detail-icon"><Clock size={14} /></span>
          <div>
            <div className="detail-label">ETA</div>
            <div className={`detail-value ${event.eta.minutes !== null ? "highlight" : ""}`}>
              {event.eta.minutes !== null ? `${event.eta.minutes} min` : "\u2014"}
            </div>
          </div>
        </div>

        <div className="detail-item">
          <span className="detail-icon"><Clock size={14} /></span>
          <div>
            <div className="detail-label">Updated</div>
            <div className="detail-value mono">{formatTime(event.timestamp)}</div>
          </div>
        </div>

        {event.gps.destination && (
          <div className="detail-item full">
            <span className="detail-icon"><MapPin size={14} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="detail-label">Destination</div>
              <div className="detail-value truncate">
                {event.destinationAddress ??
                  formatCoord(event.gps.destination.lat, event.gps.destination.lng)}
              </div>
            </div>
          </div>
        )}

        {event.gps.courier && (
          <div className="detail-item full">
            <span className="detail-icon"><Bike size={14} /></span>
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
