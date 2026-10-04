/** Same rationale as app/api/v1/[...path]/route.ts — proxies document images/media server-side. */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_TUNNEL_ORIGIN;

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!BACKEND) return NextResponse.json({ detail: "Backend origin not configured" }, { status: 502 });

  const { path } = await params;
  const url = `${BACKEND}/static/${path.join("/")}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.set("ngrok-skip-browser-warning", "true");

  const response = await fetch(url, { headers, redirect: "manual" });
  const outHeaders = new Headers(response.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");
  outHeaders.delete("transfer-encoding");
  return new NextResponse(response.body, { status: response.status, headers: outHeaders });
}
