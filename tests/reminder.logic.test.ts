import { describe, expect, it } from 'vitest';
import { shouldSendReminder } from '../src/modules/reminders/reminder.logic.js';
describe('reminder idempotency', () => {
  it('sends only while sentAt is absent', () => {
    expect(shouldSendReminder(undefined)).toBe(true);
    expect(shouldSendReminder(new Date())).toBe(false);
  });
});
