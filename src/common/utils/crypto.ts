import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** 256 bits of entropy, URL-safe. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
