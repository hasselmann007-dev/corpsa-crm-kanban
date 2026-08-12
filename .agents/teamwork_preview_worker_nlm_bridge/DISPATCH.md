## 2026-08-12T12:29:09Z

You are teamwork_preview_worker (CLI & Backend Bridge Implementer).
Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_nlm_bridge

MANDATORY INSTRUCTION: You MUST read the original user request at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\ORIGINAL_REQUEST.md
before starting your work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your file ownership scope:
- `docs/notebooklm_setup_guide.md`
- `server/nlmBridge.ts`
- `server/index.ts`
- `package.json` (server dependencies & scripts)
- `vite.config.ts` (API proxy configuration)

Reference Explorer 1's report at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_nlm_1\handoff.md

Your Tasks:
1. Create `docs/notebooklm_setup_guide.md`:
   - Detail installation via `uv tool install notebooklm-mcp-cli` (or Python environment tools).
   - Provide clear instructions for executing `nlm login` to connect Google NotebookLM account.
2. Install necessary server dependencies in `package.json` (`express`, `cors`, `multer`, `tsx`, `concurrently`, `@types/express`, `@types/cors`, `@types/multer`).
3. Build `server/nlmBridge.ts`:
   - Connect to central notebook "Apuração de Renda CORPSA" (create if missing via `nlm notebook create`).
   - Clear previous document sources via `nlm source list` and `nlm source delete`.
   - Upload new attached files via `nlm source add <notebook_id> --file "<filepath>" --wait --json`.
   - Formulate financial audit prompt incorporating `regrasConsiderar` and `regrasDesconsiderar`.
   - Run income calculation query via `nlm query notebook <notebook_id> "<prompt>" --json`.
   - Parse structured calculation results (formal income, informal income, total gross, deductions, approved net, payment capacity 30%, detailed parecer) and return clean JSON.
4. Build `server/index.ts` Express server:
   - Port 3001.
   - Endpoint `GET /api/nlm/status`: check `nlm` installation and `nlm login` profile status.
   - Endpoint `POST /api/nlm/analyze`: handle multipart/JSON payload with files and rules, invoke `nlmBridge`, handle errors gracefully (e.g. auth required, missing CLI).
5. Update `vite.config.ts`: add `/api` proxy pointing to `http://localhost:3001`.
6. Run `npm run build` or `npx tsc --noEmit` to verify zero compilation errors.

Write your handoff report to:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_nlm_bridge\handoff.md
Send a message back to parent when complete.
