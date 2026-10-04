/**
 * Server-side proxy to the ngrok-tunneled backend. A plain Next.js `rewrite` isn't enough here: it
 * forwards the original browser's headers (including its User-Agent) to ngrok, which still classifies
 * that as browser traffic and serves its warning interstitial instead of proxying through. Building the
 * outgoing request ourselves lets us drop that signal and add ngrok's bypass header, so this always
 * looks like a plain server-to-server call.
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_TUNNEL_ORIGIN;

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  if (!BACKEND) return NextResponse.json({ detail: "Backend origin not configured" }, { status: 502 });

  const url = `${BACKEND}/api/v1/${path.join("/")}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.set("ngrok-skip-browser-warning", "true");

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const response = await fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // @ts-expect-error -- required by Node's fetch when streaming a request body
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
  });

  const outHeaders = new Headers(response.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");
  outHeaders.delete("transfer-encoding");
  return new NextResponse(response.body, { status: response.status, headers: outHeaders });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
