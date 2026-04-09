"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { TrackingEvent } from "@/lib/types";
import {
  UtensilsCrossed,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  Timer,
  Navigation,
} from "lucide-react";

interface StatusPanelProps {
  event: TrackingEvent | null;
  isLive: boolean;
  isTracking: boolean;
}

const STEP_LABELS: Record<number, string> = {
  1: "Order received",
  2: "Order seen",
  3: "Being prepared",
  4: "Being delivered",
  5: "Delivered",
};

const STEP_ICONS: Record<number, React.ReactNode> = {
  1: <CheckCircle2 className="h-4 w-4" />,
  2: <CheckCircle2 className="h-4 w-4" />,
  3: <UtensilsCrossed className="h-4 w-4" />,
  4: <Truck className="h-4 w-4" />,
  5: <CheckCircle2 className="h-4 w-4" />,
};

function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function StatusPanel({ event, isLive, isTracking }: StatusPanelProps) {
  if (!event) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground text-sm">
          No tracking data available
        </CardContent>
      </Card>
    );
  }

  const step = event.status.step;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <UtensilsCrossed className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-semibold text-lg truncate">{event.restaurantName}</h2>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {isTracking && (
                <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  Live
                </Badge>
              )}
              {!isLive && (
                <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                  History
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {event.trackingCode}
          </p>
        </div>

        <Separator />

        {/* Status steps */}
        <div className="p-4 space-y-3">
          {/* Progress bar */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Current status */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">
              {STEP_ICONS[step]}
            </div>
            <div>
              <p className="font-medium text-sm">
                Step {step}/5 — {event.status.label || STEP_LABELS[step]}
              </p>
              <p className="text-xs text-muted-foreground">{event.status.description}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Details grid */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {/* ETA */}
          <div className="flex items-start gap-2">
            <Timer className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">ETA</p>
              <p className="text-sm font-medium">
                {event.eta.minutes !== null ? `${event.eta.minutes} min` : "—"}
              </p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="text-sm font-mono">
                {new Date(event.timestamp).toLocaleTimeString("en-GB")}
              </p>
            </div>
          </div>

          {/* Destination */}
          {event.gps.destination && (
            <div className="flex items-start gap-2 col-span-2">
              <MapPin className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Destination</p>
                <p className="text-sm truncate">
                  {event.destinationAddress ?? formatCoord(event.gps.destination.lat, event.gps.destination.lng)}
                </p>
              </div>
            </div>
          )}

          {/* Courier */}
          {event.gps.courier && (
            <div className="flex items-start gap-2 col-span-2">
              <Navigation className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Courier position</p>
                <p className="text-sm font-mono">
                  {formatCoord(event.gps.courier.lat, event.gps.courier.lng)}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
