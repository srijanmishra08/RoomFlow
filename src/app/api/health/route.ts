import { NextResponse } from "next/server";

// Liveness probe: process is up and serving. No external deps checked here so
// orchestrators don't restart the pod for a transient DB blip.
export async function GET() {
  return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
}
