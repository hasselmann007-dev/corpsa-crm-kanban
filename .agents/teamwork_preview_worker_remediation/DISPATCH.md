## 2026-08-12T12:38:14Z
You are teamwork_preview_worker (Remediation Implementer).
Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_remediation

MANDATORY INSTRUCTION: You MUST read the original user request at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\ORIGINAL_REQUEST.md
before starting your work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your file ownership scope:
- `src/components/ApuracaoRendaTab.tsx`
- `src/nlmBridgeStressTest.ts`

Reference the Remediation Strategy Handoff Report and proposed files at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_remediation\handoff.md
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_remediation\proposed_ApuracaoRendaTab.tsx
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_remediation\proposed_nlmBridgeStressTest.ts

Your Tasks:
1. Replace/update `src/nlmBridgeStressTest.ts` with the content from `proposed_nlmBridgeStressTest.ts` (or clean all TS6133 unused declarations `fs`, `path`, `makeRequest` so `npm run build` succeeds with code 0).
2. Replace/update `src/components/ApuracaoRendaTab.tsx` with the content from `proposed_ApuracaoRendaTab.tsx`:
   - Completely eliminate `calculateFallbackMetrics` and synthetic financial data generation.
   - Implement honest error handling banners displaying actual backend/CLI/auth error status when `POST /api/nlm/analyze` fails or server is offline.
   - Apply nullish coalescing `?? 0` to numeric calculations to fix Zero Income Overwrite Bug.
   - Apply safe navigation to all `.toLocaleString('pt-BR')` calls, string methods, and array accessors.
3. Run `npm run build` (`tsc -b && vite build`) to verify that the project compiles with ZERO errors.
4. Run `npm test` and `npx tsx src/apuracaoRendaChallengerTest.ts` (if existing) to verify tests pass.

Write your handoff report to:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_remediation\handoff.md
Send a message back to parent when complete.
