import assert from "node:assert/strict";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { type AddressInfo } from "node:net";
import path from "node:path";
import type { Readable } from "node:stream";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { PrismaClient } from "@prisma/client";

type MockQuoteMode = "success" | "sold-out" | "expired" | "generic" | "cache-miss-once";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || process.env[key]) {
      continue;
    }

    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const prisma = new PrismaClient();
const nextLogs: string[] = [];
const mockState: { quoteMode: MockQuoteMode } = {
  quoteMode: "success",
};

const mockFlight = {
  id: "mock-flight-id",
  searchId: "mock-search-id",
  fareId: "mock-fare-id",
  airline: "Mock Vietjet",
  airlineCode: "VJ",
  flightNumber: "VJ123",
  departure: {
    airport: "SGN",
    airportName: "SGN",
    city: "SGN",
    time: "2026-05-15T08:00:00+07:00",
  },
  arrival: {
    airport: "HAN",
    airportName: "HAN",
    city: "HAN",
    time: "2026-05-15T10:10:00+07:00",
  },
  duration: 130,
  stops: 0,
  price: {
    amount: 2332200,
    currency: "VND" as const,
    source: "namthanh",
  },
  fareBreakdown: {
    baseAmount: 1610000,
    taxesFees: 722200,
    totalAmount: 2332200,
    currency: "VND" as const,
  },
  priceUSD: 88,
  sources: ["namthanh", "muadi"],
  namthanh: {
    flightId: "mock-flight-id",
    fareId: "mock-fare-id",
    source: "VJ",
    class: "E",
    cabinClass: "Eco",
    fareBasis: "B1_ECO",
  },
};

let backendServer: Server | null = null;
let backendUrl = "";
let nextProcess: ChildProcessByStdio<null, Readable, Readable> | null = null;
let nextBaseUrl = "";

function pushLog(prefix: string, chunk: Buffer | string) {
  const text = chunk.toString().trim();

  if (!text) {
    return;
  }

  nextLogs.push(`${prefix}${text}`);

  if (nextLogs.length > 120) {
    nextLogs.splice(0, nextLogs.length - 120);
  }
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? (JSON.parse(body) as Record<string, unknown>) : {};
}

function stableTestPnr(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }

  return `T${(hash >>> 0).toString(36).toUpperCase().slice(0, 5).padEnd(5, "0")}`;
}

async function createMockBackend(): Promise<void> {
  backendServer = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/config/exchange-rate") {
      sendJson(response, 200, { rate: 26000 });
      return;
    }

    if (request.method === "GET" && url.pathname === "/airports") {
      sendJson(response, 200, {
        airports: [
          { code: "SGN", domestic: true },
          { code: "HAN", domestic: true },
        ],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/flights/price") {
      const body = await readJson(request);

      if (mockState.quoteMode === "cache-miss-once" && body.searchId) {
        mockState.quoteMode = "success";
        sendJson(response, 404, {
          success: false,
          error: "QUOTE_EXPIRED",
          message: `Search not found or expired: ${String(body.searchId)}`,
        });
        return;
      }

      if (mockState.quoteMode === "sold-out") {
        sendJson(response, 409, {
          success: false,
          error: "SOLD_OUT",
          message: "sold out",
        });
        return;
      }

      if (mockState.quoteMode === "expired") {
        sendJson(response, 409, {
          success: false,
          error: "QUOTE_EXPIRED",
          message: "search not found or expired",
        });
        return;
      }

      if (mockState.quoteMode === "generic") {
        sendJson(response, 500, {
          success: false,
          error: "UPSTREAM_UNAVAILABLE",
          message: "backend exploded",
        });
        return;
      }

      sendJson(response, 200, {
        success: true,
        searchId: String(body.searchId || mockFlight.searchId),
        flightId: String(body.flightId || mockFlight.id),
        fareId: String(body.fareId || mockFlight.fareId),
        flight: mockFlight,
        fareBreakdown: mockFlight.fareBreakdown,
        summary: {
          total: mockFlight.fareBreakdown.totalAmount,
          class: mockFlight.namthanh.class,
          fareBasis: mockFlight.namthanh.fareBasis,
          cabinClass: mockFlight.namthanh.cabinClass,
        },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/bookings/hold") {
      const idempotencyKey = String(request.headers["idempotency-key"] || `hold-${Date.now()}`);
      const pnr = stableTestPnr(idempotencyKey);

      sendJson(response, 200, {
        success: true,
        sessionID: 987654,
        pnr,
        pnrs: [
          {
            airline: "VJ",
            pnr,
            status: "SUCCESS",
            timelimit: "2026-05-14T20:00:00+07:00",
          },
        ],
      });
      return;
    }

    sendJson(response, 404, {
      success: false,
      error: "NOT_FOUND",
    });
  });

  await new Promise<void>((resolve) => {
    backendServer!.listen(0, "127.0.0.1", resolve);
  });

  const address = backendServer.address() as AddressInfo;
  backendUrl = `http://127.0.0.1:${address.port}`;
}

async function getFreePort(): Promise<number> {
  const probe = createServer();

  await new Promise<void>((resolve) => {
    probe.listen(0, "127.0.0.1", resolve);
  });

  const { port } = probe.address() as AddressInfo;

  await new Promise<void>((resolve, reject) => {
    probe.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return port;
}

async function waitForNextReady(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/admin/me`, { redirect: "manual" });

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until the dev server finishes booting.
    }

    await delay(500);
  }

  throw new Error(`Next test server did not become ready.\n${nextLogs.join("\n")}`);
}

async function startNextApp(): Promise<void> {
  const port = await getFreePort();
  nextBaseUrl = `http://127.0.0.1:${port}`;

  const processHandle = spawn(
    process.execPath,
    [path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        NEXTAUTH_URL: nextBaseUrl,
        NAMTHANH_BACKEND_URL: backendUrl,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  nextProcess = processHandle;

  processHandle.stdout.on("data", (chunk) => pushLog("[next] ", chunk));
  processHandle.stderr.on("data", (chunk) => pushLog("[next:err] ", chunk));

  await waitForNextReady(nextBaseUrl);
}

async function stopNextApp(): Promise<void> {
  if (!nextProcess) {
    return;
  }

  const processToStop = nextProcess;
  nextProcess = null;

  processToStop.kill("SIGTERM");

  const exitResult = await Promise.race([
    once(processToStop, "exit"),
    delay(5_000).then(() => null),
  ]);

  if (exitResult === null) {
    processToStop.kill("SIGKILL");
    await once(processToStop, "exit");
  }
}

function createHoldPayload(idempotencyKey: string, dryRun: boolean): Record<string, unknown> {
  return {
    airline: mockFlight.airlineCode,
    route: `${mockFlight.departure.airport}-${mockFlight.arrival.airport}`,
    fareClass: mockFlight.namthanh.class,
    displayedNetPrice: mockFlight.fareBreakdown.totalAmount,
    flight: mockFlight,
    outbound: mockFlight,
    tripType: "oneway",
    search: {
      from: "SGN",
      to: "HAN",
      date: "2026-05-15",
    },
    adults: 1,
    children: 0,
    infants: 0,
    cabin: "economy",
    passengers: [
      {
        type: "ADT",
        fullName: "NGUYEN VAN TEST",
        lastName: "NGUYEN",
        firstName: "VAN TEST",
        dateOfBirth: "1990-01-01",
        gender: "M",
      },
    ],
    contact: {
      fullName: "NGUYEN VAN TEST",
      phone: "0912345678",
      email: `gate-c0-${idempotencyKey}@example.com`,
    },
    dryRun,
    idempotencyKey,
  };
}

async function postHold(payload: Record<string, unknown>): Promise<Response> {
  return fetch(`${nextBaseUrl}/api/booking/hold`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function bookingCount(idempotencyKey: string): Promise<number> {
  return prisma.booking.count({
    where: { idempotencyKey },
  });
}

async function cleanupHoldArtifacts(idempotencyKey: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { idempotencyKey: idempotencyKey.toUpperCase() },
    include: {
      paymentIntents: {
        select: { id: true },
      },
    },
  });

  if (booking) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: "Booking", entityId: booking.id },
          ...booking.paymentIntents.map((intent) => ({ entity: "PaymentIntent", entityId: intent.id })),
        ],
      },
    });
  }

  await prisma.booking.deleteMany({
    where: {
      idempotencyKey: {
        in: [idempotencyKey, idempotencyKey.toUpperCase()],
      },
    },
  });
  await prisma.customer.deleteMany({ where: { email: `gate-c0-${idempotencyKey}@example.com` } });
}

before(async () => {
  await createMockBackend();
  await startNextApp();
});

after(async () => {
  await stopNextApp();

  if (backendServer) {
    await new Promise<void>((resolve, reject) => {
      backendServer!.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  await prisma.$disconnect();
});

test("1. QuoteUnavailableError được map thành 409 SOLD_OUT và không tạo Booking", async () => {
  const idempotencyKey = `gate-c0-sold-out-${Date.now()}`;
  mockState.quoteMode = "sold-out";

  assert.equal(await bookingCount(idempotencyKey), 0);

  const response = await postHold(createHoldPayload(idempotencyKey, true));
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 409);
  assert.equal(body.error, "SOLD_OUT");
  assert.equal(await bookingCount(idempotencyKey), 0);
});

test("2. QuoteExpiredError được map thành 409 QUOTE_EXPIRED và không tạo Booking", async () => {
  const idempotencyKey = `gate-c0-expired-${Date.now()}`;
  mockState.quoteMode = "expired";

  assert.equal(await bookingCount(idempotencyKey), 0);

  const response = await postHold(createHoldPayload(idempotencyKey, true));
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 409);
  assert.equal(body.error, "QUOTE_EXPIRED");
  assert.equal(await bookingCount(idempotencyKey), 0);
});

test("2b. Search cache miss fallback route re-price va khong tra QUOTE_EXPIRED", async () => {
  const idempotencyKey = `gate-c0-cache-fallback-${Date.now()}`;
  mockState.quoteMode = "cache-miss-once";

  assert.equal(await bookingCount(idempotencyKey), 0);

  const response = await postHold(createHoldPayload(idempotencyKey, true));
  const body = (await response.json()) as { error?: string; success?: boolean };

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.error, undefined);
  assert.equal(body.success, true);
  assert.equal(await bookingCount(idempotencyKey), 0);
});

test("3. Lỗi quote generic được map thành BACKEND_DOWN retryable và không tạo Booking", async () => {
  const idempotencyKey = `gate-c0-generic-${Date.now()}`;
  mockState.quoteMode = "generic";

  assert.equal(await bookingCount(idempotencyKey), 0);

  const response = await postHold(createHoldPayload(idempotencyKey, true));
  const body = (await response.json()) as { error?: string; retryable?: boolean; retryDelayMs?: number };

  assert.equal(response.status, 503);
  assert.equal(body.error, "BACKEND_DOWN");
  assert.equal(body.retryable, true);
  assert.equal(body.retryDelayMs, 5000);
  assert.equal(await bookingCount(idempotencyKey), 0);
});

test("4. Public real hold không cần admin session và vẫn tạo Booking web", async () => {
  const idempotencyKey = `gate-c0-public-hold-${Date.now()}`;
  mockState.quoteMode = "success";

  assert.equal(await bookingCount(idempotencyKey), 0);

  const response = await postHold(createHoldPayload(idempotencyKey, false));
  const body = (await response.json()) as { bookingId?: string; success?: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.bookingId);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: body.bookingId },
    select: {
      channel: true,
      createdById: true,
      pnr: true,
    },
  });

  assert.equal(booking.channel, "web");
  assert.equal(booking.createdById, null);
  assert.ok(booking.pnr);

  await cleanupHoldArtifacts(idempotencyKey);
});
