import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_PREFIX = "shikor_share_";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for share link signing");
  }
  return secret;
}

export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(passcode, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPasscode(passcode: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(passcode, salt, 64);
  const storedBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
}

export async function setShareAccessCookie(treeId: string, linkId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payloadB64 = Buffer.from(
    JSON.stringify({ treeId, linkId, exp }),
  ).toString("base64url");
  const sig = signPayload(payloadB64);

  const cookieStore = await cookies();
  cookieStore.set(`${COOKIE_PREFIX}${treeId}`, `${payloadB64}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getValidShareLinkIdFromCookie(
  treeId: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(`${COOKIE_PREFIX}${treeId}`)?.value;
  if (!raw) return null;

  const [payloadB64, sig] = raw.split(".");
  if (!payloadB64 || !sig) return null;

  const expectedSig = signPayload(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { treeId: string; linkId: string; exp: number };
    if (parsed.treeId !== treeId) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed.linkId;
  } catch {
    return null;
  }
}
