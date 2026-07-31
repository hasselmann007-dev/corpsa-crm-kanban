import assert from 'assert';
import { isLeadSLAOverdue, isPendenciaSLAOverdue, SLA_THRESHOLD_MS } from './utils/sla.ts';

console.log("==========================================================");
console.log("=== EMPIRICAL CHALLENGER: SLA LEAD & HELPER STRESS TEST ===");
console.log("==========================================================");

let totalTestsRun = 0;
let totalFailures = 0;
const findings: { category: string; description: string; impact: string }[] = [];

function recordFinding(category: string, description: string, impact: string) {
  findings.push({ category, description, impact });
  console.error(`[FINDING] [${category}] ${description} (Impact: ${impact})`);
}

function test(name: string, fn: () => void) {
  totalTestsRun++;
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
  } catch (err: any) {
    totalFailures++;
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

const baseNow = new Date("2026-07-31T12:00:00.000Z");

// ============================================================================
// 1. BOUNDARY VALUE TESTS (119m 59s vs 120m 00s vs 120m 01s)
// ============================================================================
console.log("\n--- SECTION 1: Boundary Value Testing ---");

test("Boundary: 119m 59s ago (7,199,000 ms) -> NOT overdue", () => {
  const entryTime = new Date(baseNow.getTime() - (119 * 60 * 1000 + 59 * 1000)).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
  assert.strictEqual(res, false, "119m 59s should NOT be overdue");
});

test("Boundary: 119m 59.999s ago (7,199,999 ms) -> NOT overdue", () => {
  const entryTime = new Date(baseNow.getTime() - (SLA_THRESHOLD_MS - 1)).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
  assert.strictEqual(res, false, "119m 59.999s should NOT be overdue");
});

test("Boundary: Exact 120m 00s ago (7,200,000 ms) -> NOT overdue (strict >)", () => {
  const entryTime = new Date(baseNow.getTime() - SLA_THRESHOLD_MS).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
  assert.strictEqual(res, false, "Exact 120m 00s boundary should NOT be overdue");
});

test("Boundary: 120m 00.001s ago (7,200,001 ms) -> OVERDUE", () => {
  const entryTime = new Date(baseNow.getTime() - (SLA_THRESHOLD_MS + 1)).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
  assert.strictEqual(res, true, "120m 00.001s should be overdue");
});

test("Boundary: 120m 01s ago (7,201,000 ms) -> OVERDUE", () => {
  const entryTime = new Date(baseNow.getTime() - (120 * 60 * 1000 + 1000)).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
  assert.strictEqual(res, true, "120m 01s should be overdue");
});

test("Boundary: 121m 00s ago -> OVERDUE", () => {
  const entryTime = new Date(baseNow.getTime() - (121 * 60 * 1000)).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Analise', baseNow);
  assert.strictEqual(res, true, "121m should be overdue");
});


// ============================================================================
// 2. STAGE TRANSITIONS & FREEZING ('Roleta' -> 'Conclusao' -> 'Analise')
// ============================================================================
console.log("\n--- SECTION 2: Stage Transition & SLA Freezing ---");

test("Stage Transition: 'Roleta' (150m ago) -> Overdue", () => {
  const entryTime = new Date(baseNow.getTime() - 150 * 60 * 1000).toISOString();
  assert.strictEqual(isLeadSLAOverdue(entryTime, 'Roleta', baseNow), true);
});

test("Stage Transition: Move to 'Conclusao' (150m ago) -> SLA Freezes (false)", () => {
  const entryTime = new Date(baseNow.getTime() - 150 * 60 * 1000).toISOString();
  assert.strictEqual(isLeadSLAOverdue(entryTime, 'Conclusao', baseNow), false);
});

test("Stage Transition: Re-open from 'Conclusao' back to 'Analise' (150m ago) -> Unfreezes & Overdue", () => {
  const entryTime = new Date(baseNow.getTime() - 150 * 60 * 1000).toISOString();
  assert.strictEqual(isLeadSLAOverdue(entryTime, 'Analise', baseNow), true);
});

test("Stage Transition: Re-open from 'Conclusao' back to 'Pendencia' (150m ago) -> Unfreezes & Overdue", () => {
  const entryTime = new Date(baseNow.getTime() - 150 * 60 * 1000).toISOString();
  assert.strictEqual(isLeadSLAOverdue(entryTime, 'Pendencia', baseNow), true);
});

// Adversarial Stage Case Sensitivity & Accents
test("Adversarial Stage: Case sensitivity 'conclusao' (lowercase)", () => {
  const entryTime = new Date(baseNow.getTime() - 180 * 60 * 1000).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'conclusao', baseNow);
  // Implementation checks `etapa === 'Conclusao'`. 'conclusao' !== 'Conclusao', so it returns TRUE (overdue).
  if (res !== false) {
    recordFinding(
      "Stage String Sensitivity",
      "Stage 'conclusao' (lowercase) is NOT recognized as freezing stage because strict equality 'Conclusao' is used.",
      "Low - CRM normalizes stage names to 'Conclusao', but lowercasing would bypass SLA freezing."
    );
  }
});

test("Adversarial Stage: Accented 'Conclusão'", () => {
  const entryTime = new Date(baseNow.getTime() - 180 * 60 * 1000).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Conclusão', baseNow);
  if (res !== false) {
    recordFinding(
      "Stage String Accents",
      "Stage 'Conclusão' (with Portuguese accent 'ã') is NOT recognized as freezing stage.",
      "Low - CRM type uses 'Conclusao' without accent, but user data imports with accents would cause unexpected overdue status."
    );
  }
});


// ============================================================================
// 3. INVALID & MALFORMED DATES
// ============================================================================
console.log("\n--- SECTION 3: Invalid & Malformed Date Handling ---");

test("Invalid Date: null", () => {
  assert.strictEqual(isLeadSLAOverdue(null, 'Roleta', baseNow), false);
});

test("Invalid Date: undefined", () => {
  assert.strictEqual(isLeadSLAOverdue(undefined, 'Roleta', baseNow), false);
});

test("Invalid Date: empty string ''", () => {
  assert.strictEqual(isLeadSLAOverdue('', 'Roleta', baseNow), false);
});

test("Invalid Date: whitespace string '   '", () => {
  assert.strictEqual(isLeadSLAOverdue('   ', 'Roleta', baseNow), false);
});

test("Invalid Date: random text 'not-a-date'", () => {
  assert.strictEqual(isLeadSLAOverdue('not-a-date', 'Roleta', baseNow), false);
});

test("Invalid Date: malformed ISO '2026-13-45T99:99:99'", () => {
  assert.strictEqual(isLeadSLAOverdue('2026-13-45T99:99:99', 'Roleta', baseNow), false);
});

test("Invalid Date: Brazilian formatted date '31/07/2026 10:00:00'", () => {
  const res = isLeadSLAOverdue('31/07/2026 10:00:00', 'Roleta', baseNow);
  // JS Date.parse('31/07/2026 10:00:00') returns NaN in Node.js/V8!
  assert.strictEqual(res, false, "Non-standard Brazilian date format returns NaN, resulting in false");
  recordFinding(
    "Date Format Dependency",
    "Non-ISO dates like '31/07/2026 10:00:00' result in NaN in V8 Date constructor, returning false (never overdue).",
    "Medium - Parser MUST ensure ISO 8601 formatting for data_hora_entrada, otherwise SLA calculation fails silently."
  );
});


// ============================================================================
// 4. TIMEZONE OFFSETS & UTC HANDLING
// ============================================================================
console.log("\n--- SECTION 4: Timezone Offsets & UTC Handling ---");

test("Timezone: Entry 150m ago in Brasilia time (-03:00)", () => {
  // 2026-07-31T12:00:00.000Z minus 150 min = 2026-07-31T09:30:00.000Z
  // In -03:00 timezone, 09:30 UTC is 06:30-03:00.
  const entryIsoWithOffset = "2026-07-31T06:30:00.000-03:00";
  const res = isLeadSLAOverdue(entryIsoWithOffset, 'Roleta', baseNow);
  assert.strictEqual(res, true, "150m ago with -03:00 offset should be overdue");
});

test("Timezone: Entry 60m ago in UTC+05:30", () => {
  // 2026-07-31T12:00:00.000Z minus 60 min = 2026-07-31T11:00:00.000Z
  // In +05:30, 11:00 UTC is 16:30+05:30
  const entryIsoWithOffset = "2026-07-31T16:30:00.000+05:30";
  const res = isLeadSLAOverdue(entryIsoWithOffset, 'Roleta', baseNow);
  assert.strictEqual(res, false, "60m ago with +05:30 offset should NOT be overdue");
});

test("Timezone: Entry without offset specified '2026-07-31T09:30:00'", () => {
  // Without offset, JavaScript treats 'YYYY-MM-DDTHH:mm:ss' as LOCAL time!
  // In local node process, JS parses this in system local timezone!
  const localIso = "2026-07-31T09:30:00";
  console.log(`  Info: '2026-07-31T09:30:00' parsed as ${new Date(localIso).toISOString()} (System TZ offset applied)`);
  
  if (!localIso.endsWith('Z') && !localIso.includes('+') && !localIso.includes('-')) {
    recordFinding(
      "Unzoned ISO String Ambiguity",
      "ISO strings without trailing 'Z' or offset (e.g. '2026-07-31T09:30:00') are parsed as local system time, causing SLA discrepancies across different client timezones.",
      "Medium - All timestamps should be standard ISO 8601 UTC strings."
    );
  }
});


// ============================================================================
// 5. FUTURE DATES & CLOCK DESYNCHRONIZATION
// ============================================================================
console.log("\n--- SECTION 5: Future Dates & Clock Desynchronization ---");

test("Future Date: Entry 30 minutes in the FUTURE -> NOT overdue", () => {
  const entryTime = new Date(baseNow.getTime() + 30 * 60 * 1000).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
  assert.strictEqual(res, false, "Future entry time should NOT be overdue");
});

test("Future Date: Entry 10 hours in the FUTURE -> NOT overdue", () => {
  const entryTime = new Date(baseNow.getTime() + 10 * 3600 * 1000).toISOString();
  const res = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
  assert.strictEqual(res, false, "Far future entry time should NOT be overdue");
});


// ============================================================================
// 6. RANDOM MONTE CARLO STRESS TEST (500 RANDOM LEADS)
// ============================================================================
console.log("\n--- SECTION 6: Monte Carlo Random Stress Harness (500 iterations) ---");

let monteCarloSuccesses = 0;
const stages = ['Roleta', 'Pendencia', 'Analise', 'Conclusao', 'INVALID_STAGE'];

for (let i = 0; i < 500; i++) {
  // Generate random elapsed minutes from -300 to +300
  const randomMinutes = Math.floor(Math.random() * 600) - 300;
  const entryDate = new Date(baseNow.getTime() - randomMinutes * 60 * 1000);
  const stage = stages[Math.floor(Math.random() * stages.length)];

  const actualResult = isLeadSLAOverdue(entryDate.toISOString(), stage, baseNow);

  // Expected logic:
  // - If stage === 'Conclusao', false
  // - Else if randomMinutes > 120, true
  // - Else false
  let expectedResult = false;
  if (stage !== 'Conclusao' && randomMinutes > 120) {
    expectedResult = true;
  }

  if (actualResult === expectedResult) {
    monteCarloSuccesses++;
  } else {
    console.error(`[MONTE CARLO FAIL] Step ${i}: minutes=${randomMinutes}, stage=${stage}, expected=${expectedResult}, actual=${actualResult}`);
  }
}

console.log(`Monte Carlo Stress Test: ${monteCarloSuccesses}/500 passed.`);
assert.strictEqual(monteCarloSuccesses, 500, "All 500 Monte Carlo test cases must match invariant logic");


// ============================================================================
// 7. PENDÊNCIA (STICKY NOTES) SLA TESTS (R2 Verification)
// ============================================================================
console.log("\n--- SECTION 7: Pendência (Sticky Notes) SLA Verification ---");

test("Pendência Boundary: 119m 59s -> NOT overdue", () => {
  const createdTime = new Date(baseNow.getTime() - (119 * 60 * 1000 + 59 * 1000)).toISOString();
  assert.strictEqual(isPendenciaSLAOverdue(createdTime, false, baseNow), false);
});

test("Pendência Boundary: Exact 120m 00s -> NOT overdue", () => {
  const createdTime = new Date(baseNow.getTime() - SLA_THRESHOLD_MS).toISOString();
  assert.strictEqual(isPendenciaSLAOverdue(createdTime, false, baseNow), false);
});

test("Pendência Boundary: 120m 01s -> OVERDUE", () => {
  const createdTime = new Date(baseNow.getTime() - (120 * 60 * 1000 + 1000)).toISOString();
  assert.strictEqual(isPendenciaSLAOverdue(createdTime, false, baseNow), true);
});

test("Pendência Completed: 300m ago but completed=true -> NOT overdue", () => {
  const createdTime = new Date(baseNow.getTime() - 300 * 60 * 1000).toISOString();
  assert.strictEqual(isPendenciaSLAOverdue(createdTime, true, baseNow), false);
});

test("Pendência Invalid Date: null -> NOT overdue", () => {
  assert.strictEqual(isPendenciaSLAOverdue(null, false, baseNow), false);
});


// ============================================================================
// 8. APP HELPER WRAPPER SYNCHRONIZATION TEST
// ============================================================================
console.log("\n--- SECTION 8: App.tsx Wrapper Consistency ---");

test("App.tsx isSlaDelayed wrapper matches isLeadSLAOverdue directly", () => {
  const isSlaDelayed = (dataHoraEntrada?: string | null, etapa?: string): boolean => {
    return isLeadSLAOverdue(dataHoraEntrada, etapa, baseNow);
  };

  const testCases = [
    { date: new Date(baseNow.getTime() - 50000).toISOString(), stage: 'Roleta', expected: false },
    { date: new Date(baseNow.getTime() - 10000000).toISOString(), stage: 'Analise', expected: true },
    { date: new Date(baseNow.getTime() - 10000000).toISOString(), stage: 'Conclusao', expected: false },
    { date: null, stage: 'Roleta', expected: false },
  ];

  for (const tc of testCases) {
    const directRes = isLeadSLAOverdue(tc.date, tc.stage, baseNow);
    const wrapperRes = isSlaDelayed(tc.date, tc.stage);
    assert.strictEqual(wrapperRes, directRes);
    assert.strictEqual(wrapperRes, tc.expected);
  }
});


// ============================================================================
// SUMMARY REPORT
// ============================================================================
console.log("\n==========================================================");
console.log(`SUMMARY: Total Tests Run: ${totalTestsRun} | Failures: ${totalFailures}`);
console.log(`Findings Recorded: ${findings.length}`);
console.log("==========================================================");

if (findings.length > 0) {
  console.log("\n--- DETAILED FINDINGS ---");
  findings.forEach((f, idx) => {
    console.log(`${idx + 1}. [${f.category}] ${f.description} (Impact: ${f.impact})`);
  });
}

if (totalFailures > 0) {
  process.exit(1);
} else {
  console.log("\nAll Challenger SLA empirical tests completed!");
}
