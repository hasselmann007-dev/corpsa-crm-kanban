# Project: CORPSA CRM 2-Hour SLA Tracking & Warning Indicators

## Architecture
- **SLA Utilities (`src/utils/sla.ts`)**: Pure TypeScript helper functions to evaluate whether a date string/ISO timestamp has passed the 2-hour (120-minute) SLA threshold, featuring case- and accent-insensitive stage normalization and fallback date parsing.
- **Lead Card Component / Kanban Rendering (`src/App.tsx`)**: Renders lead cards on the Kanban board. Calculates SLA status from `data_hora_entrada`. If > 2 hours and `etapa !== 'Conclusao'`, renders static red `"SLA Atrasada"` badge and applies red border highlight. Freezes SLA tracking and hides badge when lead is in stage `'Conclusao'`. Features a 60-second ticker interval for live UI updates.
- **Floating Pendências / Sticky Notes Component (`src/App.tsx`)**: Manages floating pending items stored in LocalStorage (`widget_pendencias_items`). Assigns `createdAt` ISO timestamp upon creation, migrates legacy notes safely, and renders static red `"SLA Atrasada"` badge next to uncompleted items older than 2 hours. LocalStorage position state handles corrupted or `"null"` string values safely.
- **Automated Verification Suite (`src/slaTest.ts`, `package.json`)**: Automated test runner executing 9 unit tests verifying R1 and R2 business logic, boundary conditions, and fallback rules. Integrated into `package.json` under `"test:sla"`.

## Code Layout
- `src/utils/sla.ts`: Pure SLA calculation logic and helper functions.
- `src/App.tsx`: Main React application containing Lead Cards and Floating Pendências widgets.
- `src/slaTest.ts`: Unit test runner for SLA rules.
- `package.json`: NPM package configuration including test scripts.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Analysis | Explore codebase structure, `data_hora_entrada` usage, pendências LocalStorage handling, and build/test scripts. | None | DONE |
| 2 | Lead Card SLA (R1) | Implement SLA calculation for leads. Display `"SLA Atrasada"` badge and border highlight when >2h and stage !== 'Conclusao'. Freeze/remove when moved to 'Conclusao'. | M1 | DONE |
| 3 | Floating Pendências SLA (R2) | Add `createdAt` ISO timestamp to pending items in LocalStorage. Render `"SLA Atrasada"` badge for uncompleted items >2h old. | M1 | DONE |
| 4 | Automated Verification (R3) | Create `src/slaTest.ts`, update `package.json`, and ensure `npm run build` compiles without errors. | M2, M3 | DONE |
| 5 | Review, Stress Test & Forensic Audit | Reviewers, Challengers, and Forensic Auditor verify solution, integrity, and test pass criteria. | M4 | DONE |

## Interface Contracts
### `src/utils/sla.ts`
```typescript
export const SLA_THRESHOLD_MS: number; // 120 * 60 * 1000

export function isLeadSLAOverdue(
  dataHoraEntrada?: string | null,
  etapa?: string,
  now: Date = new Date()
): boolean;

export function isPendenciaSLAOverdue(
  createdAt?: string | null,
  completed: boolean = false,
  now: Date = new Date()
): boolean;
```
