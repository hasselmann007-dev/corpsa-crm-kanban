## 2026-08-12T09:35:57-03:00

You are teamwork_preview_explorer (Remediation Strategy Investigator).
Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_remediation

MANDATORY INSTRUCTION: You MUST read the original user request at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\ORIGINAL_REQUEST.md
before starting your work.

FORENSIC AUDIT FAILURE REMEDIATION TASK:
You MUST read the Forensic Auditor's full evidence report at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_auditor_nlm\handoff.md
and Challenger 2's report at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_challenger_nlm_2\handoff.md

Your task is to analyze the integrity violations and code bugs and design the exact remediation strategy:

1. **Integrity Violation 1 (TS6133 Build Error)**:
   - `src/nlmBridgeStressTest.ts` causes `npm run build` (`tsc -b && vite build`) to fail due to unused declarations (`fs`, `path`, `makeRequest`).
   - Formulate strategy to fix or remove unused code/imports in `src/nlmBridgeStressTest.ts` (or relocate out of `src/` if strictly a test script) so `npm run build` succeeds 100%.

2. **Integrity Violation 2 (Facade Synthetic Fallback Bypass)**:
   - In `src/components/ApuracaoRendaTab.tsx`, `calculateFallbackMetrics` generates synthetic financial numbers (R$ 6,500 formal, R$ 2,300 informal, R$ 450 descontos) and outputs a parecer claiming `"Análise realizada via NotebookLM"` when the backend `/api/nlm/analyze` is offline or fails.
   - Formulate strategy to completely eliminate `calculateFallbackMetrics` synthetic data generation. When the backend API is offline or returns an error, `handleAnalisarNotebookLM` MUST set an honest error state banner displaying the actual error (e.g., "O servidor local de integração (server/index.ts) está offline. Execute 'npm run server' no terminal." or "Autenticação necessária: Execute 'nlm login' no terminal para conectar a conta do NotebookLM.") without generating fake calculation metrics.

3. **Challenger Null-Safety & Edge Case Fixes**:
   - In `src/components/ApuracaoRendaTab.tsx`:
     - Nullish coalescing for numeric fields (`rendaFormal ?? 0`, `rendaInformal ?? 0`, `(value || 0).toLocaleString('pt-BR')`).
     - Safe navigation on string methods (`(nomeCliente || '').toLowerCase()`, `(cpfCliente || '').includes(...)`).

Write your detailed remediation handoff report to:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_remediation\handoff.md
Send a message back to parent when complete.
