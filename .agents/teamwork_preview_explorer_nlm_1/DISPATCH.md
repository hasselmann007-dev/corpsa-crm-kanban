## 2026-08-12T09:25:59-03:00
You are teamwork_preview_explorer (CLI & Backend Bridge Investigator).
Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_nlm_1

MANDATORY INSTRUCTION: You MUST read the original user request at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\ORIGINAL_REQUEST.md
before starting your work.

Your task is to investigate the CLI environment and backend/server infrastructure for R1 and R2:
1. Check Python/`uv` installation on Windows system and `notebooklm-mcp-cli` (`nlm`) availability.
2. Investigate existing `package.json`, build setup, and backend server structure (is there an express server, server directory, API endpoints, or vite proxy?).
3. Plan how `server/nlmBridge.ts` (or Node script bridge) should interface with `notebooklm-mcp-cli`:
   - Managing central notebook "Apuração de Renda CORPSA"
   - Clearing previous document sources (`nlm source delete` or equivalent)
   - Uploading attached files (PDFs, images, TXT, etc.)
   - Executing income calculation query prompt with user consideration rules
   - Parsing structured calculation results (formal income, informal income, gross total, deductions) and returning JSON.
4. Detail setup & authentication instructions (`uv tool install notebooklm-mcp-cli` or `uv pip install ...` and `nlm login`).

Write your detailed findings and handoff report to:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_nlm_1\handoff.md
Send a message back to parent when complete.
