import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runC2paDemo } from "./c2paDemo";
import { DemoEngine } from "./demoEngine";
import {
  LiveDemoConflictError,
  LiveDemoController,
  LiveDemoNotFoundError,
} from "./liveDemoController";

const PORT = parsePort(process.env["PORT"] ?? "4173");
const HOST = process.env["TANCMARK_DEMO_BIND"]?.trim() || "127.0.0.1";
const BODY_LIMIT = 8_192;
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 16;
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "public");
const engine = new DemoEngine();
const live = new LiveDemoController(engine);
const sessions = new Map<string, { csrf: string; expiresAt: number; usedTokens: Set<string> }>();
const rates = new Map<string, { count: number; resetAt: number }>();

const server = http.createServer(async (request, response) => {
  setSecurityHeaders(response);
  try {
    await route(request, response);
  } catch (error) {
    const status = safeStatus(error);
    sendJson(response, status, {
      error: status === 504 ? "DEMO_OPERATION_TIMED_OUT" : "DEMO_REQUEST_FAILED",
      demoOnly: true,
      productionOwnership: false,
      productionVault: false,
    });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`${JSON.stringify({
    status: "TANCMARK_DEMO_SERVER_STARTED",
    host: HOST,
    port: PORT,
    profile: "CODESPACES_LINUX_DEMO_PROFILE_V1",
    demoOnly: true,
  })}\n`);
});

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void shutdownDemoServer(); });
}

async function shutdownDemoServer(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  const hardStop = setTimeout(() => process.exit(1), 15_000);
  hardStop.unref();
  try {
    await live.shutdown();
    engine.reset();
    sessions.clear();
    rates.clear();
    clearTimeout(hardStop);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://demo.invalid");
  const liveMediaRequest = method === "GET" && url.pathname.startsWith("/demo/live/media/");
  if (url.search && !liveMediaRequest) return sendJson(response, 400, { error: "DEMO_QUERY_REJECTED" });
  if (liveMediaRequest) assertAllowedLiveMediaQuery(url.searchParams);
  if (!rateAllowed(request, url.pathname)) return sendJson(response, 429, { error: "DEMO_RATE_LIMITED" });
  if (method === "GET" && url.pathname === "/demo/health") {
    return sendJson(response, 200, {
      status: "ok",
      profile: "CODESPACES_LINUX_DEMO_PROFILE_V1",
      demoOnly: true,
      productionVault: false,
    });
  }
  if (method === "GET" && url.pathname === "/demo") {
    const session = issueSession(response);
    const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8")
      .replaceAll("__CSRF_TOKEN__", session.csrf);
    return sendBytes(response, 200, "text/html; charset=utf-8", Buffer.from(html, "utf8"));
  }
  if (method === "GET" && url.pathname === "/demo/app.js") {
    return sendBytes(response, 200, "text/javascript; charset=utf-8", fs.readFileSync(path.join(publicDir, "app.js")));
  }
  if (method === "GET" && url.pathname === "/demo/hls.min.js") {
    return sendBytes(response, 200, "text/javascript; charset=utf-8", fs.readFileSync(path.join(publicDir, "hls.min.js")));
  }
  if (method === "GET" && url.pathname === "/demo/styles.css") {
    return sendBytes(response, 200, "text/css; charset=utf-8", fs.readFileSync(path.join(publicDir, "styles.css")));
  }
  if (method === "GET" && url.pathname === "/demo/live/status") {
    const session = requireSession(request);
    return sendJson(response, 200, live.status(session.id, request.headers["x-demo-playback-observed"] === "1"));
  }
  if (method === "GET" && url.pathname === "/demo/live/playback") {
    const session = requireSession(request);
    const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8")
      .replaceAll("__CSRF_TOKEN__", session.csrf);
    return sendBytes(response, 200, "text/html; charset=utf-8", Buffer.from(html, "utf8"));
  }
  if (method === "GET" && url.pathname.startsWith("/demo/live/media/")) {
    requireSession(request);
    return await proxyLiveMedia(url, response);
  }
  if (method !== "POST") return sendJson(response, 404, { error: "DEMO_ROUTE_NOT_FOUND" });
  const session = requireSession(request);
  assertSameOrigin(request);
  assertCsrf(request, session);
  const body = await readJson(request);

  if (url.pathname === "/demo/text/seal" || url.pathname === "/demo/text/recover") {
    assertAllowedKeys(body, ["text"]);
    const text = typeof body["text"] === "string" ? body["text"] : undefined;
    return sendJson(response, 200, await engine.runText(text));
  }
  if (url.pathname === "/demo/image/seal" || url.pathname === "/demo/image/recover") {
    assertAllowedKeys(body, []);
    return sendJson(response, 200, await engine.runImage());
  }
  if (url.pathname === "/demo/audio/seal" || url.pathname === "/demo/audio/recover") {
    assertAllowedKeys(body, ["sampleRate"]);
    assertNoLiveConflict();
    const sampleRate = body["sampleRate"] === 44_100 ? 44_100 : 48_000;
    return sendJson(response, 200, await heavyGate.run(() => withTimeout(engine.runAudio(sampleRate), 180_000)));
  }
  if (url.pathname === "/demo/video/seal" || url.pathname === "/demo/video/recover") {
    assertAllowedKeys(body, []);
    assertNoLiveConflict();
    return sendJson(response, 200, await heavyGate.run(() => withTimeout(engine.runVideo({ includePreviewData: true }), 600_000)));
  }
  if (url.pathname === "/demo/registry/verify") {
    assertAllowedKeys(body, []);
    return sendJson(response, 200, engine.runRegistryVerification());
  }
  if (url.pathname === "/demo/live/start") {
    assertAllowedKeys(body, []);
    if (heavyGate.busy) throw new DemoHttpError(503, "DEMO_BUSY");
    return sendJson(response, 202, live.start(session.id));
  }
  if (url.pathname === "/demo/live/stop") {
    assertAllowedKeys(body, []);
    return sendJson(response, 200, await live.stop(session.id));
  }
  if (url.pathname === "/demo/c2pa/inspect" || url.pathname === "/demo/c2pa/test-sign-verify") {
    assertAllowedKeys(body, []);
    assertNoLiveConflict();
    const record = engine.registry.createRecord("c2pa");
    return sendJson(response, 200, await heavyGate.run(() => runC2paDemo({
      runtime: engine.paths,
      registry: engine.registry,
      record,
    })));
  }
  if (url.pathname === "/demo/reset") {
    assertAllowedKeys(body, []);
    assertNoLiveConflict();
    engine.reset();
    sessions.delete(session.id);
    return sendJson(response, 200, {
      status: "DEMO_RESET_COMPLETED",
      remainingDemoDatabaseRows: 0,
      remainingDemoTemporaryDirectories: 0,
      productionOwnership: false,
      productionVault: false,
    });
  }
  return sendJson(response, 404, { error: "DEMO_ROUTE_NOT_FOUND" });
}

class HeavyGate {
  #active = 0;
  #queued = 0;
  constructor(readonly concurrency: number, readonly queueLimit: number) {}

  get busy(): boolean {
    return this.#active > 0 || this.#queued > 0;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#active >= this.concurrency) {
      if (this.#queued >= this.queueLimit) throw new DemoHttpError(503, "DEMO_BUSY");
      this.#queued += 1;
      try {
        while (this.#active >= this.concurrency) await delay(50);
      } finally {
        this.#queued -= 1;
      }
    }
    this.#active += 1;
    try {
      return await operation();
    } finally {
      this.#active -= 1;
    }
  }
}

const heavyGate = new HeavyGate(1, 2);

class DemoHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function issueSession(response: ServerResponse) {
  pruneSessions();
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value as string | undefined;
    if (oldest) sessions.delete(oldest);
  }
  const id = randomBytes(32).toString("base64url");
  const csrf = randomBytes(32).toString("base64url");
  const session = { csrf, expiresAt: Date.now() + SESSION_TTL_MS, usedTokens: new Set<string>() };
  sessions.set(id, session);
  response.setHeader("Set-Cookie", `tancmark_demo=${id}; Path=/demo; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`);
  return { id, ...session };
}

function requireSession(request: IncomingMessage) {
  pruneSessions();
  const cookies = Object.fromEntries(
    (request.headers.cookie ?? "").split(";").map((part) => part.trim().split("=")).filter((pair) => pair.length === 2),
  );
  const id = cookies["tancmark_demo"];
  const value = id ? sessions.get(id) : undefined;
  if (!id || !value || value.expiresAt <= Date.now()) throw new DemoHttpError(401, "DEMO_SESSION_REQUIRED");
  return { id, ...value };
}

function assertCsrf(request: IncomingMessage, session: ReturnType<typeof requireSession>): void {
  const token = request.headers["x-csrf-token"];
  if (typeof token !== "string" || !timingSafeTextEqual(token, session.csrf)) {
    throw new DemoHttpError(403, "DEMO_CSRF_REJECTED");
  }
  const nonce = request.headers["x-demo-request-token"];
  if (typeof nonce !== "string" || nonce.length < 16 || nonce.length > 128) {
    throw new DemoHttpError(403, "DEMO_REQUEST_TOKEN_REQUIRED");
  }
  if (session.usedTokens.has(nonce)) throw new DemoHttpError(409, "DEMO_REQUEST_TOKEN_REUSED");
  session.usedTokens.add(nonce);
  if (session.usedTokens.size > 64) session.usedTokens.delete(session.usedTokens.values().next().value as string);
}

function assertSameOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) throw new DemoHttpError(403, "DEMO_SAME_ORIGIN_REQUIRED");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new DemoHttpError(403, "DEMO_ORIGIN_INVALID");
  }
  if (originHost !== host) throw new DemoHttpError(403, "DEMO_CROSS_ORIGIN_REJECTED");
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new DemoHttpError(415, "DEMO_JSON_ONLY");
  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > BODY_LIMIT) throw new DemoHttpError(413, "DEMO_BODY_TOO_LARGE");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > BODY_LIMIT) throw new DemoHttpError(413, "DEMO_BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new DemoHttpError(400, "DEMO_JSON_INVALID");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DemoHttpError(400, "DEMO_JSON_OBJECT_REQUIRED");
  }
  return parsed as Record<string, unknown>;
}

function assertAllowedKeys(body: Record<string, unknown>, allowed: string[]): void {
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.includes(key)) throw new DemoHttpError(400, "DEMO_FIELD_REJECTED");
    if (typeof value === "string" && (/^(?:[a-z]:[\\/]|\/|\\\\)/i.test(value) || /^https?:\/\//i.test(value))) {
      throw new DemoHttpError(400, "DEMO_PATH_OR_URL_REJECTED");
    }
  }
}

function rateAllowed(request: IncomingMessage, pathname: string): boolean {
  const category = pathname.startsWith("/demo/live/media/") ? "media" : "api";
  const key = createHash("sha256").update(`${request.socket.remoteAddress ?? "unknown"}\0${category}`).digest("hex");
  const now = Date.now();
  const rate = rates.get(key);
  if (!rate || rate.resetAt <= now) {
    rates.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  rate.count += 1;
  return rate.count <= (pathname.startsWith("/demo/live/media/") ? 240 : 60);
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  if (response.writableEnded) return;
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  sendBytes(response, status, "application/json; charset=utf-8", bytes);
}

function sendBytes(response: ServerResponse, status: number, type: string, bytes: Buffer): void {
  if (response.writableEnded) return;
  response.writeHead(status, { "Content-Type": type, "Content-Length": bytes.length });
  response.end(bytes);
}

function safeStatus(error: unknown): number {
  if (error instanceof DemoHttpError) return error.status;
  if (error instanceof LiveDemoConflictError) return 409;
  if (error instanceof LiveDemoNotFoundError) return 404;
  if (error instanceof Error && error.message === "DEMO_OPERATION_TIMED_OUT") return 504;
  return 500;
}

function assertNoLiveConflict(): void {
  if (live.active) throw new DemoHttpError(503, "DEMO_BUSY");
}

function assertAllowedLiveMediaQuery(search: URLSearchParams): void {
  for (const [key, value] of search) {
    const valid =
      (key === "session" && /^[a-f0-9-]{36}$/i.test(value)) ||
      ((key === "_HLS_msn" || key === "_HLS_part") && /^\d{1,12}$/.test(value)) ||
      (key === "_HLS_skip" && /^(?:YES|v2)$/i.test(value));
    if (!valid) throw new DemoHttpError(400, "DEMO_LIVE_MEDIA_QUERY_REJECTED");
  }
}

async function proxyLiveMedia(url: URL, response: ServerResponse): Promise<void> {
  const match = /^\/demo\/live\/media\/demo_live\/([A-Za-z0-9_.-]{1,160})$/.exec(url.pathname);
  if (!match) throw new DemoHttpError(404, "DEMO_LIVE_MEDIA_NOT_FOUND");
  let upstream: Response;
  try {
    // codeql[js/request-forgery] False positive: host and port are fixed loopback; the path and query are strict allowlists above.
    upstream = await fetch(`http://127.0.0.1:8888/demo_live/${match[1]}${url.search}`, {
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new DemoHttpError(503, "DEMO_LIVE_MEDIA_NOT_READY");
  }
  if (!upstream.ok) throw new DemoHttpError(upstream.status === 404 ? 404 : 503, "DEMO_LIVE_MEDIA_NOT_READY");
  const contentLength = Number(upstream.headers.get("content-length") ?? 0);
  if (contentLength > 8_000_000) throw new DemoHttpError(413, "DEMO_LIVE_MEDIA_TOO_LARGE");
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length > 8_000_000) throw new DemoHttpError(413, "DEMO_LIVE_MEDIA_TOO_LARGE");
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  if (!/^(?:application\/vnd\.apple\.mpegurl|application\/x-mpegurl|video\/mp4|audio\/mp4|application\/octet-stream)/i.test(type)) {
    throw new DemoHttpError(502, "DEMO_LIVE_MEDIA_TYPE_REJECTED");
  }
  sendBytes(response, 200, type, bytes);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("DEMO_OPERATION_TIMED_OUT")), timeoutMs);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function timingSafeTextEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return a.equals(b);
}

function pruneSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) throw new Error("DEMO_PORT_INVALID");
  return port;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
