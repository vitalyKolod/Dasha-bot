export type ReminderField =
  'reminder3DaysSentAt' | 'reminder1DaySentAt' | 'expirationNotificationSentAt';
export const shouldSendReminder = (sentAt: Date | null | undefined) => !sentAt;
