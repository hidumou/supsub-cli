function readPositiveInt(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const DEVICE_CODE_TTL_SECONDS = readPositiveInt("MOCK_DEVICE_TTL", 600);
export const DEVICE_CODE_INTERVAL_SECONDS = readPositiveInt(
  "MOCK_DEVICE_INTERVAL",
  2,
);
export const DEMO_API_KEY =
  process.env.MOCK_DEMO_KEY ?? "sk_live_demo_token_for_dev";
