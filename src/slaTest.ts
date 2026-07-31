import assert from 'assert';
import { isLeadSLAOverdue, isPendenciaSLAOverdue, SLA_THRESHOLD_MS } from './utils/sla.ts';

function runSLATests() {
  console.log("Starting SLA Tracking Test Suite...");

  const baseNow = new Date("2026-07-31T12:00:00.000Z");

  // -------------------------------------------------------------
  // Test Case 1: Requirement R1 - Lead SLA (< 120m)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 1: Lead created < 120m ago");
    // Created 60 minutes ago
    const entryTime = new Date(baseNow.getTime() - 60 * 60 * 1000).toISOString();
    const result = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
    assert.strictEqual(result, false, "Lead under 120m should not be overdue");
    console.log("Test 1 Passed!");
  }

  // -------------------------------------------------------------
  // Test Case 2: Requirement R1 - Lead SLA (exact 120m boundary)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 2: Lead created exactly 120m ago (boundary)");
    const entryTime = new Date(baseNow.getTime() - SLA_THRESHOLD_MS).toISOString();
    const result = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
    assert.strictEqual(result, false, "Lead at exactly 120m boundary should not be overdue");
    console.log("Test 2 Passed!");
  }

  // -------------------------------------------------------------
  // Test Case 3: Requirement R1 - Lead SLA (> 120m overdue in Roleta)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 3: Lead created > 120m ago (121 minutes) in 'Roleta'");
    const entryTime = new Date(baseNow.getTime() - (121 * 60 * 1000)).toISOString();
    const result = isLeadSLAOverdue(entryTime, 'Roleta', baseNow);
    assert.strictEqual(result, true, "Lead over 120m in Roleta should be marked overdue");
    console.log("Test 3 Passed!");
  }

  // -------------------------------------------------------------
  // Test Case 4: Requirement R1 - Lead SLA ('Pendencia' / 'Analise' / 'Conclusao' no alert)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 4: Lead created > 120m ago in stage 'Pendencia' or 'Conclusao'");
    const entryTime = new Date(baseNow.getTime() - (180 * 60 * 1000)).toISOString();
    assert.strictEqual(isLeadSLAOverdue(entryTime, 'Pendencia', baseNow), false, "Lead in Pendencia should NOT show SLA alert");
    assert.strictEqual(isLeadSLAOverdue(entryTime, 'Analise', baseNow), false, "Lead in Analise should NOT show SLA alert");
    assert.strictEqual(isLeadSLAOverdue(entryTime, 'Conclusao', baseNow), false, "Lead in Conclusao should NOT show SLA alert");
    console.log("Test 4 Passed!");
  }

  // -------------------------------------------------------------
  // Test Case 5: Requirement R1 - Lead SLA (missing / invalid dates)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 5: Lead with missing or invalid date_hora_entrada");
    assert.strictEqual(isLeadSLAOverdue(null, 'Roleta', baseNow), false, "Null date should return false");
    assert.strictEqual(isLeadSLAOverdue(undefined, 'Roleta', baseNow), false, "Undefined date should return false");
    assert.strictEqual(isLeadSLAOverdue('', 'Roleta', baseNow), false, "Empty string date should return false");
    assert.strictEqual(isLeadSLAOverdue('not-a-date', 'Roleta', baseNow), false, "Invalid date format should return false");
    console.log("Test 5 Passed!");
  }

  // -------------------------------------------------------------
  // Test Case 6: Requirement R2 - Pendência SLA (< 120m)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 6: Pendência created < 120m ago");
    const createdTime = new Date(baseNow.getTime() - 45 * 60 * 1000).toISOString();
    const result = isPendenciaSLAOverdue(createdTime, false, baseNow);
    assert.strictEqual(result, false, "Pendência under 120m should not be overdue");
    console.log("Test 6 Passed!");
  }

  // -------------------------------------------------------------
  // Test Case 7: Requirement R2 - Pendência SLA (> 120m overdue)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 7: Pendência created > 120m ago (130 minutes)");
    const createdTime = new Date(baseNow.getTime() - 130 * 60 * 1000).toISOString();
    const result = isPendenciaSLAOverdue(createdTime, false, baseNow);
    assert.strictEqual(result, true, "Uncompleted Pendência over 120m should be overdue");
    console.log("Test 7 Passed!");
  }

  // -------------------------------------------------------------
  // Test Case 8: Requirement R2 - Pendência SLA (Completed item)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 8: Completed Pendência created > 120m ago");
    const createdTime = new Date(baseNow.getTime() - 200 * 60 * 1000).toISOString();
    const result = isPendenciaSLAOverdue(createdTime, true, baseNow);
    assert.strictEqual(result, false, "Completed pendência should not be overdue regardless of age");
    console.log("Test 8 Passed!");
  }

  // -------------------------------------------------------------
  // Test Case 9: Requirement R2 - Pendência SLA (Legacy / missing timestamp)
  // -------------------------------------------------------------
  {
    console.log("\nRunning Test 9: Pendência with missing or legacy timestamp");
    assert.strictEqual(isPendenciaSLAOverdue(null, false, baseNow), false, "Null createdAt should return false");
    assert.strictEqual(isPendenciaSLAOverdue(undefined, false, baseNow), false, "Undefined createdAt should return false");
    assert.strictEqual(isPendenciaSLAOverdue('', false, baseNow), false, "Empty string createdAt should return false");
    assert.strictEqual(isPendenciaSLAOverdue('invalid-timestamp', false, baseNow), false, "Invalid timestamp should return false");
    console.log("Test 9 Passed!");
  }

  console.log("\nAll SLA tests completed successfully!");
}

try {
  runSLATests();
} catch (error) {
  console.error("SLA Test execution failed:", error);
  process.exit(1);
}
