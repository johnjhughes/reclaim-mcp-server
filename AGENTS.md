# Repository guidance

This repository provides an unofficial TypeScript MCP server for Reclaim.ai task operations over stdio. Read `README.md`, `package.json`, and `.github/workflows/ci.yml` before changing its development workflow.

- `src/index.ts` wires the server; `src/reclaim-client.ts` owns HTTP access; `src/tools/` defines task tools; `src/resources/tasks.ts` exposes task resources; `src/types/reclaim.ts` contains API types.
- Reuse `src/utils.ts` and `src/logger.ts` for their existing responsibilities. Keep stdout reserved for the MCP protocol; use the existing logger for diagnostics.
- Use the pnpm version pinned in `package.json` and install with `pnpm install --frozen-lockfile`. Node.js 18 or newer is required; CI currently checks Node.js 18 and 20.
- Keep the existing Biome stack. Before publishing changes, run `pnpm lint:ci`, `pnpm typecheck`, `pnpm build`, `pnpm test`, and `pnpm test:coverage`, matching CI. `pnpm build` regenerates `dist/`; edit `src/`, not generated files.
- `pnpm test` runs deterministic unit tests in `tests/unit/`. `pnpm test:integration:live` is a separate opt-in lane that uses `RECLAIM_API_KEY` and can mutate real tasks. Do not run it without explicit authorization for the account and operations.
- Preserve task-status semantics: `COMPLETE` tasks remain active; `ARCHIVED` tasks are finished. Test changed task behavior with synthetic fixtures and the existing test utilities.
- Never commit API keys, environment secrets, real task contents, or raw provider responses. Keep credentials outside repository files and routine logs.
- Keep agent instructions in root `AGENTS.md`, or use a root symlink to `.agents/AGENTS.md` if the guidance is moved there.
