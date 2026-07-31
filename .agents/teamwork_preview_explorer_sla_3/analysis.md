# Technical Analysis & Architecture Design: SLA Tracking & Test Integration for CORPSA CRM

## Executive Summary
This document provides a comprehensive analysis of the build, test, and TypeScript setup for CORPSA CRM, along with a complete architectural design for:
1. Pure SLA utility functions (`src/utils/sla.ts`) for Lead Card SLA (R1) and Floating Pendências SLA (R2).
2. An automated test runner (`src/slaTest.ts`) verifying R1 and R2 business rules.
3. Clean integration into `package.json` and verification workflow (R3), ensuring seamless TypeScript compilation (`npm run build`) and cross-platform automated testing.

---

## 1. Build and Test Environment Analysis

### 1.1 `package.json` Structure & Tooling
The project uses **Vite 8** with **React 19** and **TypeScript 6.0**:
- Existing `package.json` scripts:
  ```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
  ```
- **Execution Tool**: `tsx` (TypeScript Execute) is installed/available in `node_modules` and used to execute standalone TypeScript scripts in Node.js without pre-compilation.

### 1.2 TypeScript Configuration Hierarchy
- **`tsconfig.json`**: Solution-style reference config referencing `tsconfig.app.json` and `tsconfig.node.json`.
- **`tsconfig.app.json`**:
  - `"include": ["src"]` — automatically includes **all** TypeScript files in the `src/` directory for type-checking during build.
  - `"moduleResolution": "bundler"`, `"allowImportingTsExtensions": true` — allows explicit `.ts` extensions in imports (e.g. `import { parseRawText } from './utils/parser.ts'`).
  - `"noEmit": true` — TypeScript acts purely as a type-checker (`tsc -b`); Vite handles JS bundling.
- **Build Impact**: Any file created in `src/` (such as `src/utils/sla.ts` or `src/slaTest.ts`) will be automatically validated by `tsc -b` whenever `npm run build` is executed.

---

## 2. Existing Test Runners & Verification Patterns

### 2.1 Inspection of `src/parseTest.ts`
- **Assertion Library**: Uses Node.js native `import assert from 'assert'`.
- **Structure**: Self-contained script running isolated test blocks with explicit `console.log` output and `assert.strictEqual()` assertions.
- **Error Handling**: Outer `try / catch` block logs errors and triggers `process.exit(1)` on failure, ensuring test runners / CI detect non-zero exit codes.
- **Execution Method**: `npx tsx src/parseTest.ts` (or `cmd /c npx tsx src/parseTest.ts` on Windows).

### 2.2 Other Test Scripts
- `src/stressTest.ts` & `src/vulnerabilityTests.ts`: Empirical challenger/vulnerability scripts that import pure utility functions from `src/utils/parser.ts`.
- Key Observation: The codebase relies on **lightweight, deterministic TypeScript test scripts** executed via `tsx` rather than complex external test frameworks (like Jest/Vitest). This pattern should be strictly followed for `src/slaTest.ts`.

---

## 3. Recommended Design for `src/utils/sla.ts` (Pure SLA Helpers)

### 3.1 Business Rules Definition
- **SLA Threshold**: 120 minutes (2 hours / 7,200,000 ms).
- **R1 - Lead Card SLA**:
  - Overdue condition: `elapsedTime > 120 minutes` AND `etapa !== 'Conclusao'`.
  - Conclusão rule: If lead's `etapa === 'Conclusao'`, SLA is **never** overdue (badge frozen/removed).
  - Null safety: If `data_hora_entrada` is missing, empty, or invalid, returns `false`.
- **R2 - Floating Pendências SLA**:
  - Overdue condition: Pending item is **uncompleted** (`completed === false`) AND `createdAt` ISO date is present AND `elapsedTime > 120 minutes`.
  - Completion rule: If `completed === true`, returns `false`.
  - Null safety: If `createdAt` is missing or invalid date, returns `false`.

### 3.2 Code Specification for `src/utils/sla.ts`

```typescript
/**
 * SLA Helper Utilities for CORPSA CRM
 */

export const SLA_THRESHOLD_MS = 120 * 60 * 1000; // 120 minutes in milliseconds

/**
 * Checks if a Lead Card has exceeded the 2-hour SLA threshold.
 * 
 * @param dataHoraEntrada ISO timestamp string or valid date string of lead entry.
 * @param etapa Current stage of the lead ('Roleta' | 'Pendencia' | 'Analise' | 'Conclusao').
 * @param now Optional date parameter for deterministic testing (defaults to current time).
 * @returns boolean True if SLA is overdue (> 120 min and not in Conclusao), false otherwise.
 */
export function isLeadSLAOverdue(
  dataHoraEntrada: string | undefined | null,
  etapa: string,
  now: Date = new Date()
): boolean {
  if (!dataHoraEntrada || etapa === 'Conclusao') {
    return false;
  }

  const entryDate = new Date(dataHoraEntrada);
  if (isNaN(entryDate.getTime())) {
    return false;
  }

  const elapsedMs = now.getTime() - entryDate.getTime();
  return elapsedMs > SLA_THRESHOLD_MS;
}

/**
 * Checks if a Floating Pendência item has exceeded the 2-hour SLA threshold.
 * 
 * @param createdAt ISO timestamp string when the item was created.
 * @param completed Boolean indicating if the pending item is marked complete.
 * @param now Optional date parameter for deterministic testing (defaults to current time).
 * @returns boolean True if item is uncompleted and created > 120 min ago, false otherwise.
 */
export function isPendenciaSLAOverdue(
  createdAt: string | undefined | null,
  completed: boolean = false,
  now: Date = new Date()
): boolean {
  if (completed || !createdAt) {
    return false;
  }

  const createdDate = new Date(createdAt);
  if (isNaN(createdDate.getTime())) {
    return false;
  }

  const elapsedMs = now.getTime() - createdDate.getTime();
  return elapsedMs > SLA_THRESHOLD_MS;
}
```

---

## 4. Recommended Design for `src/slaTest.ts` (Automated Test Runner)

### 4.1 Test Cases Matrix

| Test ID | Domain | Input Parameters | Expected Result | Rationale |
|---------|--------|------------------|-----------------|-----------|
| R1-01 | Lead Card | `data_hora_entrada` = 30m ago, `etapa` = `'Roleta'` | `false` | SLA within limit |
| R1-02 | Lead Card | `data_hora_entrada` = 120m ago (exact boundary), `etapa` = `'Pendencia'` | `false` | Boundary check (not overdue until > 120 min) |
| R1-03 | Lead Card | `data_hora_entrada` = 121m ago, `etapa` = `'Analise'` | `true` | Exceeds 120 min in active stage |
| R1-04 | Lead Card | `data_hora_entrada` = 5h ago, `etapa` = `'Conclusao'` | `false` | Conclusão stage freezes/removes badge |
| R1-05 | Lead Card | `data_hora_entrada` = `null` or invalid string | `false` | Graceful null/invalid date handling |
| R2-01 | Pendência | `createdAt` = 45m ago, `completed` = `false` | `false` | Active pendência within limit |
| R2-02 | Pendência | `createdAt` = 150m ago, `completed` = `false` | `true` | Active pendência > 120 min overdue |
| R2-03 | Pendência | `createdAt` = 180m ago, `completed` = `true` | `false` | Completed pendência is not overdue |
| R2-04 | Pendência | `createdAt` = `undefined`, `completed` = `false` | `false` | Legacy/missing timestamp fallback |

### 4.2 Code Specification for `src/slaTest.ts`

```typescript
import assert from 'assert';
import { isLeadSLAOverdue, isPendenciaSLAOverdue, SLA_THRESHOLD_MS } from './utils/sla.ts';

function runSLATests() {
  console.log("Starting SLA Logic Test Suite (R1 & R2)...");
  
  const now = new Date("2026-07-31T15:00:00.000Z");

  // Helper date generators relative to fixed 'now'
  const minutesAgo = (min: number) => new Date(now.getTime() - min * 60 * 1000).toISOString();

  // -------------------------------------------------------------
  // R1: Lead Card SLA Tests
  // -------------------------------------------------------------
  console.log("\n--- Testing R1: Lead Card SLA ---");

  // R1-01: Lead created 30 mins ago in 'Roleta' -> NOT overdue
  {
    const result = isLeadSLAOverdue(minutesAgo(30), 'Roleta', now);
    assert.strictEqual(result, false, "Lead created 30m ago should not be overdue");
    console.log("Passed: Lead created 30m ago in Roleta is active & on time");
  }

  // R1-02: Lead created 120 mins ago (boundary) in 'Pendencia' -> NOT overdue
  {
    const result = isLeadSLAOverdue(minutesAgo(120), 'Pendencia', now);
    assert.strictEqual(result, false, "Lead created exactly 120m ago should not be overdue");
    console.log("Passed: Lead at exact 120m boundary is not overdue");
  }

  // R1-03: Lead created 121 mins ago in 'Analise' -> OVERDUE
  {
    const result = isLeadSLAOverdue(minutesAgo(121), 'Analise', now);
    assert.strictEqual(result, true, "Lead created 121m ago in Analise should be overdue");
    console.log("Passed: Lead created 121m ago in Analise is overdue");
  }

  // R1-04: Lead created 300 mins ago in 'Conclusao' -> NOT overdue (Frozen)
  {
    const result = isLeadSLAOverdue(minutesAgo(300), 'Conclusao', now);
    assert.strictEqual(result, false, "Lead in Conclusao should never be overdue");
    console.log("Passed: Lead in Conclusao is not overdue even if > 120m");
  }

  // R1-05: Invalid/Missing date handling -> NOT overdue
  {
    assert.strictEqual(isLeadSLAOverdue(null, 'Roleta', now), false);
    assert.strictEqual(isLeadSLAOverdue(undefined, 'Roleta', now), false);
    assert.strictEqual(isLeadSLAOverdue("invalid-date", 'Roleta', now), false);
    console.log("Passed: Missing/invalid entry dates safely return false");
  }

  // -------------------------------------------------------------
  // R2: Floating Pendências SLA Tests
  // -------------------------------------------------------------
  console.log("\n--- Testing R2: Floating Pendências SLA ---");

  // R2-01: Pendência created 45 mins ago, uncompleted -> NOT overdue
  {
    const result = isPendenciaSLAOverdue(minutesAgo(45), false, now);
    assert.strictEqual(result, false, "Uncompleted item created 45m ago should not be overdue");
    console.log("Passed: Pendência 45m ago is on time");
  }

  // R2-02: Pendência created 150 mins ago, uncompleted -> OVERDUE
  {
    const result = isPendenciaSLAOverdue(minutesAgo(150), false, now);
    assert.strictEqual(result, true, "Uncompleted item created 150m ago should be overdue");
    console.log("Passed: Pendência 150m ago is overdue");
  }

  // R2-03: Pendência created 180 mins ago, completed -> NOT overdue
  {
    const result = isPendenciaSLAOverdue(minutesAgo(180), true, now);
    assert.strictEqual(result, false, "Completed item should never be overdue");
    console.log("Passed: Completed pendência is not overdue");
  }

  // R2-04: Legacy item without createdAt timestamp -> NOT overdue
  {
    assert.strictEqual(isPendenciaSLAOverdue(undefined, false, now), false);
    assert.strictEqual(isPendenciaSLAOverdue(null, false, now), false);
    assert.strictEqual(isPendenciaSLAOverdue("invalid", false, now), false);
    console.log("Passed: Legacy pendência without valid timestamp safely returns false");
  }

  console.log("\nAll SLA tests completed successfully!");
}

try {
  runSLATests();
} catch (error) {
  console.error("SLA Test execution failed:", error);
  process.exit(1);
}
```

---

## 5. Integration into `package.json` & Build Pipeline (R3)

### 5.1 Proposed `package.json` Modifications
Add the SLA test script and a unified test command to `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test:parse": "tsx src/parseTest.ts",
  "test:sla": "tsx src/slaTest.ts",
  "test": "npm run test:parse && npm run test:sla"
}
```

### 5.2 Build Verification Mechanism
1. **TypeScript Type Safety**: Because `tsconfig.app.json` includes `src`, running `npm run build` triggers `tsc -b`, which type-checks `src/utils/sla.ts`, `src/slaTest.ts`, and all usages in `src/App.tsx`.
2. **Automated Logic Verification**: Executing `npm run test:sla` (or `cmd /c npx tsx src/slaTest.ts`) verifies the logical correctness of R1 and R2.

---

## 6. Independent Verification Method

To verify the SLA design and environment readiness independently:
1. Run `cmd /c npx tsx src/slaTest.ts` after implementation to verify pure logic assertions pass.
2. Run `cmd /c npm run build` to verify `tsc -b` passes without any compilation errors.
