import React, { useEffect, useRef, useCallback, useState } from "react";
import type { TrackingEvent } from "../../src/types";
import { useLocale, timeLocale } from "../i18n";
import { Clock, Bike, MapPin, Dot, Play, Pause, ChevronLeft, ChevronRight, SkipBack, SkipForward } from "./Icons";

interface TimelineProps {
  events: TrackingEvent[];
  currentIndex: number;
  isLive: boolean;
  onIndexChange: (index: number) => void;
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function stepColor(step: number): string {
  if (step >= 5) return "var(--step-5)";
  if (step >= 4) return "var(--step-4)";
  if (step >= 3) return "var(--step-3)";
  return "var(--step-1)";
}

function ChangeIcon({ change }: { change: string }) {
  if (change.startsWith("ETA")) return <Clock size={12} />;
  if (change.toLowerCase().includes("courier")) return <Bike size={12} />;
  if (change.toLowerCase().includes("status") || change.toLowerCase().includes("step")) return <MapPin size={12} />;
  return <Dot size={12} />;
}

function changeCategory(change: string): "status" | "eta" | "courier" | "other" {
  if (change.toLowerCase().includes("status") || change.toLowerCase().includes("step")) return "status";
  if (change.startsWith("ETA")) return "eta";
  if (change.toLowerCase().includes("courier")) return "courier";
  return "other";
}

function RichChange({ change }: { change: string }) {
  const arrowIdx = change.indexOf("\u2192");
  const arrowAscii = arrowIdx === -1 ? change.indexOf(" -> ") : -1;
  const cat = changeCategory(change);

  if (arrowIdx !== -1) {
    const before = change.slice(0, arrowIdx).trim();
    const after = change.slice(arrowIdx + 1).trim();
    return (
      <span className={`rich-change rich-change-${cat}`}>
        <span className="rich-change-from">{before}</span>
        <span className="rich-change-arrow">{"\u2192"}</span>
        <span className="rich-change-to">{after}</span>
      </span>
    );
  }
  if (arrowAscii !== -1) {
    const before = change.slice(0, arrowAscii).trim();
    const after = change.slice(arrowAscii + 4).trim();
    return (
      <span className={`rich-change rich-change-${cat}`}>
        <span className="rich-change-from">{before}</span>
        <span className="rich-change-arrow">{"\u2192"}</span>
        <span className="rich-change-to">{after}</span>
      </span>
    );
  }

  return <span className={`rich-change rich-change-${cat}`}>{change}</span>;
}

export default function Timeline({
  events,
  currentIndex,
  isLive,
  onIndexChange,
}: TimelineProps) {
  const { t, locale } = useLocale();
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const activeDotRef = useRef<HTMLButtonElement>(null);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString(timeLocale(locale), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (events.length === 0) return null;

  const current = events[currentIndex];
  const first = events[0]!;
  const elapsed = current
    ? new Date(current.timestamp).getTime() - new Date(first.timestamp).getTime()
    : 0;
  const max = Math.max(events.length - 1, 0);

  const hasStatusChange = (i: number) =>
    i === 0 || events[i]!.status.step !== events[i - 1]!.status.step;

  const stopPlayback = useCallback(() => {
    if (playRef.current) {
      clearInterval(playRef.current);
      playRef.current = null;
    }
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    stopPlayback();
    setPlaying(true);
    let idx = currentIndex;
    playRef.current = setInterval(() => {
      idx++;
      if (idx > max) {
        stopPlayback();
        return;
      }
      onIndexChange(idx);
    }, 800);
  }, [currentIndex, max, onIndexChange, stopPlayback]);

  useEffect(() => {
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, []);

  useEffect(() => {
    if (playing && currentIndex >= max) stopPlayback();
  }, [currentIndex, max, playing, stopPlayback]);

  useEffect(() => {
    if (activeDotRef.current && dotsRef.current) {
      activeDotRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (currentIndex > 0) onIndexChange(currentIndex - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (currentIndex < max) onIndexChange(currentIndex + 1);
        break;
      case "Home":
        e.preventDefault();
        onIndexChange(0);
        break;
      case "End":
        e.preventDefault();
        onIndexChange(max);
        break;
      case " ":
        e.preventDefault();
        playing ? stopPlayback() : startPlayback();
        break;
    }
  }, [currentIndex, max, onIndexChange, playing, startPlayback, stopPlayback]);

  return (
    <div className="timeline" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Playback controls */}
      <div className="timeline-controls">
        <button className="tl-btn" onClick={() => onIndexChange(0)} title={t("timeline.first")} aria-label={t("timeline.first")}>
          <SkipBack size={13} />
        </button>
        <button className="tl-btn" onClick={() => currentIndex > 0 && onIndexChange(currentIndex - 1)} title={t("timeline.prev")} aria-label={t("timeline.prevEvent")}>
          <ChevronLeft size={13} />
        </button>
        <button
          className={`tl-btn tl-play${playing ? " active" : ""}`}
          onClick={() => playing ? stopPlayback() : startPlayback()}
          title={playing ? t("timeline.pause") : t("timeline.play")}
          aria-label={playing ? t("timeline.pausePlayback") : t("timeline.playThrough")}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button className="tl-btn" onClick={() => currentIndex < max && onIndexChange(currentIndex + 1)} title={t("timeline.next")} aria-label={t("timeline.nextEvent")}>
          <ChevronRight size={13} />
        </button>
        <button className="tl-btn" onClick={() => onIndexChange(max)} title={t("timeline.latest")} aria-label={t("timeline.latest")}>
          <SkipForward size={13} />
        </button>

        <span className="timeline-counter" dir="ltr">
          {currentIndex + 1} / {events.length}
        </span>

        <span className="timeline-meta-right">
          {elapsed > 0 && <span className="timeline-elapsed" dir="ltr">+{formatDuration(elapsed)}</span>}
          {isLive && (
            <span className="badge badge-live" style={{ fontSize: "11px", padding: "2px 7px" }}>
              <span className="pulse-dot" />
              {t("timeline.live")}
            </span>
          )}
        </span>
      </div>

      {/* Slider — always LTR for time semantics */}
      <div className="timeline-slider-row" dir="ltr">
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

      {/* Changes for current event */}
      {current && current.changes.length > 0 && (
        <div className="timeline-changes">
          {current.changes.map((change, i) => (
            <div key={i} className={`change-item change-${changeCategory(change)}`}>
              <span className="change-item-icon"><ChangeIcon change={change} /></span>
              <RichChange change={change} />
            </div>
          ))}
        </div>
      )}

      {/* Step-colored dots — always LTR chronological */}
      <div className="timeline-dots" ref={dotsRef} dir="ltr">
        {events.map((ev, i) => {
          const isActive = i === currentIndex;
          const isStatusChange = hasStatusChange(i);
          const size = isActive ? 12 : isStatusChange ? 9 : 5;
          return (
            <button
              key={i}
              ref={isActive ? activeDotRef : undefined}
              className={`timeline-dot${isActive ? " active" : isStatusChange ? " status-change" : ""}`}
              style={{
                width: size,
                height: size,
                background: isActive ? "var(--accent)" : stepColor(ev.status.step),
              }}
              title={`${formatTime(ev.timestamp)}${isStatusChange ? ` — Step ${ev.status.step}` : ""}${ev.changes[0] ? ` — ${ev.changes[0]}` : ""}`}
              onClick={() => onIndexChange(i)}
              aria-label={`Event ${i + 1}${isStatusChange ? `, step ${ev.status.step}` : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
