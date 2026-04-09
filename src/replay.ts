import { readFileSync } from "fs";
import chalk from "chalk";
import type { TrackingEvent } from "./types.ts";

const STEP_COLORS: Record<number, (s: string) => string> = {
  1: chalk.cyan,
  2: chalk.cyan,
  3: chalk.yellow,
  4: chalk.green,
  5: chalk.greenBright,
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatCoord(c: { lat: number; lng: number } | null): string {
  if (!c) return "—";
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

/**
 * Reads a JSONL log file and prints a colored timeline to the terminal.
 */
export function replayLog(filePath: string): void {
  const raw = readFileSync(filePath, "utf-8").trim();
  if (!raw) {
    console.log(chalk.red("Log file is empty."));
    return;
  }

  const events: TrackingEvent[] = raw
    .split("\n")
    .map((line) => JSON.parse(line) as TrackingEvent);

  if (events.length === 0) {
    console.log(chalk.red("No events found in log."));
    return;
  }

  const first = events[0]!;
  const last = events[events.length - 1]!;
  const totalMs = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();

  console.log();
  console.log(chalk.bold.white(`  Delivery Timeline: ${first.restaurantName}`));
  console.log(chalk.gray(`  Tracking code: ${first.trackingCode}`));
  if (first.destinationAddress) {
    console.log(chalk.gray(`  Destination: ${first.destinationAddress}`));
  }
  console.log(chalk.gray(`  ─────────────────────────────────────────────`));
  console.log();

  let prevTime: Date | null = null;

  for (const event of events) {
    const time = new Date(event.timestamp);
    const stepColor = STEP_COLORS[event.status.step] ?? chalk.white;

    // Duration since previous event
    let durationStr = "";
    if (prevTime) {
      const delta = time.getTime() - prevTime.getTime();
      durationStr = chalk.dim(` (+${formatDuration(delta)})`);
    }

    const timeStr = chalk.gray(formatTimestamp(event.timestamp));
    const stepBadge = stepColor(`[${event.status.step}/5]`);
    const statusStr = chalk.bold(event.status.label || event.status.description);

    console.log(`  ${timeStr}  ${stepBadge} ${statusStr}${durationStr}`);

    // Print each change
    for (const change of event.changes) {
      if (change.startsWith("ETA:")) {
        console.log(`             ${chalk.blue(change)}`);
      } else if (change.startsWith("Courier")) {
        console.log(`             ${chalk.magenta(change)}`);
      } else if (change.startsWith("Status:")) {
        console.log(`             ${chalk.green(change)}`);
      } else {
        console.log(`             ${chalk.gray(change)}`);
      }
    }

    // Show GPS if courier is present
    if (event.gps.courier) {
      console.log(`             ${chalk.dim(`📍 Courier: ${formatCoord(event.gps.courier)}`)}`);
    }

    // Show ETA if present
    if (event.eta.minutes !== null) {
      console.log(`             ${chalk.dim(`⏱  ETA: ${event.eta.minutes} min`)}`);
    }

    console.log();
    prevTime = time;
  }

  console.log(chalk.gray(`  ─────────────────────────────────────────────`));
  console.log(chalk.bold.white(`  Total tracking time: ${formatDuration(totalMs)}`));
  console.log(chalk.gray(`  Events logged: ${events.length}`));

  if (last.status.step === 5) {
    console.log(chalk.greenBright.bold(`  ✓ Order delivered successfully`));
  } else {
    console.log(chalk.yellow(`  ⚠ Tracking ended at step ${last.status.step}/5`));
  }
  console.log();
}
