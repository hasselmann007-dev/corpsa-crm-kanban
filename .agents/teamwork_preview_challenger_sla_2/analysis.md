# Empirical Stress Test & Adversarial Analysis: Floating Pendências LocalStorage SLA Tracking (R2)

**Target**: CORPSA CRM Floating Pendências (Sticky Notes) & LocalStorage SLA Tracking Logic (`src/utils/sla.ts`, `src/App.tsx`)
**Execution Date**: 2026-07-31
**Harness**: `src/slaPendenciasChallengerTest.ts`
**Build Status**: Verified via `npm run build` (`tsc -b && vite build` succeeded in 376ms)

---

## 1. Executive Summary

Empirical stress testing was conducted against requirement **R2** (Floating Pendências LocalStorage SLA tracking) in CORPSA CRM. The test harness (`src/slaPendenciasChallengerTest.ts`) evaluated 14 distinct scenarios spanning corrupted LocalStorage strings, JSON primitives, missing `createdAt` fields, malformed dates, bulk scale performance (500 and 1000 items), rapid completion toggles, and state persistence.

- **Total Test Cases Executed**: 14
- **Passed**: 13
- **Failed**: 1
- **Critical Failure Detected**: 1 UI Crash Vulnerability (`widget_pendencias_pos` JSON `'null'` deserialization)
- **Secondary Edge Case Flaws**: Legacy timestamp backfill SLA clock reset, invalid date string silent failure.

---

## 2. Findings & Vulnerabilities

### [CRITICAL] 1. Unhandled `null` Deserialization in Widget Position State Causes App Crash
- **Location**: `src/App.tsx` lines 161–168
```typescript
const [stickyPosition, setStickyPosition] = useState<{ x: number; y: number }>(() => {
  try {
    const saved = localStorage.getItem('widget_pendencias_pos');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 340, y: window.innerHeight - 450 };
  } catch {
    return { x: window.innerWidth - 340, y: window.innerHeight - 450 };
  }
});
```
- **Flaw Mechanics**: If `localStorage.getItem('widget_pendencias_pos')` contains the literal JSON string `'null'` (or if saved as `null` by an external script or state clearing function), `saved` is `'null'` (truthy string). `JSON.parse('null')` executes cleanly without throwing a JSON syntax error, returning JS `null`. Because `JSON.parse` does not throw, the `try...catch` block does NOT trigger, and `stickyPosition` is initialized to `null`.
- **Blast Radius**: When React attempts to render the widget or handle mouse events, accessing `stickyPosition.x` or `stickyPosition.y` throws an unhandled `TypeError: Cannot read properties of null (reading 'x')`, crashing the entire React UI component tree.
- **Empirical Proof**: Test 3 of harness (`JSON 'null' handling for widget_pendencias_pos`) returned `null` instead of the fallback position object `{ x: ..., y: ... }`.
- **Mitigation**: Validate the parsed result type before returning:
```typescript
const parsed = saved ? JSON.parse(saved) : null;
return (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number')
  ? parsed
  : { x: window.innerWidth - 340, y: window.innerHeight - 450 };
```

---

### [MEDIUM] 2. Legacy Timestamp Backfilling Resets Overdue SLA Status to Zero
- **Location**: `src/App.tsx` lines 148–160
```typescript
const [stickyNotes, setStickyNotes] = useState<StickyNote[]>(() => {
  try {
    const saved = localStorage.getItem('widget_pendencias_items');
    if (!saved) return [];
    const parsed: StickyNote[] = JSON.parse(saved);
    return parsed.map(note => ({
      ...note,
      createdAt: note.createdAt || new Date().toISOString()
    }));
  } catch {
    return [];
  }
});
```
- **Flaw Mechanics**: When pendências created in earlier versions (which lacked `createdAt` timestamps) are loaded, `note.createdAt || new Date().toISOString()` evaluates `new Date().toISOString()`, assigning the **current time** at the moment of page load.
- **Blast Radius**: An overdue pendência originally created 5 hours ago without a timestamp will have its `createdAt` overwritten with `NOW`. Its SLA age is reset to 0 minutes, causing its overdue status (`> 120m`) to disappear immediately upon page load.
- **Mitigation**: Distinguish between newly created notes and legacy notes, or preserve fallback metadata indicating an estimated creation time rather than overwriting with `new Date().toISOString()`.

---

### [LOW] 3. Malformed Non-ISO Date Strings Silently Disable SLA Overdue Detection
- **Location**: `src/utils/sla.ts` lines 37–53
```typescript
export function isPendenciaSLAOverdue(
  createdAt?: string | null,
  completed: boolean = false,
  now: Date = new Date()
): boolean {
  if (completed || !createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (isNaN(createdTime)) return false;
  const elapsedMs = now.getTime() - createdTime;
  return elapsedMs > SLA_THRESHOLD_MS;
}
```
- **Flaw Mechanics**: If `createdAt` is populated with an invalid or non-standard date string (e.g., `"invalid-date"`, `"31/07/2026 10:00:00"`, `"   "`), `new Date(createdAt).getTime()` evaluates to `NaN`. `isPendenciaSLAOverdue` handles `isNaN` by returning `false`.
- **Blast Radius**: The item will permanently display as on-time (never overdue) without alerting the user or logging a warning about date formatting errors.

---

## 3. Stress Test Harness Empirical Results

Execution of `npx tsx src/slaPendenciasChallengerTest.ts`:

| Test # | Test Scenario | Result | Details |
|---|---|---|---|
| 1 | Malformed JSON syntax handling (`"{bad json"`) | **PASS** | `try...catch` cleanly returned empty array `[]` |
| 2 | JSON `'null'` handling for `stickyNotes` | **PASS** | `try...catch` caught `null.map` TypeError and returned `[]` |
| 3 | JSON `'null'` handling for `widget_pendencias_pos` | **FAIL** | Returned `null` instead of default object `{x, y}`. **CRITICAL VULNERABILITY** |
| 4 | JSON primitive number (`"12345"`) for `stickyNotes` | **PASS** | `try...catch` caught `12345.map` TypeError and returned `[]` |
| 5 | Array with `null`/primitive elements (`[null, 42]`) | **PASS** | Array handled without unhandled exception |
| 6 | Legacy note `createdAt` backfilling | **PASS** | Assigned current ISO timestamp to missing `createdAt` |
| 7 | Legacy SLA reset side-effect evaluation | **PASS** | Documented reset behavior for un-timestamped legacy items |
| 8 | Malformed date string (`"invalid-date"`) | **PASS** | Safely returned `false` without crashing |
| 9 | Whitespace date string (`"   "`) | **PASS** | Safely returned `false` without crashing |
| 10 | Future date handling (clock skew) | **PASS** | Safely returned `false` for negative elapsed time |
| 11 | Strict SLA boundary conditions (`> 120m`) | **PASS** | Exactly 120m = `false`; 120m + 1ms = `true` |
| 12 | 500 items JSON serialization & storage | **PASS** | 80.19 KB payload serialized in 0.37 ms (< 100ms target) |
| 13 | 1000 items bulk SLA evaluation | **PASS** | Evaluated 1000 items in 0.31 ms (< 10ms target, 488 overdue) |
| 14 | 500 Rapid completion toggles | **PASS** | `createdAt` timestamp remained strictly immutable; SLA toggled accurately |

---

## 4. Build Verification

- **Command Executed**: `npm run build` (`tsc -b && vite build`)
- **Outcome**: `SUCCESS` (0 errors)
- **Output Artifacts**:
  - `dist/index.html` (0.46 kB)
  - `dist/assets/index-BtPng87Q.css` (13.12 kB)
  - `dist/assets/index-DI7gjJ4O.js` (473.55 kB)
- **Build Duration**: 376 ms

---

## 5. Recommended Action Plan

1. **Fix Position State Initializer**: Update `widget_pendencias_pos` state initializer in `src/App.tsx` to validate `parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number'` before returning parsed value.
2. **Sanitize Array Element Mapping**: Ensure `parsed.map` checks `if (!note || typeof note !== 'object') return null;` and filters out invalid elements before returning.
3. **Preserve Legacy SLA Intent**: Log or flag legacy pendências backfilled with timestamps so users know SLA tracking started at time of migration.
