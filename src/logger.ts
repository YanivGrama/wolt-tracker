import { mkdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import type { TrackingEvent } from "./types.ts";

const LOGS_DIR = join(dirname(new URL(import.meta.url).pathname), "..", "logs");

function ensureLogsDir(): void {
  mkdirSync(LOGS_DIR, { recursive: true });
}

function logFilePath(trackingCode: string): string {
  return join(LOGS_DIR, `${trackingCode}.jsonl`);
}

/**
 * Appends a tracking event as a single JSON line to the order's log file.
 */
export function appendEvent(event: TrackingEvent): void {
  ensureLogsDir();
  const line = JSON.stringify(event) + "\n";
  appendFileSync(logFilePath(event.trackingCode), line, "utf-8");
}

/**
 * Returns the full path to the log file for a tracking code.
 */
export function getLogPath(trackingCode: string): string {
  return logFilePath(trackingCode);
}

export { LOGS_DIR };
