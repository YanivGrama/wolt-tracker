import React from "react";
import type { TrackingEvent } from "../../src/types";
import { Clock, Bike, MapPin, Dot } from "./Icons";

interface TimelineProps {
  events: TrackingEvent[];
  currentIndex: number;
  isLive: boolean;
  onIndexChange: (index: number) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function ChangeIcon({ change }: { change: string }) {
  if (change.startsWith("ETA")) return <Clock size={12} />;
  if (change.toLowerCase().includes("courier")) return <Bike size={12} />;
  if (change.toLowerCase().includes("status") || change.toLowerCase().includes("step")) return <MapPin size={12} />;
  return <Dot size={12} />;
}

export default function Timeline({
  events,
  currentIndex,
  isLive,
  onIndexChange,
}: TimelineProps) {
  if (events.length === 0) return null;

  const current = events[currentIndex];
  const first = events[0]!;
  const elapsed = current
    ? new Date(current.timestamp).getTime() - new Date(first.timestamp).getTime()
    : 0;

  const max = Math.max(events.length - 1, 0);

  return (
    <div className="timeline">
      <div className="timeline-slider-row">
        <span className="timeline-time">{formatTime(first.timestamp)}</span>
        <input
          type="range"
          className="range-slider"
          min={0}
          max={max}
          step={1}
          value={currentIndex}
          onChange={(e) => onIndexChange(Number(e.target.value))}
          aria-label="Timeline position"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${max > 0 ? (currentIndex / max) * 100 : 0}%, var(--border) ${max > 0 ? (currentIndex / max) * 100 : 0}%, var(--border) 100%)`,
          }}
        />
        <span className="timeline-time right">
          {current ? formatTime(current.timestamp) : "--:--:--"}
        </span>
      </div>

      <div className="timeline-meta">
        <span>
          Event {currentIndex + 1} / {events.length}
        </span>
        <span className="timeline-meta-right">
          {elapsed > 0 && <span>+{formatDuration(elapsed)}</span>}
          {isLive && (
            <span className="badge badge-live" style={{ fontSize: "11px", padding: "2px 7px" }}>
              <span className="pulse-dot" />
              Live
            </span>
          )}
        </span>
      </div>

      {current && current.changes.length > 0 && (
        <div className="timeline-changes">
          {current.changes.map((change, i) => (
            <div key={i} className="change-item">
              <span className="change-item-icon"><ChangeIcon change={change} /></span>
              <span>{change}</span>
            </div>
          ))}
        </div>
      )}

      <div className="timeline-dots">
        {events.map((ev, i) => {
          const isActive = i === currentIndex;
          const isStatusChange = i === 0 || ev.status.step !== events[i - 1]!.status.step;
          const size = isActive ? 12 : isStatusChange ? 8 : 6;
          return (
            <button
              key={i}
              className={`timeline-dot${isActive ? " active" : isStatusChange ? " status-change" : ""}`}
              style={{ width: size, height: size }}
              title={`${formatTime(ev.timestamp)}${ev.changes[0] ? ` — ${ev.changes[0]}` : ""}`}
              onClick={() => onIndexChange(i)}
              aria-label={`Event ${i + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
