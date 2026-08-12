# Execution Plan — NotebookLM MCP CLI Integration

## Objective
Fulfill the requirements of `ORIGINAL_REQUEST.md` by integrating `notebooklm-mcp-cli` into CORPSA CRM's Apuração de Renda tab with an automated 1-click bridge, real-time UI status updates, persistent session history, and zero build/type errors.

## Strategy & Topology
Orchestration Pattern: **Project**
- Step 0: Survey & Exploration — Spawn 3 parallel Explorers (`exploration_1`, `exploration_2`, `exploration_3`) to analyze existing codebase, server setup, ApuracaoRendaTab implementation, and CLI environment.
- Step 1: Implementation & Integration — Spawn Workers for CLI bridge, UI components, session history, setup guide.
- Step 2: Review — Spawn 2 parallel Reviewers.
- Step 3: Adversarial Challenge — Spawn 2 parallel Challengers.
- Step 4: Forensic Audit — Spawn 1 Forensic Auditor (`teamwork_preview_auditor`).

## Milestones
1. **M0: Survey & Exploration**: Deep dive into existing files, server API routes, state management, CLI binary state.
2. **M1: R1 Setup & Guide**: Setup `notebooklm-mcp-cli` instructions via `uv` / python and document `nlm login`.
3. **M2: R2 Integration Bridge**: Node/TypeScript server bridge (`server/nlmBridge.ts` / server route) interfacing with `nlm` CLI.
4. **M3: R3 UI & 1-Click Action**: `ApuracaoRendaTab.tsx` UI with "Analisar no NotebookLM (1-Clique)", progress indicators, cards, chat log.
5. **M4: R4 Persistent CRM Session History**: Session history state persistence (Local/Supabase) & sidebar audit review.
6. **M5: E2E Verification & Forensic Audit**: Build check (`npm run build`), functionality verification, Forensic Integrity Audit.
