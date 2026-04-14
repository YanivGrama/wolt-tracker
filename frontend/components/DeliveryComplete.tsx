import React from "react";
import type { TrackingEvent } from "../../src/types";

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
  const durationMs =
    new Date(lastEvent.timestamp).getTime() - new Date(firstEvent.timestamp).getTime();

  return (
    <div className="delivery-complete">
      <div className="delivery-complete-icon">🎉</div>
      <h3>Delivered!</h3>
      <p>Your order from {lastEvent.restaurantName} has arrived.</p>

      <div className="delivery-stats">
        <div className="delivery-stat">
          <div className="delivery-stat-label">Total time</div>
          <div className="delivery-stat-value">{formatDuration(durationMs)}</div>
        </div>
        <div className="delivery-stat">
          <div className="delivery-stat-label">Status updates</div>
          <div className="delivery-stat-value">—</div>
        </div>
      </div>

      {lastEvent.destinationAddress && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          <span>📍</span>
          <span>{lastEvent.destinationAddress}</span>
        </div>
      )}

      <a href="/" className="new-track-btn">
        <span>+</span>
        Track another delivery
      </a>
    </div>
  );
}
