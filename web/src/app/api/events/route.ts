import { NextRequest, NextResponse } from "next/server";
import { readEvents, readEventsAfter } from "@/lib/logs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing 'code' query parameter" }, { status: 400 });
  }

  const after = request.nextUrl.searchParams.get("after");
  const events = after ? readEventsAfter(code, after) : readEvents(code);

  return NextResponse.json({ events });
}
