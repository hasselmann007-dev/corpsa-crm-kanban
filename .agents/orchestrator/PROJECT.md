# Project: CORPSA CRM 2-Hour SLA Tracking & Warning Indicators

## Architecture
- **SLA Utilities (`src/utils/sla.ts`)**: Core pure helper functions to evaluate whether a date string/ISO timestamp has passed the 2-hour (120-minute) threshold, taking stage into account.
- **Lead Card Component / Kanban Rendering (`src/App.tsx`)**: Renders lead cards on the Kanban board. Uses SLA helper to check `data_hora_entrada`. If > 2 hours and `etapa !== 'Conclusao'`, renders static red/amber `"SLA Atrasada"` badge and applies border highlight. If `etapa === 'Conclusao'`, freezes tracking / hides warning.
- **Floating Pendências / Sticky Notes Component (`src/App.tsx`)**: Manages floating pending items stored in LocalStorage. Ensures each pending item has a `createdAt` ISO timestamp upon creation. Renders static `"SLA Atrasada"` badge next to items uncompleted after 2 hours.
- **Automated Validation Script (`src/slaTest.ts` or expanded test script)**: Node/tsx test script verifying SLA logic for lead cards and pendências under various timestamps and stages.

## Code Layout
- `src/utils/sla.ts`: Pure SLA calculation logic and helpers.
- `src/App.tsx`: Main React component containing Kanban cards and Floating Pendências.
- `src/slaTest.ts`: Automated test script validating SLA rules.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Analysis | Explore codebase structure, `data_hora_entrada` usage, pendências LocalStorage handling, and existing build/test scripts. | None | IN_PROGRESS |
| 2 | Lead Card SLA (R1) | Implement SLA calculation for leads. Display `"SLA Atrasada"` badge and border highlight when >2h and stage !== 'Conclusao'. Freeze/remove when moved to 'Conclusao'. | M1 | PLANNED |
| 3 | Floating Pendências SLA (R2) | Add `createdAt` ISO timestamp to pending items in LocalStorage. Render `"SLA Atrasada"` badge for uncompleted items >2h old. | M1 | PLANNED |
| 4 | Automated Verification (R3) | Create `src/slaTest.ts` (or update test runners) and ensure `npm run build` compiles without errors. | M2, M3 | PLANNED |
| 5 | Review, Stress Test & Forensic Audit | Reviewers, Challengers, and Forensic Auditor verify solution, integrity, and test pass criteria. | M4 | PLANNED |

## Interface Contracts
### `src/utils/sla.ts`
```typescript
export interface SLACheckResult {
  isOverdue: boolean;
  elapsedMinutes: number;
}

export function isLeadSLAOverdue(dataHoraEntrada?: string | null, stage?: string): boolean;
export function isPendenciaSLAOverdue(createdAt?: string | null): boolean;
```
