import { program } from "commander";
import { TrackerPool } from "./tracker-pool.ts";
import { replayLog } from "./replay.ts";
import { LOGS_DIR } from "./logger.ts";
import { readdirSync } from "fs";
import { join } from "path";

program
  .name("wolt-tracker")
  .description("Track Wolt deliveries and replay order history")
  .version("1.0.0");

program
  .command("track")
  .description("Start tracking one or more Wolt delivery URLs")
  .argument("<urls...>", "Wolt tracking URLs (e.g., https://track.wolt.com/s/ABC)")
  .action(async (urls: string[]) => {
    const valid = urls.filter((u) => {
      if (!u.includes("track.wolt.com")) {
        console.error(`Skipping invalid URL: ${u}`);
        return false;
      }
      return true;
    });

    if (valid.length === 0) {
      console.error("No valid Wolt tracking URLs provided.");
      process.exit(1);
    }

    console.log(`Tracking ${valid.length} order(s)...`);
    const pool = new TrackerPool();
    await pool.start(valid);
  });

program
  .command("replay")
  .description("Replay delivery history from a JSONL log file")
  .argument("[logfile]", "Path to the JSONL log file (or tracking code)")
  .action((logfile?: string) => {
    if (!logfile) {
      // List available logs
      try {
        const files = readdirSync(LOGS_DIR).filter((f) => f.endsWith(".jsonl"));
        if (files.length === 0) {
          console.log("No log files found. Track a delivery first.");
          return;
        }
        console.log("Available logs:");
        for (const f of files) {
          console.log(`  ${f.replace(".jsonl", "")}  →  bun run src/index.ts replay ${join(LOGS_DIR, f)}`);
        }
      } catch {
        console.log("No log files found. Track a delivery first.");
      }
      return;
    }

    // Allow passing just the tracking code
    let path = logfile;
    if (!logfile.includes("/") && !logfile.endsWith(".jsonl")) {
      path = join(LOGS_DIR, `${logfile}.jsonl`);
    }

    replayLog(path);
  });

program.parse();
