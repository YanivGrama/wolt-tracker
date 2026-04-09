import { NextResponse } from "next/server";
import { listTrackingCodes, readEvents } from "@/lib/logs";

export async function GET() {
  const codes = listTrackingCodes();

  const logs = codes.map((code) => {
    const events = readEvents(code);
    const first = events[0];
    const last = events[events.length - 1];
    return {
      code,
      restaurantName: first?.restaurantName ?? "Unknown",
      eventCount: events.length,
      lastStatus: last?.status,
      lastEta: last?.eta,
      startedAt: first?.timestamp,
      lastUpdatedAt: last?.timestamp,
    };
  });

  return NextResponse.json({ logs });
}
