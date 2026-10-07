import { describe, expect, it } from 'vitest';
import { calculateNewExpiry } from '../src/modules/subscriptions/subscription.logic.js';

const day = 86_400_000;
describe('calculateNewExpiry', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  it('creates a new subscription from now', () =>
    expect(calculateNewExpiry(now, undefined, 30)?.getTime()).toBe(now.getTime() + 30 * day));
  it('extends an active subscription from existing expiry', () => {
    const current = new Date(now.getTime() + 10 * day);
    expect(calculateNewExpiry(now, current, 30)?.getTime()).toBe(current.getTime() + 30 * day);
  });
  it('renews an expired subscription from now', () => {
    const expired = new Date(now.getTime() - day);
    expect(calculateNewExpiry(now, expired, 30)?.getTime()).toBe(now.getTime() + 30 * day);
  });
  it('returns null for lifetime', () =>
    expect(calculateNewExpiry(now, undefined, null)).toBeNull());
});
