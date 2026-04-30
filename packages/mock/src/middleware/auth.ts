import type { Context, Next } from "hono";
import { httpError } from "../lib/error.js";
import { DEMO_API_KEY } from "../config.js";

export { DEMO_API_KEY } from "../config.js";

export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || authHeader !== `Bearer ${DEMO_API_KEY}`) {
    throw httpError(401, "UNAUTHORIZED", "Invalid api key");
  }
  await next();
}
