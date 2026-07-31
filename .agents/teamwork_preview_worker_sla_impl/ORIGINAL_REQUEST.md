## 2026-07-31T14:50:03Z

<USER_REQUEST>
You are a Worker subagent (teamwork_preview_worker).
Your working directory is: c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_sla_impl

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective:
Implement 2-hour SLA tracking and warning indicators for Kanban cards and pending items in CORPSA CRM according to user requirements R1, R2, and R3.

Detailed Tasks:
1. Create `src/utils/sla.ts`:
   - Define `SLA_THRESHOLD_MS = 120 * 60 * 1000` (120 minutes / 2 hours).
   - Implement `isLeadSLAOverdue(dataHoraEntrada?: string | null, etapa?: string, now: Date = new Date()): boolean`:
     - Return `false` if `!dataHoraEntrada` or `etapa === 'Conclusao'` (freezes/stops SLA tracking).
     - Otherwise, check if `elapsedMs > SLA_THRESHOLD_MS`.
   - Implement `isPendenciaSLAOverdue(createdAt?: string | null, completed: boolean = false, now: Date = new Date()): boolean`:
     - Return `false` if `completed === true` or `!createdAt`.
     - Otherwise, check if `elapsedMs > SLA_THRESHOLD_MS`.

2. Create `src/slaTest.ts`:
   - Import `assert` from `'assert'` and helpers from `'./utils/sla.ts'`.
   - Implement test cases covering R1 (leads < 120m, exact 120m boundary, > 120m overdue, stage 'Conclusao' freeze, missing dates) and R2 (pendências < 120m, > 120m overdue, completed item, legacy/missing timestamp).
   - Execute `runSLATests()`. Log clear pass messages. Exit process with non-zero code on error.

3. Update `package.json`:
   - Add `"test:sla": "tsx src/slaTest.ts"` and `"test": "npm run test:parse && npm run test:sla"` to `"scripts"`.

4. Update `src/App.tsx`:
   - Import `isLeadSLAOverdue` and `isPendenciaSLAOverdue` from `'./utils/sla.ts'`.
   - Update `StickyNote` interface to include `createdAt?: string`.
   - In `handleAddStickyNote`, ensure new notes include `createdAt: new Date().toISOString()`.
   - In `stickyNotes` state initializer, migrate legacy notes missing `createdAt` by assigning `createdAt: new Date().toISOString()`.
   - Add a 60-second ticker interval (`useEffect` timer) to force periodic re-render for real-time SLA updating.
   - Update `isSlaDelayed` helper / usage for Lead Cards: if `isLeadSLAOverdue(lead.data_hora_entrada, lead.etapa)` is true, render static red/amber `"SLA Atrasada"` badge and apply red/amber border highlight styling (`border: '1.5px solid #ef4444'`). If stage is `'Conclusao'`, do not show badge.
   - Update Floating Pendências rendering: for uncompleted notes where `isPendenciaSLAOverdue(note.createdAt, note.completed)` is true, render static red `"SLA Atrasada"` badge next to the note text.

5. Verify & Run Commands:
   - Run `npx tsx src/slaTest.ts` (or `npm run test:sla`) and confirm all tests pass.
   - Run `npm run build` and confirm zero TypeScript compiler errors or Vite build failures.

Output Requirements:
- Record your changes, command execution logs, and test results in:
  `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_sla_impl\changes.md`
  and write your handoff report to:
  `c:\Users\User\Desktop\Ai agent\corpsa-crm-kanban\.agents\teamwork_preview_worker_sla_impl\handoff.md`
- Send a completion message to the parent orchestrator with build & test verification output.
</USER_REQUEST>
