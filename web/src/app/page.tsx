"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TrackingInput from "@/components/tracker/tracking-input";
import Timeline from "@/components/tracker/timeline";
import StatusPanel from "@/components/tracker/status-panel";
import { useTracker } from "@/hooks/use-tracker";
import { useTheme } from "@/hooks/use-theme";
import { Separator } from "@/components/ui/separator";
import { MapIcon, Clock, History, Sun, Moon } from "lucide-react";

const DeliveryMap = dynamic(() => import("@/components/tracker/delivery-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      Loading map...
    </div>
  ),
});

interface LogEntry {
  code: string;
  restaurantName: string;
  eventCount: number;
  lastUpdatedAt?: string;
}

function LogsList({ onSelect }: { onSelect: (code: string) => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((data) => setLogs(data.logs ?? []))
      .catch(() => {});
  }, []);

  if (logs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          Previous Deliveries
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-col gap-1.5">
          {logs.map((log) => (
            <button
              key={log.code}
              onClick={() => onSelect(log.code)}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{log.restaurantName}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {log.code}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs text-muted-foreground">{log.eventCount} events</p>
                {log.lastUpdatedAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.lastUpdatedAt).toLocaleDateString("en-GB")}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const tracker = useTracker({ refreshInterval });
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="border-b px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <MapIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-none">Wolt Delivery Tracker</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time delivery tracking with GPS
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="shrink-0">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side: Map */}
        <div className="flex-1 relative">
          <DeliveryMap
            event={tracker.currentEvent}
            courierTrail={tracker.courierTrail}
            isDark={theme === "dark"}
          />

          {/* Map overlay: current ETA badge */}
          {tracker.currentEvent?.eta.minutes != null && (
            <div className="absolute top-4 left-4 z-[1000]">
              <div className="bg-background/90 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg border">
                <div className="text-3xl font-bold text-primary leading-none">
                  {tracker.currentEvent.eta.minutes}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">min to delivery</div>
              </div>
            </div>
          )}
        </div>

        {/* Right side: Controls panel */}
        <div className="w-[380px] border-l flex flex-col overflow-hidden shrink-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <TrackingInput
              onStart={tracker.startTracking}
              onStop={tracker.stopTracking}
              isTracking={tracker.isTracking}
              refreshInterval={refreshInterval}
              onRefreshIntervalChange={setRefreshInterval}
            />

            <StatusPanel
              event={tracker.currentEvent}
              isLive={tracker.isLive}
              isTracking={tracker.isTracking}
            />

            {!tracker.trackingCode && <LogsList onSelect={tracker.loadLog} />}
          </div>

          {/* Timeline: bottom of the panel */}
          {tracker.events.length > 0 && (
            <>
              <Separator />
              <div className="p-4 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Timeline</span>
                  {tracker.isLive && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-auto flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <Timeline
                  events={tracker.events}
                  currentIndex={tracker.currentIndex}
                  onIndexChange={tracker.setCurrentIndex}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
