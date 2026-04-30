# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & package manager

- Runtime is **Bun** (not Node.js). The shebang in `src/index.ts` is `#!/usr/bin/env bun`. Use `bun` APIs freely; `package.json#engines.node` is informational only.
- Package manager is **pnpm** (>= 10). Never use `npm` or `yarn` — `.npmrc` sets `auto-install-peers=true` and `strict-peer-dependencies=false`.

## Commands

- `pnpm dev -- <args>` — run the CLI from source (`bun run src/index.ts`). Use this for local CLI testing, not the compiled binary.
- `pnpm build` — `bun build --compile` to a single executable at `dist/supsub`.
- `pnpm typecheck` — `tsc --noEmit`. Run after non-trivial type changes; build does not typecheck.
- `pnpm test` — `bun test` runs the **entire** suite, including `test/e2e/` which hits the live `https://supsub.net` API and requires real credentials. To skip e2e, target dirs explicitly: `bun test test/commands test/config test/http`.

## TypeScript config to respect

- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true` — array/record access returns `T | undefined`; narrow before use.
- `verbatimModuleSyntax: true` — type-only imports must use `import type`.
- Module target is ESNext with bundler resolution; no transpilation step besides `bun build`.

## Architectural rules

These conventions are enforced by the existing structure — new code must follow them or the abstractions break:

- **All HTTP goes through `src/http/client.ts`'s `request()`.** It handles auth header injection, error envelope normalization, and exit-code mapping. Do not call `fetch` directly from commands or `src/api/`.
- **Credential resolution lives in `src/http/credentials.ts`** with strict precedence: `--api-key` flag > `SUPSUB_API_KEY` env > `api_key` in config > `bearer_token` (transient browser session). A 401 response clears stored auth.
- **All command output goes through `src/ui/output.ts`'s `output()`.** It dispatches between JSON mode (`-o json`, errors to stdout for jq piping) and table mode (errors to stderr). Never `console.log` results directly.
- **Errors are `ErrorEnvelope` objects** (`src/lib/errors.ts`) with semantic exit codes from `src/lib/exit-code.ts`: `0` OK, `2` UNAUTHORIZED, `3` PLAN_EXPIRED, `10` NETWORK, `11` SERVER, `64` INVALID_ARGS. Callers may rely on these — do not change the mapping casually.
- **Commands follow the `register<Name>(parent: Command)` pattern** — see existing files in `src/commands/` for the shape.

## API base URL

Defaults to `https://supsub.net`. Override with `SUPSUB_API_URL` env var (resolved in `src/lib/api-url.ts`). Use this for local API server testing.

## Config file

- Path is `~/.supsub/config.json`, hardcoded — not user-configurable.
- Directory is mode `0700`, file is mode `0600`. Unix-only; `chmod` is silently skipped on Windows.

## Conventions

- **Comments and user-facing strings are in Chinese.** New code should match — don't switch to English mid-file.
- **`mp search` is async**: it polls for ~30s then returns a `searchId` for `task <searchId>` follow-up if the work hasn't completed.
