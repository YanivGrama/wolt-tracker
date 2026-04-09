import { chromium, type Browser } from "playwright";
import { startTracker } from "./tracker.ts";

/**
 * Manages multiple order trackers sharing a single Playwright browser instance.
 * Each tracker gets its own browser context (isolated cookies/storage).
 */
export class TrackerPool {
  private browser: Browser | null = null;
  private activeTrackers = new Set<string>();
  private shutdownRequested = false;

  async start(urls: string[]): Promise<void> {
    this.browser = await chromium.launch({ headless: true });

    const cleanupAndExit = async () => {
      if (this.shutdownRequested) return;
      this.shutdownRequested = true;
      console.log("\nShutting down...");
      await this.close();
      process.exit(0);
    };

    process.on("SIGINT", cleanupAndExit);
    process.on("SIGTERM", cleanupAndExit);

    const promises = urls.map(async (url) => {
      const context = await this.browser!.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 900 },
      });

      const code = url.match(/\/s\/([A-Za-z0-9_-]+)/)?.[1] ?? url;
      this.activeTrackers.add(code);

      return startTracker({
        url,
        context,
        onDone: (c) => {
          this.activeTrackers.delete(c);
          context.close().catch(() => {});
          if (this.activeTrackers.size === 0 && !this.shutdownRequested) {
            console.log("All orders delivered. Exiting.");
            this.close().then(() => process.exit(0));
          }
        },
      });
    });

    await Promise.allSettled(promises);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
