export function calculateNewExpiry(
  now: Date,
  existingExpiresAt: Date | null | undefined,
  durationDays: number | null,
): Date | null {
  if (durationDays === null) return null;
  const base = existingExpiresAt && existingExpiresAt > now ? existingExpiresAt : now;
  return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
}
