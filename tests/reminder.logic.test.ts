import { describe, expect, it } from 'vitest';
import {
  daysUntilExpiration,
  shouldSendReminder,
} from '../src/modules/reminders/reminder.logic.js';
describe('reminder idempotency', () => {
  it('sends only while sentAt is absent', () => {
    expect(shouldSendReminder(undefined)).toBe(true);
    expect(shouldSendReminder(new Date())).toBe(false);
  });
});

describe('Moscow expiration date', () => {
  it('uses calendar days around midnight in Moscow', () => {
    const now = new Date('2026-10-26T20:59:00Z');
    expect(daysUntilExpiration(new Date('2026-10-26T21:01:00Z'), now)).toBe(1);
    expect(daysUntilExpiration(new Date('2026-10-26T20:59:30Z'), now)).toBe(0);
  });
});
