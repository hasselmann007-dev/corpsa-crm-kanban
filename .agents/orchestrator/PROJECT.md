# Project: NotebookLM MCP CLI Integration for CORPSA CRM

## Architecture
- **Frontend**: React 19 / Vite SPA (`src/components/ApuracaoRendaTab.tsx`, `src/types/`).
- **Backend Bridge**: Node/TypeScript Express server (`server/index.ts` & `server/nlmBridge.ts`) listening on port 3001 and proxied via Vite `/api`.
- **CLI Tool**: `notebooklm-mcp-cli` (`nlm`), installed via `uv tool install notebooklm-mcp-cli`, managing central notebook "Apuração de Renda CORPSA", source clearance, document uploads (`nlm source add --wait`), and prompt analysis (`nlm query notebook --json`).
- **Persistence Layer**: LocalStorage key `crm_apuracoes_renda_v1` + Supabase table `public.apuracoes_renda` (`supabase/migrations/20260812000000_create_apuracoes_renda_table.sql`) preserving client audit files, consideration rules, chat threads, income summaries, and past session history.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | notebooklm-mcp-cli setup & guide | `uv` / Python installation verification, `nlm` availability check, and `docs/notebooklm_setup_guide.md` user instructions | M1 | R1 | DONE |
| 2 | 1-Click Node/CLI Integration Bridge | `server/index.ts` Express server & `server/nlmBridge.ts` managing central notebook, source cleanup, file uploads, `nlm` execution, JSON response | M2 | R2 | DONE |
| 3 | Apuração de Renda UI & 1-Click Action | UI in `ApuracaoRendaTab.tsx` with 1-Click button, real-time progress banner (Uploading, Analyzing, Calculating), 6 summary cards, chat log | M3 | R3 | DONE |
| 4 | Persistent CRM Session History | `ApuracaoSessao` schema with LocalStorage + Supabase sync, left sidebar search/filter, full audit history preservation | M4 | R4 | DONE |
| 5 | Build Verification & Forensic Audit | `npm run build` TypeScript check, functionality validation, Forensic Integrity Audit | M5 | Acceptance | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Exploration & Survey | Map frontend, backend, CLI availability, file storage | None | DONE |
| M1 | R1 CLI Setup & Guide | Verify/install `notebooklm-mcp-cli` via `uv`, write setup guide | M0 | DONE |
| M2 | R2 Integration Bridge | Build `server/nlmBridge.ts` & Express server, update `vite.config.ts` | M1 | DONE |
| M3 | R3 UI & 1-Click Action | Implement `ApuracaoRendaTab.tsx` UI, real-time status, summary cards | M2 | DONE |
| M4 | R4 Session History | Implement persistent CRM session history per client audit | M3 | DONE |
| M5 | Verification & Audit | `npm run build`, E2E test verification, Forensic Integrity Audit | M4 | DONE |

## Code Layout
- `server/index.ts`: Express API server listening on port 3001.
- `server/nlmBridge.ts`: Execution bridge interfacing Node process with `nlm` CLI binary.
- `src/components/ApuracaoRendaTab.tsx`: Apuração de Renda UI component.
- `supabase/migrations/20260812000000_create_apuracoes_renda_table.sql`: Database schema migration.
- `docs/notebooklm_setup_guide.md`: Detailed setup and authentication guide for `nlm login`.
