import React from "react";
import type { TrackingEvent } from "../../src/types";
import type { ConnectionStatus } from "../hooks/useTracker";
import { useLocale, timeLocale } from "../i18n";
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

function formatCoord(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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
  const { t } = useLocale();
  if (prevStep === currStep) return null;
  const prevLabel = t(`step.label.${prevStep}` as any) || `Step ${prevStep}`;
  const currLabel = t(`step.label.${currStep}` as any) || `Step ${currStep}`;
  return (
    <div className="status-transition">
      <div className="status-transition-from">
        <span className={`status-transition-badge step-color-${prevStep}`}>
          {STEP_EMOJI[prevStep]} {prevLabel}
        </span>
      </div>
      <ArrowRight size={14} className="status-transition-arrow" />
      <div className="status-transition-to">
        <span className={`status-transition-badge step-color-${currStep}`}>
          {STEP_EMOJI[currStep]} {currLabel}
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
  const { t } = useLocale();
  if (status === "reconnecting") {
    return (
      <span className="badge badge-reconnecting" role="status">
        <span className="pulse-dot" />
        {t("status.badge.reconnecting")}
      </span>
    );
  }
  if (status === "idle") {
    return <span className="badge badge-history" role="status">{t("status.badge.history")}</span>;
  }
  if (isTrackerActive && isLive) {
    return (
      <span className="badge badge-live" role="status">
        <span className="pulse-dot" />
        {t("status.badge.live")}
      </span>
    );
  }
  if (!isLive) {
    return <span className="badge badge-history" role="status">{t("status.badge.history")}</span>;
  }
  return (
    <span className="badge badge-waiting" role="status">
      <span className="pulse-dot" />
      {t("status.badge.waiting")}
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
  const { t, locale } = useLocale();

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString(timeLocale(locale), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (!event) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">{"\u{1F4E6}"}</div>
        <div className="empty-state-title">{t("status.noData")}</div>
        <div className="empty-state-desc">{t("status.noData.desc")}</div>
      </div>
    );
  }

  const step = event.status.step;
  const prevStep = prevEvent?.status.step;
  const stepChanged = prevStep !== undefined && prevStep !== step;
  const stepLabel = t(`step.label.${step}` as any) || event.status.label;

  return (
    <div className="status-card">
      <div className="status-card-header">
        <div className="restaurant-icon">{STEP_EMOJI[step] ?? "\u{1F355}"}</div>
        <div className="status-card-name">
          <h2>{event.restaurantName}</h2>
          <div className="code" dir="ltr">{event.trackingCode}</div>
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
              {t("status.stepOf", { n: step })} {event.status.label || stepLabel}
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
            <div className="detail-label">{t("status.eta")}</div>
            <div className={`detail-value ${event.eta.minutes !== null ? "highlight" : ""}`} dir="ltr">
              {event.eta.minutes !== null ? t("status.eta.min", { n: event.eta.minutes }) : "\u2014"}
            </div>
          </div>
        </div>

        <div className="detail-item">
          <span className="detail-icon"><Clock size={14} /></span>
          <div>
            <div className="detail-label">{t("status.updated")}</div>
            <div className="detail-value mono" dir="ltr">{formatTime(event.timestamp)}</div>
          </div>
        </div>

        {event.gps.destination && (
          <div className="detail-item full">
            <span className="detail-icon"><MapPin size={14} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="detail-label">{t("status.destination")}</div>
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
              <div className="detail-label">{t("status.courier")}</div>
              <div className="detail-value mono" dir="ltr">
                {formatCoord(event.gps.courier.lat, event.gps.courier.lng)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
