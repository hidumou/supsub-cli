import { generateUserCode, randomUUID } from "../lib/id.js";
import {
  DEVICE_CODE_TTL_SECONDS,
  DEVICE_CODE_INTERVAL_SECONDS,
} from "../config.js";

export type DeviceStatus =
  | "pending"
  | "authorized"
  | "denied"
  | "expired";

export interface DeviceRecord {
  device_code: string;
  user_code: string;
  status: DeviceStatus;
  created_at: number; // ms
  expires_at: number; // ms
  interval: number; // seconds
  last_poll_at: number | null; // ms
}

const devices = new Map<string, DeviceRecord>();

export function createDevice(): DeviceRecord {
  const device_code = randomUUID();
  const user_code = generateUserCode();
  const now = Date.now();
  const record: DeviceRecord = {
    device_code,
    user_code,
    status: "pending",
    created_at: now,
    expires_at: now + DEVICE_CODE_TTL_SECONDS * 1000,
    interval: DEVICE_CODE_INTERVAL_SECONDS,
    last_poll_at: null,
  };
  devices.set(device_code, record);
  return record;
}

export function findByDeviceCode(code: string): DeviceRecord | undefined {
  return devices.get(code);
}

export function findByUserCode(uc: string): DeviceRecord | undefined {
  for (const record of devices.values()) {
    if (record.user_code === uc) return record;
  }
  return undefined;
}

export function updateStatus(
  uc: string,
  status: DeviceStatus,
): boolean {
  const record = findByUserCode(uc);
  if (!record) return false;
  record.status = status;
  return true;
}

export function updateLastPollAt(device_code: string, ts: number): void {
  const record = devices.get(device_code);
  if (record) record.last_poll_at = ts;
}
