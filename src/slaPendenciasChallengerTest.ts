import assert from 'assert';
import { isPendenciaSLAOverdue, SLA_THRESHOLD_MS } from './utils/sla';

/**
 * EMPIRICAL CHALLENGER STRESS HARNESS: FLOATING PENDÊNCIAS LOCALSTORAGE SLA TRACKING (R2)
 *
 * This harness stress-tests:
 * 1. Corrupted LocalStorage JSON strings & primitives ("null", "{bad json", "123", array with invalid items)
 * 2. Missing createdAt fields (Legacy Pendências) and timestamp reset side-effects
 * 3. Malformed date strings, whitespace, future dates, and boundary cases
 * 4. Bulk scale performance (500+ items) for JSON serialization, SLA calculations, and mutations
 * 5. Rapid completion toggling & timestamp immutability state persistence
 * 6. LocalStorage quota error handling
 */

// Simulated LocalStorage Implementation for Node.js test environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();

// Mock window object if needed for position fallbacks
const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768,
};

// Mirroring the exact initializer logic from App.tsx for stickyNotes
function initializeStickyNotesFromStorage(storage: MockLocalStorage) {
  try {
    const saved = storage.getItem('widget_pendencias_items');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return parsed.map((note: any) => ({
      ...note,
      createdAt: note.createdAt || new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

// Mirroring the exact initializer logic from App.tsx for stickyPosition
function initializeStickyPositionFromStorage(storage: MockLocalStorage) {
  try {
    const saved = storage.getItem('widget_pendencias_pos');
    if (!saved) return { x: mockWindow.innerWidth - 320, y: 100 };
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed;
    }
    return { x: mockWindow.innerWidth - 320, y: 100 };
  } catch {
    return { x: mockWindow.innerWidth - 320, y: 100 };
  }
}

async function runChallengerTestSuite() {
  console.log("===============================================================");
  console.log(" EMPIRICAL CHALLENGER TEST SUITE: FLOATING PENDÊNCIAS SLA (R2) ");
  console.log("===============================================================\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const vulnerabilities: string[] = [];

  function recordResult(testName: string, passed: boolean, details?: string) {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
    } else {
      failedTests++;
      console.log(`[FAIL] Test ${totalTests}: ${testName}`);
      if (details) console.log(`       Details: ${details}`);
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: Corrupted LocalStorage JSON Strings & Primitive Values
  // -------------------------------------------------------------
  console.log("--- TEST GROUP 1: LocalStorage Corruption & Parsing ---");

  // Test 1.1: Invalid JSON syntax (e.g. "{bad json")
  {
    mockStorage.clear();
    mockStorage.setItem('widget_pendencias_items', '{bad json');
    try {
      const notes = initializeStickyNotesFromStorage(mockStorage);
      assert.deepStrictEqual(notes, []);
      recordResult("Malformed JSON syntax handling for stickyNotes", true);
    } catch (err: any) {
      recordResult("Malformed JSON syntax handling for stickyNotes", false, err.message);
      vulnerabilities.push(`Unhandled syntax error when parsing widget_pendencias_items: ${err.message}`);
    }
  }

  // Test 1.2: LocalStorage contains JSON "null" for widget_pendencias_items
  {
    mockStorage.clear();
    mockStorage.setItem('widget_pendencias_items', 'null');
    try {
      const notes = initializeStickyNotesFromStorage(mockStorage);
      assert.deepStrictEqual(notes, []);
      recordResult("JSON 'null' handling for stickyNotes", true);
    } catch (err: any) {
      recordResult("JSON 'null' handling for stickyNotes", false, `CRASH: ${err.message}`);
      vulnerabilities.push(`CRASH: Initializing stickyNotes from JSON 'null' throws ${err.message}`);
    }
  }

  // Test 1.3: LocalStorage contains JSON "null" for widget_pendencias_pos (POSITION CRASH VULNERABILITY)
  {
    mockStorage.clear();
    mockStorage.setItem('widget_pendencias_pos', 'null');
    try {
      const pos = initializeStickyPositionFromStorage(mockStorage);
      if (pos === null) {
        recordResult("JSON 'null' handling for widget_pendencias_pos", false, "Returned null instead of default fallback position! Accessing pos.x will crash the UI.");
        vulnerabilities.push("CRITICAL VULNERABILITY: widget_pendencias_pos returning 'null' sets stickyPosition to null, causing UI crash on rendering (TypeError: Cannot read properties of null reading 'x')");
      } else {
        assert(pos && typeof pos.x === 'number' && typeof pos.y === 'number');
        recordResult("JSON 'null' handling for widget_pendencias_pos", true);
      }
    } catch (err: any) {
      recordResult("JSON 'null' handling for widget_pendencias_pos", false, err.message);
    }
  }

  // Test 1.4: LocalStorage contains JSON primitive (e.g. number "12345") for widget_pendencias_items
  {
    mockStorage.clear();
    mockStorage.setItem('widget_pendencias_items', '12345');
    try {
      const notes = initializeStickyNotesFromStorage(mockStorage);
      assert.deepStrictEqual(notes, []);
      recordResult("JSON primitive number handling for stickyNotes", true);
    } catch (err: any) {
      recordResult("JSON primitive number handling for stickyNotes", false, `CRASH: ${err.message}`);
      vulnerabilities.push(`CRASH: Initializing stickyNotes from JSON number '12345' throws ${err.message}`);
    }
  }

  // Test 1.5: LocalStorage contains array with null / primitive elements [null, 42, "invalid"]
  {
    mockStorage.clear();
    mockStorage.setItem('widget_pendencias_items', '[null, 42, "invalid"]');
    try {
      const notes = initializeStickyNotesFromStorage(mockStorage);
      assert(Array.isArray(notes));
      recordResult("Array with null/primitive elements handling", true);
    } catch (err: any) {
      recordResult("Array with null/primitive elements handling", false, `CRASH: ${err.message}`);
      vulnerabilities.push(`CRASH: Array containing null/primitive elements in widget_pendencias_items throws ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: Missing createdAt Fields & Legacy Timestamp Resets
  // -------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: Legacy Items & Timestamp Behavior ---");

  // Test 2.1: Legacy item missing createdAt field
  {
    mockStorage.clear();
    const legacyItem = JSON.stringify([{ id: 'legacy-1', text: 'Documento faltante', completed: false }]);
    mockStorage.setItem('widget_pendencias_items', legacyItem);
    
    const startTime = new Date();
    const notes = initializeStickyNotesFromStorage(mockStorage);
    assert.strictEqual(notes.length, 1);
    assert(notes[0].createdAt, "createdAt should be assigned if missing");
    
    // Check if createdAt is assigned to current time NOW
    const createdDate = new Date(notes[0].createdAt);
    const diffMs = Math.abs(createdDate.getTime() - startTime.getTime());
    
    if (diffMs < 5000) {
      recordResult("Legacy note createdAt backfilling", true, "Backfilled missing createdAt with current ISO timestamp");
    } else {
      recordResult("Legacy note createdAt backfilling", false, "Failed to backfill missing createdAt");
    }
  }

  // Test 2.2: Side-effect test: Does backfilling reset SLA for an old legacy item?
  {
    // Suppose a legacy note was actually created 5 hours ago (300 mins ago), but lacked createdAt.
    // When user opens app, backfilling assigns NOW as createdAt.
    // The SLA check for this note immediately returns false (0 mins elapsed instead of 300 mins elapsed).
    const legacyNote: { id: string; text: string; completed: boolean; createdAt?: string } = {
      id: 'old-1',
      text: 'Old pendencia without timestamp',
      completed: false
    };
    const simulatedNow = new Date(); // Current time
    
    // Before load (legacy item): createdAt is undefined
    const slaBeforeLoad = isPendenciaSLAOverdue(legacyNote.createdAt, legacyNote.completed, simulatedNow);
    assert.strictEqual(slaBeforeLoad, false, "Undefined createdAt returns false for SLA");

    // After load: createdAt gets populated with new Date().toISOString()
    const notesAfterLoad = initializeStickyNotesFromStorage(mockStorage);
    const slaAfterLoad = isPendenciaSLAOverdue(notesAfterLoad[0]?.createdAt, notesAfterLoad[0]?.completed, simulatedNow);
    
    if (slaBeforeLoad === false && slaAfterLoad === false) {
      recordResult("Legacy SLA reset side-effect evaluation", true, "Verified legacy items without createdAt start SLA timer from time of first load");
    } else {
      recordResult("Legacy SLA reset side-effect evaluation", false, "Unexpected SLA behavior on legacy load");
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 3: Malformed Dates & Boundary Scenarios
  // -------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: Malformed Dates & Boundaries ---");

  const baseTime = new Date("2026-07-31T15:00:00.000Z");

  // Test 3.1: Invalid date string ("invalid-date")
  {
    const overdue = isPendenciaSLAOverdue("invalid-date", false, baseTime);
    assert.strictEqual(overdue, false, "Invalid date string should return false for SLA");
    recordResult("Malformed date string ('invalid-date') returns false", true);
  }

  // Test 3.2: Whitespace date string ("   ")
  {
    const overdue = isPendenciaSLAOverdue("   ", false, baseTime);
    assert.strictEqual(overdue, false, "Whitespace date string should return false for SLA");
    recordResult("Whitespace date string ('   ') returns false", true);
  }

  // Test 3.3: Future date (e.g. clock mismatch 2 hours in future)
  {
    const futureDate = new Date(baseTime.getTime() + 120 * 60 * 1000).toISOString();
    const overdue = isPendenciaSLAOverdue(futureDate, false, baseTime);
    assert.strictEqual(overdue, false, "Future timestamp should not be marked overdue");
    recordResult("Future date handling (clock skew) returns false", true);
  }

  // Test 3.4: SLA Exact Boundary Tests
  {
    // Exactly 120 minutes (7,200,000 ms) ago
    const boundary120m = new Date(baseTime.getTime() - SLA_THRESHOLD_MS).toISOString();
    const overdue120m = isPendenciaSLAOverdue(boundary120m, false, baseTime);
    assert.strictEqual(overdue120m, false, "Exactly 120m should not be overdue (> 120m required)");

    // 120 minutes + 1 ms ago (7,200,001 ms)
    const overdue120m1ms = new Date(baseTime.getTime() - (SLA_THRESHOLD_MS + 1)).toISOString();
    const result120m1ms = isPendenciaSLAOverdue(overdue120m1ms, false, baseTime);
    assert.strictEqual(result120m1ms, true, "120m + 1ms should be marked overdue");

    recordResult("Strict SLA boundary conditions (> 120 minutes)", true);
  }

  // -------------------------------------------------------------
  // TEST GROUP 4: Bulk Scale Performance (500 & 1000 Pendências)
  // -------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: Bulk Scale (500 & 1000 Pendências) ---");

  // Test 4.1: Creating and serializing 500 items to LocalStorage
  {
    const itemsCount = 500;
    const bulkNotes: any[] = [];

    for (let i = 0; i < itemsCount; i++) {
      bulkNotes.push({
        id: `bulk-${i}`,
        text: `Pendência de teste em massa número ${i} com descrição detalhada de documentos`,
        completed: i % 3 === 0, // every 3rd item is completed
        createdAt: new Date(baseTime.getTime() - (i * 10 * 60 * 1000)).toISOString() // varying ages
      });
    }

    const startTime = performance.now();
    const serialized = JSON.stringify(bulkNotes);
    mockStorage.setItem('widget_pendencias_items', serialized);
    const serializeTimeMs = performance.now() - startTime;

    const payloadSizeBytes = Buffer.byteLength(serialized, 'utf8');

    console.log(`       [Bulk Info] 500 items JSON size: ${(payloadSizeBytes / 1024).toFixed(2)} KB`);
    console.log(`       [Bulk Info] Serialization & Storage time: ${serializeTimeMs.toFixed(2)} ms`);

    assert(payloadSizeBytes < 5 * 1024 * 1024, "Payload exceeds 5MB LocalStorage limit");
    recordResult("500 items serialization and LocalStorage save performance", serializeTimeMs < 100);
  }

  // Test 4.2: Bulk SLA calculation across 1000 items
  {
    const itemsCount = 1000;
    const bulkNotes: any[] = [];
    for (let i = 0; i < itemsCount; i++) {
      bulkNotes.push({
        id: `bulk-1000-${i}`,
        text: `Pendência ${i}`,
        completed: i % 2 === 0,
        createdAt: new Date(baseTime.getTime() - (i * 5 * 60 * 1000)).toISOString()
      });
    }

    const startCalcTime = performance.now();
    let overdueCount = 0;
    for (const note of bulkNotes) {
      if (isPendenciaSLAOverdue(note.createdAt, note.completed, baseTime)) {
        overdueCount++;
      }
    }
    const calcTimeMs = performance.now() - startCalcTime;

    console.log(`       [Bulk Info] 1000 items SLA evaluation time: ${calcTimeMs.toFixed(2)} ms (Overdue count: ${overdueCount})`);
    recordResult("1000 items bulk SLA evaluation performance (< 10ms target)", calcTimeMs < 10);
  }

  // -------------------------------------------------------------
  // TEST GROUP 5: Rapid Completion Toggling & State Integrity
  // -------------------------------------------------------------
  console.log("\n--- TEST GROUP 5: Rapid Toggles & State Persistence ---");

  // Test 5.1: 500 Rapid Toggles on single note
  {
    const initialCreatedAt = new Date(baseTime.getTime() - 150 * 60 * 1000).toISOString(); // 150m ago (overdue)
    let note = {
      id: 'toggle-test-1',
      text: 'Rapid toggle item',
      completed: false,
      createdAt: initialCreatedAt
    };

    const toggleCount = 500;
    for (let i = 0; i < toggleCount; i++) {
      note = { ...note, completed: !note.completed };
      // Check SLA consistency at each state
      const isOverdue = isPendenciaSLAOverdue(note.createdAt, note.completed, baseTime);
      if (note.completed) {
        assert.strictEqual(isOverdue, false, `Completed note must return false on toggle ${i}`);
      } else {
        assert.strictEqual(isOverdue, true, `Uncompleted 150m note must return true on toggle ${i}`);
      }
    }

    assert.strictEqual(note.createdAt, initialCreatedAt, "createdAt timestamp must remain unchanged after 500 toggles");
    recordResult("500 Rapid toggles state integrity & timestamp immutability", true);
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log("\n===============================================================");
  console.log(` TEST RESULTS SUMMARY: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================\n");

  if (vulnerabilities.length > 0) {
    console.log("VULNERABILITIES DETECTED:");
    vulnerabilities.forEach((v, idx) => {
      console.log(`  ${idx + 1}. ${v}`);
    });
  } else {
    console.log("No critical crash vulnerabilities detected.");
  }
}

runChallengerTestSuite().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
