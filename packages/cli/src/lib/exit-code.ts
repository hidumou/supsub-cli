// packages/cli/src/lib/exit-code.ts
export const EXIT = {
  OK: 0,
  BUSINESS: 1,
  UNAUTHORIZED: 2,
  PLAN_EXPIRED: 3,
  NETWORK: 10,
  SERVER: 11,
  INVALID_ARGS: 64,
} as const;
