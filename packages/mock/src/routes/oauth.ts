import { Hono } from "hono";
import {
  createDevice,
  findByDeviceCode,
  updateLastPollAt,
} from "../store/devices.js";
import { httpError } from "../lib/error.js";
import { DEMO_API_KEY, DEVICE_CODE_TTL_SECONDS } from "../config.js";

const oauth = new Hono();

/** POST /open/api/v1/oauth/device/code */
oauth.post("/device/code", async (c) => {
  const record = createDevice();
  return c.json({
    code: record.device_code,
    verification_uri: "http://localhost:8787/device",
    user_code: record.user_code,
    expires_in: DEVICE_CODE_TTL_SECONDS,
    interval: record.interval,
  });
});

/** POST /open/api/v1/oauth/token */
oauth.post("/token", async (c) => {
  const body = await c.req.json<{
    grant_type: string;
    client_id: string;
    code: string;
  }>();

  const { code } = body;
  if (!code) {
    throw httpError(400, "INVALID_REQUEST", "Missing code");
  }

  const record = findByDeviceCode(code);
  if (!record) {
    throw httpError(400, "INVALID_GRANT", "Invalid device code");
  }

  const now = Date.now();

  // Check slow_down first (before updating last_poll_at)
  if (
    record.last_poll_at !== null &&
    now - record.last_poll_at < record.interval * 1000
  ) {
    // Update last_poll_at even on slow_down per spec
    updateLastPollAt(code, now);
    throw httpError(400, "SLOW_DOWN", "Polling too fast", {
      error: "slow_down",
    });
  }

  // Update last_poll_at
  updateLastPollAt(code, now);

  // Check expiry
  if (now > record.expires_at) {
    throw httpError(400, "EXPIRED_TOKEN", "Device code has expired", {
      error: "expired_token",
    });
  }

  switch (record.status) {
    case "pending":
      throw httpError(400, "AUTHORIZATION_PENDING", "用户尚未授权", {
        error: "authorization_pending",
      });

    case "authorized":
      return c.json({
        api_key: DEMO_API_KEY,
        client_id: "cli_demo_client",
      });

    case "denied":
      throw httpError(400, "ACCESS_DENIED", "用户已拒绝授权", {
        error: "access_denied",
      });

    case "expired":
      throw httpError(400, "EXPIRED_TOKEN", "Device code has expired", {
        error: "expired_token",
      });
  }
});

export default oauth;
