import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const createSecureToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export function safeEqualHex(actual: string, expected: string): boolean {
  const left = Buffer.from(actual.toLowerCase());
  const right = Buffer.from(expected.toLowerCase());
  return left.length === right.length && timingSafeEqual(left, right);
}
