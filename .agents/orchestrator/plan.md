# Project Plan: 2-Hour SLA Tracking & Warning Indicators

## Objectives
1. Implement Lead Card SLA tracking (R1): Check elapsed time since `data_hora_entrada`. Display static red/amber `"SLA Atrasada"` badge and border highlight if > 120 minutes and stage !== `'Conclusao'`. Freeze/remove badge when stage is `'Conclusao'`.
2. Implement Floating Pendências SLA tracking (R2): Add `createdAt` ISO timestamp to pending items in LocalStorage. Display static `"SLA Atrasada"` badge next to uncompleted items created > 2 hours ago.
3. Automated & Programmatic Verification (R3): Build validation script `src/slaTest.ts`, run tests, and ensure `npm run build` compiles cleanly with zero TypeScript errors.
4. Stress test and forensic audit for complete verification.

---

## Detailed Step-by-Step Execution Plan

### Milestone 1: Exploration & Codebase Analysis
- Dispatch Explorer subagent(s) to inspect `src/App.tsx`, `src/types.ts` (if existing), LocalStorage handling for pendências, lead data structure, and existing test setup.
- Output: Structured exploration report detailing line numbers and precise insertion points for R1, R2, and R3.

### Milestone 2: Core SLA Logic & Lead Card SLA (R1)
- Create `src/utils/sla.ts` containing pure helper functions:
  - `isLeadSLAOverdue(dataHoraEntrada: string | undefined | null, etapa: string): boolean`
  - `isPendenciaSLAOverdue(createdAt: string | undefined | null): boolean`
- Update `src/App.tsx` lead card rendering:
  - Calculate SLA status for each lead.
  - If overdue (> 120 min and stage !== `'Conclusao'`), display static `"SLA Atrasada"` badge on the card and apply red/amber border highlight styling.
  - If stage === `'Conclusao'`, do not show badge.

### Milestone 3: Floating Pendências SLA (R2)
- Update pending item model and creation logic in `src/App.tsx`:
  - When saving new pending item to LocalStorage, set `createdAt: new Date().toISOString()`.
  - For existing items without `createdAt`, handle gracefully (fallback or migration).
- Render `"SLA Atrasada"` static badge next to any pending item where `isPendenciaSLAOverdue(item.createdAt)` is true and item is not completed.

### Milestone 4: Automated Validation & Build Verification (R3)
- Create `src/slaTest.ts` to programmatically exercise SLA logic:
  - Test lead cards with `data_hora_entrada` < 2h, > 2h (in progress stage), > 2h (stage = `'Conclusao'`).
  - Test pending items with `createdAt` < 2h and > 2h.
- Add test script to `package.json` if appropriate or verify via `npx tsx src/slaTest.ts`.
- Run `npm run build` to verify clean compilation.

### Milestone 5: Code Review, Stress Test & Forensic Integrity Audit
- Dispatch 2 Reviewers to inspect implementation and build/test outputs.
- Dispatch 2 Challengers to run edge-case generator tests.
- Dispatch 1 Forensic Auditor (`teamwork_preview_auditor`) to verify zero integrity violations.
- Verify pass criteria and finalize project completion.
