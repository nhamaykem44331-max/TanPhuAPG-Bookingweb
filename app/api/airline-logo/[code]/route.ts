import { promises as fs } from "node:fs";
import path from "node:path";

import { type NextRequest, NextResponse } from "next/server";

import { readPersistentAirlineLogo, writePersistentAirlineLogo } from "@/lib/airlineLogoCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUNDLED_CACHE_DIR = path.join(process.cwd(), "public", "assets", "airlines");
const RUNTIME_CACHE_DIR = process.env.VERCEL
  ? path.join("/tmp", "airlines")
  : BUNDLED_CACHE_DIR;
const CACHE_READ_DIRS = Array.from(new Set([RUNTIME_CACHE_DIR, BUNDLED_CACHE_DIR]));
const EXTENSIONS = ["png", "webp", "jpg", "jpeg", "svg"] as const;
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function extensionFromContentType(contentType: string | null, sourceUrl: string): string {
  const lowerType = String(contentType || "").toLowerCase();

  if (lowerType.includes("svg")) return "svg";
  if (lowerType.includes("webp")) return "webp";
  if (lowerType.includes("jpeg") || lowerType.includes("jpg")) return "jpg";
  if (lowerType.includes("png")) return "png";

  const pathname = new URL(sourceUrl).pathname.toLowerCase();
  const match = pathname.match(/\.([a-z0-9]+)$/);
  const ext = match?.[1];

  return ext && EXTENSIONS.includes(ext as (typeof EXTENSIONS)[number]) ? ext : "png";
}

async function readCachedLogo(code: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  for (const cacheDir of CACHE_READ_DIRS) {
    for (const ext of EXTENSIONS) {
      const filePath = path.join(cacheDir, `${code}.${ext}`);

      try {
        const bytes = await fs.readFile(filePath);
        return { bytes, contentType: CONTENT_TYPES[ext] };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          console.warn("airline logo cache read failed", error);
        }
      }
    }
  }

  return null;
}

function imageResponse(bytes: Buffer, contentType: string): NextResponse {
  const body = new Uint8Array(bytes) as BodyInit;

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const code = normalizeCode(params.code);

  if (!code) {
    return NextResponse.json({ error: "INVALID_AIRLINE_CODE" }, { status: 400 });
  }

  const cached = await readCachedLogo(code);
  if (cached) {
    return imageResponse(cached.bytes, cached.contentType);
  }

  const persistentCached = await readPersistentAirlineLogo(code);
  if (persistentCached) {
    return imageResponse(persistentCached.bytes, persistentCached.contentType);
  }

  const source = request.nextUrl.searchParams.get("src");
  if (!source) {
    return NextResponse.json({ error: "LOGO_NOT_CACHED" }, { status: 404 });
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return NextResponse.json({ error: "INVALID_LOGO_SOURCE" }, { status: 400 });
  }

  if (!["https:", "http:"].includes(sourceUrl.protocol)) {
    return NextResponse.json({ error: "INVALID_LOGO_SOURCE" }, { status: 400 });
  }

  const upstream = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "apg-booking-manager/1.0",
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "LOGO_UPSTREAM_FAILED" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type");
  if (!String(contentType || "").toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "LOGO_UPSTREAM_NOT_IMAGE" }, { status: 502 });
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  const ext = extensionFromContentType(contentType, sourceUrl.toString());
  const finalContentType = CONTENT_TYPES[ext] ?? "image/png";

  try {
    await fs.mkdir(RUNTIME_CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(RUNTIME_CACHE_DIR, `${code}.${ext}`), bytes);
  } catch (error) {
    // Cache write is best-effort; still return the fetched image.
    console.warn("airline logo cache write failed", error);
  }

  await writePersistentAirlineLogo({
    code,
    bytes,
    contentType: finalContentType,
    sourceUrl: sourceUrl.toString(),
  });

  return imageResponse(bytes, finalContentType);
}
