# Implementation Details & Changes Log

## Files Created / Modified

1. **`src/utils/sla.ts`** (Created)
   - Exported constant `SLA_THRESHOLD_MS = 120 * 60 * 1000` (120 minutes / 2 hours).
   - Implemented `isLeadSLAOverdue(dataHoraEntrada?: string | null, etapa?: string, now: Date = new Date()): boolean`:
     - Returns `false` if `!dataHoraEntrada` or `etapa === 'Conclusao'` (freezes/stops SLA tracking).
     - Returns `false` if date parsing fails (`isNaN`).
     - Returns `true` if `elapsedMs > SLA_THRESHOLD_MS` (`now.getTime() - entryTime > 120 minutes`).
   - Implemented `isPendenciaSLAOverdue(createdAt?: string | null, completed: boolean = false, now: Date = new Date()): boolean`:
     - Returns `false` if `completed === true` or `!createdAt`.
     - Returns `false` if date parsing fails (`isNaN`).
     - Returns `true` if `elapsedMs > SLA_THRESHOLD_MS` (`now.getTime() - createdTime > 120 minutes`).

2. **`src/slaTest.ts`** (Created)
   - Imported `assert` from `'assert'` and helpers from `'./utils/sla.ts'`.
   - Comprehensive test suite covering Requirements R1 and R2:
     - Test 1: Lead created < 120m ago (returns `false`).
     - Test 2: Lead created exactly 120m boundary ago (returns `false`).
     - Test 3: Lead created > 120m ago (121 minutes) (returns `true`).
     - Test 4: Lead created > 120m ago in stage `'Conclusao'` (returns `false`, SLA freeze).
     - Test 5: Lead with null, undefined, empty, or invalid `data_hora_entrada` (returns `false`).
     - Test 6: Pendência created < 120m ago (returns `false`).
     - Test 7: Pendência created > 120m ago (130 minutes, uncompleted) (returns `true`).
     - Test 8: Pendência created > 120m ago but `completed = true` (returns `false`).
     - Test 9: Pendência with null, undefined, empty, or invalid `createdAt` timestamp (returns `false`).
   - Wraps suite in `runSLATests()` with clear logging and non-zero process exit on failure.

3. **`package.json`** (Modified)
   - Added `"test:parse": "tsx src/parseTest.ts"`.
   - Added `"test:sla": "tsx src/slaTest.ts"`.
   - Updated `"test": "npm run test:parse && npm run test:sla"`.

4. **`src/App.tsx`** (Modified)
   - Imported `isLeadSLAOverdue` and `isPendenciaSLAOverdue` from `'./utils/sla'`.
   - Updated `stickyNotes` state initializer to migrate legacy notes missing `createdAt` by assigning `createdAt: new Date().toISOString()`.
   - Added 60-second ticker interval (`useEffect` timer) to force periodic re-render for real-time SLA updating.
   - Updated `isSlaDelayed` and `isStickySlaDelayed` helpers to delegate directly to `isLeadSLAOverdue` and `isPendenciaSLAOverdue`.
   - Lead Cards: Render static red/amber `"SLA Atrasada"` badge and red border highlight (`border: '1.5px solid #ef4444'`) when `isLeadSLAOverdue` is true; no badge or highlight shown if stage is `'Conclusao'`.
   - Floating Pendências (Sticky Notes): Render static red `"SLA Atrasada"` badge next to note text when `isPendenciaSLAOverdue` is true for uncompleted notes.

## Verification Protocol
- Test command: `npm run test:sla` (runs `tsx src/slaTest.ts`) & `npm run test`
- Build command: `npm run build` (`tsc -b && vite build`)
