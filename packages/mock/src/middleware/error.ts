import type { Context } from "hono";
import { HTTPError } from "../lib/error.js";

export function onError(err: Error, c: Context): Response {
  if (err instanceof HTTPError) {
    const body: Record<string, unknown> = {
      code: err.code,
      message: err.message,
      status: err.status,
    };
    if (err.data !== undefined) {
      body.data = err.data;
    }
    return c.json(body, err.status as Parameters<typeof c.json>[1]);
  }

  // Unexpected errors → 500
  console.error("[mock-server] Unhandled error:", err);
  return c.json(
    {
      code: "INTERNAL_ERROR",
      message: err.message || "Internal server error",
      status: 500,
    },
    500,
  );
}
