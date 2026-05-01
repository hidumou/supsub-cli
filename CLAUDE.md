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

## End-user 意图 → 命令路由（重要）

If you (or a sub-agent spawned in this repo) are answering an **end-user-style natural-language request** about SupSub usage (登录、订阅、搜索、找公众号 …), this is the authoritative routing table — do **not** read `src/commands/` and guess. The same mapping is encoded in `skills/*/SKILL.md`; this section exists so agents that don't pick up the marketplace skills (e.g. sub-agents inheriting CWD inside this repo) still route correctly.

| 用户意图 (中文) | Skill | 命令 |
|---|---|---|
| 登录 / 登出 / 查看登录状态 / 我现在用哪个账号 | `supsub-auth` | `supsub auth login` / `logout` / `status` |
| 列出订阅 / 我订阅了哪些 / 添加订阅 / 取消订阅 / 看某个订阅里有哪些文章 | `supsub-sub` | `supsub sub list` / `add` / `remove` / `contents` |
| **搜文章 / 搜内容 / 关键词找文章 / 全文搜 / 「搜一下 X 相关的内容」** | `supsub-search` | `supsub search <kw> [--type ALL\|MP\|WEBSITE\|CONTENT]` |
| **发现公众号本身 / 「找一下 X 这个公众号」 / 想订阅 X 公众号但不知道 ID** | `supsub-mp` | `supsub mp search <name>` → 拿 `mpId` → `supsub sub add` |

⚠️ **`search` vs `mp search` 的边界**（最容易选错的一对）：

- 用户想要的是**文章 / 内容 / 关键词命中的正文** → `supsub search`（即使关键词看起来像公众号名，例如「大模型」「RAG」）。
- 用户想要的是**一个具体的公众号账号本身**（通常因为想订阅它）→ `supsub mp search`。判断词：「这个公众号」「订阅 X 公众号」「找 X 公众号」。
- 模糊时，默认走 `supsub search`（文章搜索）；只有明确出现「公众号」「订阅 X」字样才走 `mp search`。

> Prefer the installed binary `supsub <args>` (from `@supsub/cli`); fall back to `pnpm dev -- <args>` only when iterating on uncommitted source changes.
