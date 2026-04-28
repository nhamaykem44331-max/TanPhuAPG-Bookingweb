import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

export function generateTempPassword(length = 12): string {
  const bytes = randomBytes(length);

  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
