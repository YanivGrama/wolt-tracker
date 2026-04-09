"use client";

import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import type { TrackingEvent } from "@/lib/types";
import { Clock, MapPin, Truck, ChefHat } from "lucide-react";

interface TimelineProps {
  events: TrackingEvent[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function changeIcon(change: string) {
  if (change.startsWith("ETA")) return <Clock className="h-3 w-3" />;
  if (change.includes("Courier")) return <Truck className="h-3 w-3" />;
  if (change.includes("Status")) return <ChefHat className="h-3 w-3" />;
  return <MapPin className="h-3 w-3" />;
}

export default function Timeline({ events, currentIndex, onIndexChange }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No events yet. Start tracking to see the timeline.
      </div>
    );
  }

  const current = events[currentIndex];
  const first = events[0]!;
  const elapsed =
    current ? new Date(current.timestamp).getTime() - new Date(first.timestamp).getTime() : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
          {formatTime(first.timestamp)}
        </span>
        <Slider
          value={[currentIndex]}
          min={0}
          max={Math.max(events.length - 1, 0)}
          step={1}
          onValueChange={([v]) => onIndexChange(v!)}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground font-mono min-w-[60px] text-right">
          {current ? formatTime(current.timestamp) : "--:--:--"}
        </span>
      </div>

      {/* Elapsed time */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Event {currentIndex + 1} / {events.length}</span>
        <span>Elapsed: {formatDuration(elapsed)}</span>
      </div>

      {/* Current event changes */}
      {current && (
        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
          {current.changes.map((change, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs rounded-md bg-muted/50 px-2.5 py-1.5"
            >
              <span className="mt-0.5 text-muted-foreground shrink-0">
                {changeIcon(change)}
              </span>
              <span className="text-foreground/80">{change}</span>
            </div>
          ))}
        </div>
      )}

      {/* Event step dots */}
      <div className="flex gap-0.5 items-center overflow-x-auto py-1">
        {events.map((ev, i) => {
          const isActive = i === currentIndex;
          const isStatusChange =
            i === 0 || ev.status.step !== events[i - 1]!.status.step;
          return (
            <button
              key={i}
              onClick={() => onIndexChange(i)}
              className={`shrink-0 rounded-full transition-all cursor-pointer ${
                isActive
                  ? "w-3 h-3 bg-primary ring-2 ring-primary/30"
                  : isStatusChange
                    ? "w-2 h-2 bg-primary/60"
                    : "w-1.5 h-1.5 bg-muted-foreground/30"
              }`}
              title={`${formatTime(ev.timestamp)} — ${ev.changes[0] ?? ""}`}
            />
          );
        })}
      </div>

      {/* Step badges */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((step) => {
          const isCurrent = current?.status.step === step;
          const isCompleted = (current?.status.step ?? 0) > step;
          return (
            <Badge
              key={step}
              variant={isCurrent ? "default" : isCompleted ? "secondary" : "outline"}
              className={`text-xs ${
                isCurrent ? "bg-primary text-primary-foreground" : ""
              } ${isCompleted ? "opacity-60" : ""}`}
            >
              {step}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
