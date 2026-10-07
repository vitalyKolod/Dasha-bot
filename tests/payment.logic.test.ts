import { describe, expect, it } from 'vitest';
import {
  canProcessPayment,
  isReturnTokenValid,
  moneyEquals,
} from '../src/modules/payments/payment.logic.js';
import { createSecureToken, hashToken } from '../src/shared/utils/crypto.js';
describe('payment safety', () => {
  it('allows a succeeded payment only once', () => {
    expect(canProcessPayment('succeeded')).toBe(true);
    expect(canProcessPayment('succeeded', new Date())).toBe(false);
    expect(canProcessPayment('pending')).toBe(false);
  });
  it('compares money exactly in integer kopecks', () => {
    expect(moneyEquals(99000, 99000)).toBe(true);
    expect(moneyEquals(99000, 98999)).toBe(false);
    expect(moneyEquals(99000, 99000.1)).toBe(false);
  });
  it('hashes return tokens without storing the original', () => {
    const token = createSecureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
  it('rejects expired and consumed return tokens', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(isReturnTokenValid(new Date('2026-01-01T00:01:00Z'), undefined, now)).toBe(true);
    expect(isReturnTokenValid(new Date('2025-12-31T23:59:00Z'), undefined, now)).toBe(false);
    expect(isReturnTokenValid(new Date('2026-01-01T00:01:00Z'), now, now)).toBe(false);
  });
});
