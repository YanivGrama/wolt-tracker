"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, RotateCw } from "lucide-react";

interface TrackingInputProps {
  onStart: (url: string) => void;
  onStop: () => void;
  isTracking: boolean;
  refreshInterval: number;
  onRefreshIntervalChange: (ms: number) => void;
}

export default function TrackingInput({
  onStart,
  onStop,
  isTracking,
  refreshInterval,
  onRefreshIntervalChange,
}: TrackingInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onStart(url.trim());
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* URL Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="https://track.wolt.com/s/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isTracking}
              className="font-mono text-sm"
            />
          </div>
          {isTracking ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onStop}
              className="shrink-0"
            >
              <Square className="h-4 w-4 mr-1.5" />
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!url.trim()} className="shrink-0">
              <Play className="h-4 w-4 mr-1.5" />
              Track
            </Button>
          )}
        </form>

        {/* Refresh interval */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Poll interval
            </Label>
          </div>
          <Slider
            value={[refreshInterval]}
            min={500}
            max={10000}
            step={500}
            onValueChange={([v]) => onRefreshIntervalChange(v!)}
            className="flex-1"
          />
          <span className="text-xs font-mono text-muted-foreground min-w-[55px] text-right">
            {refreshInterval >= 1000
              ? `${(refreshInterval / 1000).toFixed(1)}s`
              : `${refreshInterval}ms`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
