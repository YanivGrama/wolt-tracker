import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { TrackingEvent } from "./types";

const LOGS_DIR = join(process.cwd(), "..", "logs");

export function getLogsDir(): string {
  return LOGS_DIR;
}

export function listTrackingCodes(): string[] {
  if (!existsSync(LOGS_DIR)) return [];
  return readdirSync(LOGS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(".jsonl", ""));
}

export function readEvents(trackingCode: string): TrackingEvent[] {
  const filePath = join(LOGS_DIR, `${trackingCode}.jsonl`);
  if (!existsSync(filePath)) return [];

  const raw = readFileSync(filePath, "utf-8").trim();
  if (!raw) return [];

  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TrackingEvent);
}

export function readEventsAfter(
  trackingCode: string,
  afterTimestamp: string,
): TrackingEvent[] {
  const all = readEvents(trackingCode);
  return all.filter((e) => e.timestamp > afterTimestamp);
}
