export type ReminderField =
  | 'reminder3DaysSentAt'
  | 'reminder2DaysSentAt'
  | 'reminder1DaySentAt'
  | 'reminderTodaySentAt'
  | 'expirationNotificationSentAt';
export const shouldSendReminder = (sentAt: Date | null | undefined) => !sentAt;

const moscowDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'Europe/Moscow',
});

const calendarDay = (date: Date): number => {
  const parts = Object.fromEntries(
    moscowDate.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000;
};

export const daysUntilExpiration = (expiresAt: Date, now: Date): number =>
  calendarDay(expiresAt) - calendarDay(now);
