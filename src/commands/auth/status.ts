// packages/cli/src/commands/auth/status.ts
import type { Command } from 'commander';
import { getUserInfo } from '../../api/auth.ts';
import { resolveApiKey } from '../../http/credentials.ts';
import { dieWith } from '../../lib/errors.ts';
import { output } from '../../ui/output.ts';
import { printTable, truncate } from '../../ui/table.ts';

function maskApiKey(key: string): string {
  if (key.length <= 4) return `sk_live_***${key}`;
  return `sk_live_***${key.slice(-4)}`;
}

export function registerAuthStatus(parent: Command): void {
  parent
    .command('status')
    .description('查看当前登录状态')
    .action(async () => {
      const globalOpts = parent.parent!.opts() as { output?: string };
      const fmt = globalOpts.output;

      const { key, clientId, source } = await resolveApiKey();
      if (!key) {
        dieWith(
          { code: 'UNAUTHORIZED', message: '尚未登录，请运行 supsub auth login', status: 0 },
          fmt,
        );
      }

      const info = await getUserInfo();

      const apiKeySource = source ?? 'config';
      const maskedKey = maskApiKey(key);

      output(
        {
          email: info.email,
          name: info.name,
          client_id: clientId,
          api_key_source: apiKeySource,
          api_key: maskedKey,
        },
        fmt,
        () => {
          printTable({
            headers: ['字段', '值'],
            rows: [
              ['email', info.email],
              ['name', truncate(info.name, 30)],
              ['client_id', clientId ?? ''],
              ['api_key', maskedKey],
              ['api_key_source', apiKeySource],
              ['expired', String(info.expired)],
            ],
          });
        },
      );
    });
}
