export function randomUUID(): string {
  return crypto.randomUUID();
}

/** Generate a user code in the format XXXX-XXXX (uppercase alphanumeric) */
export function generateUserCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const part = () =>
    Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  return `${part()}-${part()}`;
}
