import React from "react";
import type { TrackingEvent } from "../../src/types";
import { useLocale } from "../i18n";
import { MapPin } from "./Icons";

interface DeliveryCompleteProps {
  firstEvent: TrackingEvent;
  lastEvent: TrackingEvent;
}

function formatDuration(ms: number) {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function DeliveryComplete({ firstEvent, lastEvent }: DeliveryCompleteProps) {
  const { t } = useLocale();
  const durationMs =
    new Date(lastEvent.timestamp).getTime() - new Date(firstEvent.timestamp).getTime();

  return (
    <div className="delivery-complete">
      <div className="delivery-complete-icon">🎉</div>
      <h3>{t("delivered.title")}</h3>
      <p>{t("delivered.desc", { name: lastEvent.restaurantName })}</p>

      <div className="delivery-stats">
        <div className="delivery-stat">
          <div className="delivery-stat-label">{t("delivered.totalTime")}</div>
          <div className="delivery-stat-value" dir="ltr">{formatDuration(durationMs)}</div>
        </div>
        <div className="delivery-stat">
          <div className="delivery-stat-label">{t("delivered.updates")}</div>
          <div className="delivery-stat-value">—</div>
        </div>
      </div>

      {lastEvent.destinationAddress && (
        <div className="delivery-address">
          <MapPin size={12} />
          <span>{lastEvent.destinationAddress}</span>
        </div>
      )}

      <a href="/" className="new-track-btn">
        {t("delivered.trackAnother")}
      </a>
    </div>
  );
}
