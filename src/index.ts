#!/usr/bin/env bun
import { run } from './cli/index.ts';

run().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
