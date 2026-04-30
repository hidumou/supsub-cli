// packages/cli/test/auth-interval-fallback.test.ts
// add-cli-interval-fallback：interval ≤ 0 或缺失时回落 5000ms
//
// 该规则被抽离为纯函数 pickInitialIntervalMs，避免在测试中
// 注入 sleepFn。
import { describe, test, expect } from "bun:test";
import { pickInitialIntervalMs } from "../src/commands/auth/device-flow.ts";

describe("device-flow - pickInitialIntervalMs", () => {
  test("interval=0 触发 5000ms fallback", () => {
    expect(pickInitialIntervalMs(0)).toBe(5000);
  });

  test("interval=-1 触发 5000ms fallback", () => {
    expect(pickInitialIntervalMs(-1)).toBe(5000);
  });

  test("interval=3 使用服务端 3000ms，不触发 fallback", () => {
    expect(pickInitialIntervalMs(3)).toBe(3000);
  });
});
