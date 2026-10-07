export const moneyEquals = (expectedKopecks: number, receivedKopecks: number) =>
  Number.isSafeInteger(receivedKopecks) && expectedKopecks === receivedKopecks;
export const canProcessPayment = (status: string, processedAt?: Date | null) =>
  status === 'succeeded' && !processedAt;
export const isReturnTokenValid = (
  expiresAt: Date,
  consumedAt: Date | null | undefined,
  now = new Date(),
) => !consumedAt && expiresAt > now;
