## 2026-08-12T12:29:09Z
You are teamwork_preview_worker (UI & Persistence Implementer).
Working directory: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_nlm_ui

MANDATORY INSTRUCTION: You MUST read the original user request at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\ORIGINAL_REQUEST.md
before starting your work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your file ownership scope:
- `src/components/ApuracaoRendaTab.tsx`
- `supabase/migrations/20260812000000_create_apuracoes_renda_table.sql`

Reference Explorer 2's report at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_nlm_2\handoff.md
and Explorer 3's report at:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_explorer_nlm_3\handoff.md

Your Tasks:
1. Update `src/components/ApuracaoRendaTab.tsx`:
   - Add prominent 1-Click action button: "Analisar no NotebookLM (1-Clique)" with gradient accent styling, `FiZap` icon, file validation check, and disabled loading state.
   - Implement real-time progress banner with status steps: `Uploading`, `Analyzing`, `Calculating`, `Complete`, `Error`.
   - Update `ApuracaoSessao` interface to include `rendaFormal` and `rendaInformal`.
   - Expand income summary cards grid to 6 responsive cards: Renda Formal, Renda Informal, Renda Bruta Total, Descontos Desconsiderados, Renda Líquida Aprovável, Capacidade de Parcela (30%).
   - Connect 1-Click button to POST `/api/nlm/analyze` (with fallback mock calculation if server offline so UI is robust), update session metrics, format AI analysis parecer report, append to conversation thread, set session status to `'Concluída'`.
   - Implement persistent session history saving/loading to LocalStorage key `crm_apuracoes_renda_v1` and Supabase `public.apuracoes_renda` synchronization.
   - Ensure left sidebar history list supports searching, filtering, selecting, and reviewing past client audit sessions.
2. Create SQL migration `supabase/migrations/20260812000000_create_apuracoes_renda_table.sql` for table `public.apuracoes_renda`.
3. Run `npm run build` to verify zero TypeScript or JSX compilation errors.

Write your handoff report to:
c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_nlm_ui\handoff.md
Send a message back to parent when complete.
