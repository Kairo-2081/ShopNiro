export const areOnlinePaymentsEnabled = (
  env: Record<string, string | undefined> = process.env
): boolean => env.ONLINE_PAYMENTS_ENABLED?.trim().toLowerCase() !== 'false';