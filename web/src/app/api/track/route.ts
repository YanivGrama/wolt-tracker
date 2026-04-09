import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";

const activeTrackers = new Map<string, { pid: number; kill: () => void }>();

function extractCode(url: string): string {
  const match = url.match(/\/s\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? "unknown";
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, action } = body as { url?: string; action?: "start" | "stop" };

  if (action === "stop" && url) {
    const code = extractCode(url);
    const tracker = activeTrackers.get(code);
    if (tracker) {
      tracker.kill();
      activeTrackers.delete(code);
      return NextResponse.json({ status: "stopped", code });
    }
    return NextResponse.json({ status: "not_running", code });
  }

  if (!url || !url.includes("track.wolt.com")) {
    return NextResponse.json({ error: "Invalid Wolt tracking URL" }, { status: 400 });
  }

  const code = extractCode(url);

  if (activeTrackers.has(code)) {
    return NextResponse.json({ status: "already_tracking", code });
  }

  const trackerScript = join(process.cwd(), "..", "src", "index.ts");
  const child = spawn("bun", ["run", trackerScript, "track", url], {
    cwd: join(process.cwd(), ".."),
    stdio: "ignore",
    detached: true,
  });

  child.unref();

  activeTrackers.set(code, {
    pid: child.pid!,
    kill: () => {
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {
        try { child.kill("SIGTERM"); } catch { /* already dead */ }
      }
    },
  });

  child.on("exit", () => {
    activeTrackers.delete(code);
  });

  return NextResponse.json({ status: "started", code, pid: child.pid });
}

export async function GET() {
  const active = Array.from(activeTrackers.entries()).map(([code, { pid }]) => ({
    code,
    pid,
  }));
  return NextResponse.json({ activeTrackers: active });
}
