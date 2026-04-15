/**
 * Wolt Tracker – Bun Server
 * Serves landing + tracker pages, handles tracking processes,
 * real-time WebSocket event delivery, and push notifications.
 */

import index from "./index.html";
import tracker from "./tracker.html";
import { join } from "path";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { spawn } from "child_process";
import type { ServerWebSocket } from "bun";
import type { TrackingEvent } from "./src/types";

// ─────────────────────────────────────────
// Constants & paths
// ─────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;
const LOGS_DIR = join(import.meta.dir, "logs");
const PUBLIC_DIR = join(import.meta.dir, "public");
const VAPID_FILE = join(import.meta.dir, "vapid-keys.json");

// Ensure directories exist
if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });

// ─────────────────────────────────────────
// VAPID keys (push notifications)
// ─────────────────────────────────────────

interface VapidKeys { publicKey: string; privateKey: string }

let webpush: typeof import("web-push") | null = null;
let vapidKeys: VapidKeys = { publicKey: "", privateKey: "" };

async function initPush() {
  try {
    webpush = await import("web-push");

    // 1. Prefer env vars (Railway / production)
    const envPub = process.env.VAPID_PUBLIC_KEY;
    const envPriv = process.env.VAPID_PRIVATE_KEY;
    if (envPub && envPriv) {
      vapidKeys = { publicKey: envPub, privateKey: envPriv };
    } else if (existsSync(VAPID_FILE)) {
      // 2. Fall back to on-disk file (local dev)
      vapidKeys = JSON.parse(readFileSync(VAPID_FILE, "utf-8")) as VapidKeys;
    } else {
      // 3. Generate + persist locally (first run in dev)
      vapidKeys = webpush.generateVAPIDKeys();
      try { writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2)); }
      catch { /* read-only FS in production – fine, keep in-memory */ }
    }

    const contact = process.env.VAPID_CONTACT_EMAIL ?? "mailto:admin@localhost";
    webpush.setVapidDetails(contact, vapidKeys.publicKey, vapidKeys.privateKey);
    console.log("✓ Push notifications enabled");
  } catch {
    console.warn("⚠ web-push not available — push notifications disabled");
  }
}

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────

type WsData = { code: string };

interface ActiveTracker {
  pid: number;
  kill: () => void;
}

const activeTrackers = new Map<string, ActiveTracker>();
const codeWatchers = new Map<string, Set<ServerWebSocket<WsData>>>();
const lastBroadcastTs = new Map<string, string>();
const pushSubs = new Map<string, Set<object>>();

// ─────────────────────────────────────────
// File I/O helpers
// ─────────────────────────────────────────

function readEvents(code: string): TrackingEvent[] {
  const path = join(LOGS_DIR, `${code}.jsonl`);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8").trim();
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as TrackingEvent);
}

function readEventsAfter(code: string, after: string): TrackingEvent[] {
  return readEvents(code).filter((e) => e.timestamp > after);
}

function listLogs() {
  if (!existsSync(LOGS_DIR)) return [];
  return readdirSync(LOGS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const code = f.replace(".jsonl", "");
      const events = readEvents(code);
      const first = events[0];
      const last = events[events.length - 1];
      return {
        code,
        restaurantName: first?.restaurantName ?? "Unknown",
        eventCount: events.length,
        startedAt: first?.timestamp,
        lastUpdatedAt: last?.timestamp,
        lastStep: last?.status.step ?? 0,
      };
    })
    .sort((a, b) => (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? ""));
}

// ─────────────────────────────────────────
// URL helpers
// ─────────────────────────────────────────

function extractCode(url: string): string | null {
  const m = url.match(/\/s\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

function isValidWoltUrl(url: string): boolean {
  return /track\.wolt\.com\/(?:[^/]+\/)?s\/[A-Za-z0-9_-]+/.test(url);
}

// ─────────────────────────────────────────
// WebSocket broadcast
// ─────────────────────────────────────────

function broadcastToCode(code: string, payload: object) {
  const clients = codeWatchers.get(code);
  if (!clients || clients.size === 0) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    try { ws.send(msg); } catch { clients.delete(ws); }
  }
}

// ─────────────────────────────────────────
// Push notifications
// ─────────────────────────────────────────

async function sendPush(code: string, title: string, body: string) {
  if (!webpush) return;
  const subs = pushSubs.get(code);
  if (!subs || subs.size === 0) return;
  const payload = JSON.stringify({ title, body, code });
  const toRemove: object[] = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub as Parameters<typeof webpush.sendNotification>[0], payload);
    } catch (err: unknown) {
      const s = (err as { statusCode?: number }).statusCode;
      if (s === 410 || s === 404) toRemove.push(sub);
    }
  }
  for (const sub of toRemove) subs.delete(sub);
}

function shouldNotify(event: TrackingEvent): boolean {
  return event.changes.some((c) =>
    c.toLowerCase().includes("status") || c.toLowerCase().includes("step"),
  );
}

// ─────────────────────────────────────────
// Polling loop – detect new events and broadcast
// ─────────────────────────────────────────

function pollNewEvents() {
  const codes = new Set([...codeWatchers.keys(), ...activeTrackers.keys()]);
  for (const code of codes) {
    const clients = codeWatchers.get(code);
    const hasClients = clients && clients.size > 0;
    if (!hasClients && !activeTrackers.has(code)) continue;

    const lastTs = lastBroadcastTs.get(code) ?? "";
    if (!lastTs) {
      // Initialise with current last event to avoid replaying history
      const existing = readEvents(code);
      if (existing.length > 0) {
        lastBroadcastTs.set(code, existing[existing.length - 1]!.timestamp);
      }
      continue;
    }

    const newEvents = readEventsAfter(code, lastTs);
    if (newEvents.length === 0) continue;

    const latest = newEvents[newEvents.length - 1]!;
    lastBroadcastTs.set(code, latest.timestamp);

    for (const event of newEvents) {
      broadcastToCode(code, { type: "event", event });
      if (shouldNotify(event)) {
        sendPush(code, `${event.restaurantName} – ${event.status.label}`, event.status.description);
      }
    }

    if (latest.status.step === 5) {
      broadcastToCode(code, { type: "delivered", event: latest });
    }
  }
}

setInterval(pollNewEvents, 800);

// ─────────────────────────────────────────
// API handlers
// ─────────────────────────────────────────

async function handleTrackPost(req: Request): Promise<Response> {
  let body: { url?: string; action?: string };
  try { body = (await req.json()) as { url?: string; action?: string }; }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { url, action } = body;

  if (action === "stop" && url) {
    const code = extractCode(url);
    if (code) {
      const t = activeTrackers.get(code);
      if (t) {
        t.kill();
        activeTrackers.delete(code);
        broadcastToCode(code, { type: "tracker_stopped" });
        return Response.json({ status: "stopped", code });
      }
    }
    return Response.json({ status: "not_running" });
  }

  if (!url || !isValidWoltUrl(url)) {
    return Response.json({ error: "Invalid Wolt tracking URL" }, { status: 400 });
  }

  const code = extractCode(url);
  if (!code) return Response.json({ error: "Could not extract tracking code" }, { status: 400 });

  // Seed lastBroadcastTs from any existing log so we only push NEW events
  if (!lastBroadcastTs.has(code)) {
    const existing = readEvents(code);
    lastBroadcastTs.set(code, existing.length > 0 ? existing[existing.length - 1]!.timestamp : "");
  }

  if (activeTrackers.has(code)) {
    return Response.json({ status: "already_tracking", code });
  }

  const trackerScript = join(import.meta.dir, "src", "index.ts");
  const child = spawn("bun", ["run", trackerScript, "track", url], {
    cwd: import.meta.dir,
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  activeTrackers.set(code, {
    pid: child.pid!,
    kill: () => {
      try { process.kill(-child.pid!, "SIGTERM"); }
      catch { try { child.kill("SIGTERM"); } catch { /* already gone */ } }
    },
  });

  child.on("exit", () => {
    activeTrackers.delete(code);
    broadcastToCode(code, { type: "tracker_stopped" });
  });

  return Response.json({ status: "started", code, pid: child.pid });
}

function handleTrackGet(): Response {
  return Response.json({
    activeTrackers: Array.from(activeTrackers.entries()).map(([code, { pid }]) => ({ code, pid })),
  });
}

async function handleEventsGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.json({ error: "Missing code" }, { status: 400 });
  const after = url.searchParams.get("after") ?? "";
  return Response.json({ events: after ? readEventsAfter(code, after) : readEvents(code) });
}

function handleLogsGet(): Response {
  return Response.json({ logs: listLogs() });
}

function handleStatusGet(req: Request): Response {
  const code = new URL(req.url).pathname.split("/").pop() ?? "";
  const events = readEvents(code);
  return Response.json({
    active: activeTrackers.has(code),
    eventCount: events.length,
    lastEvent: events[events.length - 1] ?? null,
  });
}

async function handlePushSubscribePost(req: Request): Promise<Response> {
  let body: { subscription?: object; code?: string };
  try { body = (await req.json()) as { subscription?: object; code?: string }; }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { subscription, code } = body;
  if (!subscription || !code) return Response.json({ error: "Missing fields" }, { status: 400 });
  if (!pushSubs.has(code)) pushSubs.set(code, new Set());
  pushSubs.get(code)!.add(subscription);
  return Response.json({ status: "subscribed" });
}

async function handlePushUnsubscribePost(req: Request): Promise<Response> {
  let body: { endpoint?: string; code?: string };
  try { body = (await req.json()) as { endpoint?: string; code?: string }; }
  catch { return Response.json({ status: "ok" }); }
  const { endpoint, code } = body;
  if (endpoint && code) {
    const subs = pushSubs.get(code);
    if (subs) {
      for (const sub of subs) {
        if ((sub as { endpoint?: string }).endpoint === endpoint) { subs.delete(sub); break; }
      }
    }
  }
  return Response.json({ status: "unsubscribed" });
}

// ─────────────────────────────────────────
// Server
// ─────────────────────────────────────────

await initPush();

const server = Bun.serve<WsData>({
  port: PORT,
  hostname: "0.0.0.0",

  routes: {
    // ── Pages ────────────────────────────────────────────────────────────────
    "/": index,
    "/track/:code": tracker,

    // ── API ──────────────────────────────────────────────────────────────────
    "/api/track": {
      POST: handleTrackPost,
      GET: handleTrackGet,
    },
    "/api/events": {
      GET: handleEventsGet,
    },
    "/api/logs": {
      GET: handleLogsGet,
    },
    "/api/status/:code": {
      GET: handleStatusGet,
    },
    "/api/vapid-public-key": {
      GET: () => Response.json({ publicKey: vapidKeys.publicKey }),
    },
    "/api/push-subscribe": {
      POST: handlePushSubscribePost,
    },
    "/api/push-unsubscribe": {
      POST: handlePushUnsubscribePost,
    },

    // ── Health check (Railway) ───────────────────────────────────────────────
    "/health": {
      GET: () => Response.json({
        status: "ok",
        activeTrackers: activeTrackers.size,
        watchers: codeWatchers.size,
        uptime: process.uptime(),
      }),
    },
  },

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade for real-time event stream
    if (url.pathname.startsWith("/ws/")) {
      const code = url.pathname.slice(4);
      if (!code) return new Response("Missing tracking code", { status: 400 });
      if (server.upgrade(req, { data: { code } })) return undefined as unknown as Response;
      return new Response("WebSocket upgrade failed", { status: 426 });
    }

    // Service worker
    if (url.pathname === "/sw.js") {
      const swPath = join(PUBLIC_DIR, "sw.js");
      return new Response(
        existsSync(swPath) ? Bun.file(swPath) : "// sw not found",
        {
          headers: {
            "Content-Type": "application/javascript",
            "Service-Worker-Allowed": "/",
            "Cache-Control": "no-cache",
          },
        },
      );
    }

    // Static public files
    if (url.pathname.startsWith("/public/")) {
      const filePath = join(PUBLIC_DIR, url.pathname.slice(8));
      if (existsSync(filePath)) return new Response(Bun.file(filePath));
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws) {
      const { code } = ws.data;
      if (!codeWatchers.has(code)) codeWatchers.set(code, new Set());
      codeWatchers.get(code)!.add(ws);

      // Seed broadcast timestamp for this code
      if (!lastBroadcastTs.has(code)) {
        const existing = readEvents(code);
        lastBroadcastTs.set(code, existing.length > 0 ? existing[existing.length - 1]!.timestamp : "");
      }

      // Immediately inform client of live status
      ws.send(JSON.stringify({ type: "status", active: activeTrackers.has(code) }));
    },

    close(ws) {
      codeWatchers.get(ws.data.code)?.delete(ws);
    },

    message(ws, message) {
      if (message === "ping") ws.send("pong");
    },
  },
});

console.log(`🚀 Wolt Tracker running at http://localhost:${server.port}`);
