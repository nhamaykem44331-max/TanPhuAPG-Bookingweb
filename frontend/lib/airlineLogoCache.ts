import { prisma } from "@/lib/db";

const MAX_LOGO_BYTES = 512 * 1024;

export interface CachedAirlineLogo {
  bytes: Buffer;
  contentType: string;
}

function prismaBytes(bytes: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy;
}

export async function readPersistentAirlineLogo(code: string): Promise<CachedAirlineLogo | null> {
  try {
    const row = await prisma.airlineLogoCache.findUnique({
      where: { code },
      select: { bytes: true, contentType: true },
    });
    if (!row) return null;

    return {
      bytes: Buffer.from(row.bytes),
      contentType: row.contentType,
    };
  } catch (error) {
    console.warn("[airline-logo] persistent read skipped", error);
    return null;
  }
}

export async function writePersistentAirlineLogo(input: {
  code: string;
  bytes: Buffer;
  contentType: string;
  sourceUrl?: string;
}) {
  if (input.bytes.length > MAX_LOGO_BYTES) {
    return;
  }

  try {
    await prisma.airlineLogoCache.upsert({
      where: { code: input.code },
      update: {
        bytes: prismaBytes(input.bytes),
        contentType: input.contentType,
        size: input.bytes.length,
        sourceUrl: input.sourceUrl || null,
      },
      create: {
        code: input.code,
        bytes: prismaBytes(input.bytes),
        contentType: input.contentType,
        size: input.bytes.length,
        sourceUrl: input.sourceUrl || null,
      },
    });
  } catch (error) {
    console.warn("[airline-logo] persistent write skipped", error);
  }
}
