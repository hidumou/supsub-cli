// packages/cli/src/commands/auth/login.ts
import type { Command } from "commander";
import { writeConfig } from "../../config/store.ts";
import { runDeviceFlow } from "./device-flow.ts";
import { output } from "../../ui/output.ts";

export function registerAuthLogin(parent: Command): void {
  parent
    .command("login")
    .description("登录 SupSub")
    .action(async () => {
      const globalOpts = parent.parent!.opts() as {
        apiKey?: string;
        output?: string;
      };
      const fmt = globalOpts.output;

      // 如果全局 --api-key 已设置，直接写入配置，跳过 Device Flow
      if (globalOpts.apiKey) {
        await writeConfig({ api_key: globalOpts.apiKey, client_id: "supsub-cli" });
        process.stderr.write("✅ 登录成功 \n");
        if (fmt === "json") {
          output({ client_id: "supsub-cli" }, "json", () => { });
        }
        return;
      }

      // Device Flow
      const { api_key, client_id } = await runDeviceFlow();
      await writeConfig({ api_key, client_id });
      process.stderr.write("✅ 登录成功\n");
      if (fmt === "json") {
        output({ client_id }, "json", () => { });
      }
    });
}
