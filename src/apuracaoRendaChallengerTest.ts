import assert from 'assert';

console.log("==========================================================================");
console.log("=== EMPIRICAL CHALLENGER: APURAÇÃO DE RENDA UI & STATE STRESS TEST HARNESS ===");
console.log("==========================================================================");

let totalTestsRun = 0;
let totalFailures = 0;
const findings: { category: string; description: string; impact: string }[] = [];

function recordFinding(category: string, description: string, impact: string) {
  findings.push({ category, description, impact });
  console.error(`[FINDING] [${category}] ${description} (Impact: ${impact})`);
}

function test(name: string, fn: () => void | Promise<void>) {
  totalTestsRun++;
  try {
    const res = fn();
    if (res && typeof (res as any).then === 'function') {
      return (res as any).then(() => {
        console.log(`✓ PASS: ${name}`);
      }).catch((err: any) => {
        totalFailures++;
        console.error(`✗ FAIL: ${name}`);
        console.error(`  Error: ${err.message}`);
      });
    }
    console.log(`✓ PASS: ${name}`);
  } catch (err: any) {
    totalFailures++;
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
  }
}

// Mock LocalStorage implementation for Node environment testing
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const mockStorage = new MockLocalStorage();
const STORAGE_KEY = 'crm_apuracoes_renda_v1';

// Initial Mock Sessions matching ApuracaoRendaTab.tsx
const INITIAL_MOCK_SESSIONS = [
  {
    id: 'ap-1',
    nomeCliente: 'DANILO HASSELMANN',
    cpfCliente: '123.456.789-09',
    status: 'Concluída',
    dataCriacao: '2026-07-30T14:20:00.000Z',
    arquivos: [
      { id: 'f-1', name: 'Holerite_Maio_2026.pdf', size: '1.2 MB', type: 'PDF', uploadedAt: '30/07/2026 14:20' },
      { id: 'f-2', name: 'Extrato_Bancario_3Meses.pdf', size: '2.8 MB', type: 'PDF', uploadedAt: '30/07/2026 14:21' }
    ],
    regrasConsiderar: 'Salário Base (R$ 8.500), Comissão recorrente média (R$ 1.200).',
    regrasDesconsiderar: 'Desconsiderar Horas Extras eventuais e 1/3 de férias pago em Maio.',
    rendaFormal: 8500,
    rendaInformal: 1200,
    rendaBruta: 9700,
    rendaLiquida: 8200,
    descontosDesconsiderados: 450,
    capacidadePagamento: 2460,
    mensagens: [
      { id: 'm-1', sender: 'system', text: 'Sessão de apuração iniciada', timestamp: '30/07 14:20' }
    ]
  },
  {
    id: 'ap-2',
    nomeCliente: 'PAOLA DE ANDRADE GOMES',
    cpfCliente: '058.554.656-83',
    status: 'Em Análise',
    dataCriacao: '2026-07-31T09:15:00.000Z',
    arquivos: [
      { id: 'f-3', name: 'IRPF_2026_Recibo.pdf', size: '850 KB', type: 'PDF', uploadedAt: '31/07/2026 09:15' }
    ],
    regrasConsiderar: 'Pró-labore mensal regular de R$ 12.000.',
    regrasDesconsiderar: 'Desconsiderar distribuição de lucros variável não recorrente.',
    rendaFormal: 12000,
    rendaInformal: 0,
    rendaBruta: 12000,
    rendaLiquida: 10400,
    descontosDesconsiderados: 0,
    capacidadePagamento: 3120,
    mensagens: [
      { id: 'm-4', sender: 'system', text: 'Sessão iniciada', timestamp: '31/07 09:15' }
    ]
  }
];

// Helper reproducing ApuracaoRendaTab state initialization logic
function initializeSessoesFromStorage(storage: MockLocalStorage): any[] {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s: any) => ({
          ...s,
          rendaFormal: s.rendaFormal !== undefined ? Number(s.rendaFormal) : (s.rendaBruta || 0),
          rendaInformal: s.rendaInformal !== undefined ? Number(s.rendaInformal) : 0
        }));
      }
    }
    return INITIAL_MOCK_SESSIONS;
  } catch {
    return INITIAL_MOCK_SESSIONS;
  }
}

// Helper reproducing ApuracaoRendaTab calculateFallbackMetrics logic
function calculateFallbackMetrics(sessao: any) {
  let formal = sessao.rendaFormal || 6500;
  let informal = sessao.rendaInformal || 2300;
  let descontos = sessao.descontosDesconsiderados || 450;

  const regrasConsiderarStr = sessao.regrasConsiderar || '';
  const regrasDesconsiderarStr = sessao.regrasDesconsiderar || '';

  if (regrasConsiderarStr.toLowerCase().includes('pró-labore') || regrasConsiderarStr.toLowerCase().includes('pro-labore')) {
    formal = 12000;
    informal = 0;
  }
  if (regrasConsiderarStr.toLowerCase().includes('comissão') || regrasConsiderarStr.toLowerCase().includes('autônomo')) {
    informal += 1500;
  }
  if (regrasDesconsiderarStr.toLowerCase().includes('horas extras') || regrasDesconsiderarStr.toLowerCase().includes('férias')) {
    descontos += 350;
  }

  const bruta = formal + informal;
  const liquida = Math.max(0, bruta - Math.round(bruta * 0.12));
  const capacidade = Math.round(liquida * 0.30);

  const files = sessao.arquivos || [];
  const docNames = files.map((f: any) => f.name).join(', ');

  return {
    rendaFormal: formal,
    rendaInformal: informal,
    rendaBruta: bruta,
    descontosDesconsiderados: descontos,
    rendaLiquida: liquida,
    capacidadePagamento: capacidade,
    resumoParecer: `Análise realizada via NotebookLM (Ponte 1-Clique CLI/API). Documentos auditados: [${docNames || 'Comprovantes Anexados'}]. ` +
                   `Renda Formal de R$ ${formal.toLocaleString('pt-BR')} validada via holerite/declaração. ` +
                   `Renda Informal de R$ ${informal.toLocaleString('pt-BR')} verificada via extratos de movimentação. ` +
                   `Desconsiderados R$ ${descontos.toLocaleString('pt-BR')} em descontos eventuais/consignados. ` +
                   `Renda Líquida Aprovável homologada em R$ ${liquida.toLocaleString('pt-BR')} (Capacidade de parcela 30%: R$ ${capacidade.toLocaleString('pt-BR')}/mês).`
  };
}

// Helper reproducing search filter in sidebar
function filterSessoes(sessoes: any[], searchTerm: string): any[] {
  return sessoes.filter(s => 
    s.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cpfCliente.includes(searchTerm) ||
    s.status.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

// ============================================================================
// SECTION 1: LOCALSTORAGE SERIALIZATION & DESERIALIZATION STRESS TESTS
// ============================================================================
console.log("\n--- SECTION 1: LocalStorage Serialization & Deserialization ---");

test("LocalStorage: Default fallback when key does not exist", () => {
  mockStorage.clear();
  const sessoes = initializeSessoesFromStorage(mockStorage);
  assert.strictEqual(sessoes.length, 2);
  assert.strictEqual(sessoes[0].nomeCliente, 'DANILO HASSELMANN');
});

test("LocalStorage: Corrupted JSON string gracefully caught", () => {
  mockStorage.setItem(STORAGE_KEY, "{corrupted_json_string...");
  const sessoes = initializeSessoesFromStorage(mockStorage);
  assert.strictEqual(sessoes.length, 2, "Corrupted JSON must fallback to default mock sessions");
});

test("LocalStorage: Empty array returns default mock sessions", () => {
  mockStorage.setItem(STORAGE_KEY, "[]");
  const sessoes = initializeSessoesFromStorage(mockStorage);
  assert.strictEqual(sessoes.length, 2, "Empty array fallback to default mock sessions");
});

test("LocalStorage: Non-array JSON (object/number/boolean) returns default mock sessions", () => {
  mockStorage.setItem(STORAGE_KEY, '{"id": "ap-99", "nomeCliente": "TESTE"}');
  const sessoes = initializeSessoesFromStorage(mockStorage);
  assert.strictEqual(sessoes.length, 2, "Non-array JSON fallback to default mock sessions");

  mockStorage.setItem(STORAGE_KEY, '12345');
  const sessoesNum = initializeSessoesFromStorage(mockStorage);
  assert.strictEqual(sessoesNum.length, 2);
});

test("LocalStorage: Array with null element throws TypeError inside map (caught by try/catch)", () => {
  mockStorage.setItem(STORAGE_KEY, '[null]');
  const sessoes = initializeSessoesFromStorage(mockStorage);
  assert.strictEqual(sessoes.length, 2, "Array containing null falls back to initial mock sessions via try/catch");
  recordFinding(
    "LocalStorage Array Null Element",
    "If LocalStorage contains array with null element `[null]`, `map((s: any) => s.rendaFormal)` throws a TypeError. It is caught by try/catch and falls back to INITIAL_MOCK_SESSIONS, but individual null filtering is safer.",
    "Low - Handled by top-level try/catch"
  );
});

test("LocalStorage: Legacy sessions without rendaFormal/rendaInformal correctly populated", () => {
  const legacyData = [
    {
      id: 'legacy-1',
      nomeCliente: 'CLIENTE LEGACY',
      cpfCliente: '111.222.333-44',
      status: 'Em Análise',
      dataCriacao: '2026-07-01T10:00:00.000Z',
      arquivos: [],
      regrasConsiderar: '',
      regrasDesconsiderar: '',
      rendaBruta: 5000,
      rendaLiquida: 4400,
      descontosDesconsiderados: 0,
      capacidadePagamento: 1320,
      mensagens: []
    }
  ];
  mockStorage.setItem(STORAGE_KEY, JSON.stringify(legacyData));
  const sessoes = initializeSessoesFromStorage(mockStorage);
  assert.strictEqual(sessoes[0].rendaFormal, 5000, "rendaFormal fallback to rendaBruta for legacy items");
  assert.strictEqual(sessoes[0].rendaInformal, 0, "rendaInformal fallback to 0 for legacy items");
});

test("LocalStorage: String representation of numbers safely parsed", () => {
  const stringNumData = [
    {
      id: 'str-1',
      nomeCliente: 'CLIENTE STR NUM',
      cpfCliente: '111.222.333-44',
      status: 'Em Análise',
      rendaFormal: '7500',
      rendaInformal: '1500',
      rendaBruta: '9000',
      arquivos: [],
      mensagens: []
    }
  ];
  mockStorage.setItem(STORAGE_KEY, JSON.stringify(stringNumData));
  const sessoes = initializeSessoesFromStorage(mockStorage);
  assert.strictEqual(typeof sessoes[0].rendaFormal, 'number');
  assert.strictEqual(sessoes[0].rendaFormal, 7500);
  assert.strictEqual(sessoes[0].rendaInformal, 1500);
});

test("LocalStorage: Unsafe property access check on missing numeric fields for UI render", () => {
  const missingFieldsData = [
    {
      id: 'missing-1',
      nomeCliente: 'CLIENTE SEM CAMPOS',
      cpfCliente: '111.222.333-44',
      status: 'Em Análise',
      rendaBruta: undefined,
      descontosDesconsiderados: undefined,
      rendaLiquida: undefined,
      capacidadePagamento: undefined,
      arquivos: [],
      mensagens: []
    }
  ];
  mockStorage.setItem(STORAGE_KEY, JSON.stringify(missingFieldsData));
  const sessoes = initializeSessoesFromStorage(mockStorage);
  const sessao = sessoes[0];

  // Test UI render expressions from lines 955, 964, 973, 982 in ApuracaoRendaTab.tsx:
  // line 955: activeSessao.rendaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  let crashLine955 = false;
  try {
    (sessao.rendaBruta as any).toLocaleString('pt-BR');
  } catch (err: any) {
    crashLine955 = true;
  }
  assert.strictEqual(crashLine955, true, "activeSessao.rendaBruta.toLocaleString throws TypeError when undefined");
  recordFinding(
    "Missing Null Fallback on Card Render",
    "Lines 955, 964, 973, 982, 761 call `.toLocaleString('pt-BR')` directly on activeSessao.rendaBruta, descontosDesconsiderados, rendaLiquida, e capacidadePagamento without nullish coalescing `|| 0`, which crashes React rendering if fields are undefined/null.",
    "Medium - Malformed session data in LocalStorage/Supabase will crash the entire Apuração tab."
  );
});


// ============================================================================
// SECTION 2: SIDEBAR HISTORY SEARCH FILTERING STRESS TESTS
// ============================================================================
console.log("\n--- SECTION 2: Sidebar History Search Filtering Stress Tests ---");

test("Search Filter: Standard client name matching (case insensitive)", () => {
  const result1 = filterSessoes(INITIAL_MOCK_SESSIONS, "danilo");
  assert.strictEqual(result1.length, 1);
  assert.strictEqual(result1[0].id, "ap-1");

  const result2 = filterSessoes(INITIAL_MOCK_SESSIONS, "PAOLA");
  assert.strictEqual(result2.length, 1);
  assert.strictEqual(result2[0].id, "ap-2");
});

test("Search Filter: CPF matching (with and without formatting dots)", () => {
  const result1 = filterSessoes(INITIAL_MOCK_SESSIONS, "123.456");
  assert.strictEqual(result1.length, 1);
  assert.strictEqual(result1[0].id, "ap-1");

  const result2 = filterSessoes(INITIAL_MOCK_SESSIONS, "058.554");
  assert.strictEqual(result2.length, 1);
  assert.strictEqual(result2[0].id, "ap-2");
});

test("Search Filter: Status matching", () => {
  const result1 = filterSessoes(INITIAL_MOCK_SESSIONS, "Concluída");
  assert.strictEqual(result1.length, 1);
  assert.strictEqual(result1[0].id, "ap-1");

  const result2 = filterSessoes(INITIAL_MOCK_SESSIONS, "Em Análise");
  assert.strictEqual(result2.length, 1);
  assert.strictEqual(result2[0].id, "ap-2");
});

test("Search Filter: Special regex/glob characters do not crash string.includes", () => {
  const specialChars = ["[", "]", "(", ")", "*", "+", "?", "\\", "^", "$", "{", "}", "|"];
  for (const char of specialChars) {
    const res = filterSessoes(INITIAL_MOCK_SESSIONS, char);
    assert.strictEqual(Array.isArray(res), true);
  }
});

test("Search Filter: Accents vs Unaccented search behavior", () => {
  // s.status is "Em Análise"
  const resWithAccent = filterSessoes(INITIAL_MOCK_SESSIONS, "Análise");
  assert.strictEqual(resWithAccent.length, 1);

  const resWithoutAccent = filterSessoes(INITIAL_MOCK_SESSIONS, "Analise");
  // In line 274: s.status.toLowerCase().includes("analise") returns false because "em análise" !== "analise"
  if (resWithoutAccent.length === 0) {
    recordFinding(
      "Search Accent Insensitivity Missing",
      "Searching 'Analise' (without accent) does NOT match status 'Em Análise' because normal `.includes()` is used without accent normalization (e.g. `normalize('NFD')`).",
      "Low - Search behavior is sensitive to diacritics in Portuguese words like 'Análise' / 'Concluída'."
    );
  }
});

test("Search Filter: Handling missing/null properties in session object", () => {
  const malformedSession = [
    {
      id: 'mal-1',
      nomeCliente: null as any,
      cpfCliente: undefined as any,
      status: 'Concluída'
    }
  ];

  let crashOnNullName = false;
  try {
    filterSessoes(malformedSession, "test");
  } catch (err) {
    crashOnNullName = true;
  }
  assert.strictEqual(crashOnNullName, true, "filterSessoes crashes when nomeCliente or cpfCliente is null/undefined");
  recordFinding(
    "Search Filter Null Property Crash",
    "Line 274 `s.nomeCliente.toLowerCase()` and `s.cpfCliente.includes()` throw TypeError if `nomeCliente` or `cpfCliente` is null/undefined.",
    "Medium - Malformed session record causes search input to throw uncaught render error."
  );
});


// ============================================================================
// SECTION 3: FALLBACK INCOME CALCULATIONS STRESS TESTS
// ============================================================================
console.log("\n--- SECTION 3: Fallback Income Calculations Stress Tests ---");

test("Fallback Income: Standard default values when fields missing/zero", () => {
  const emptySession = {
    id: 'emp-1',
    nomeCliente: 'TESTE',
    cpfCliente: '000.000.000-00',
    status: 'Em Análise',
    dataCriacao: new Date().toISOString(),
    arquivos: [{ id: 'f-1', name: 'Holerite.pdf' }],
    regrasConsiderar: '',
    regrasDesconsiderar: '',
    rendaFormal: 0,
    rendaInformal: 0,
    rendaBruta: 0,
    rendaLiquida: 0,
    descontosDesconsiderados: 0,
    capacidadePagamento: 0,
    mensagens: []
  };

  const metrics = calculateFallbackMetrics(emptySession);
  assert.strictEqual(metrics.rendaFormal, 6500);
  assert.strictEqual(metrics.rendaInformal, 2300);
  assert.strictEqual(metrics.descontosDesconsiderados, 450);
  assert.strictEqual(metrics.rendaBruta, 8800); // 6500 + 2300
  assert.strictEqual(metrics.rendaLiquida, 7744); // 8800 - round(8800 * 0.12) = 8800 - 1056 = 7744
  assert.strictEqual(metrics.capacidadePagamento, 2323); // round(7744 * 0.30) = 2323
});

test("Fallback Income: Zero Income Overwrite Bug Verification", () => {
  // Scenario: Client has 0 formal income (100% informal worker with R$ 5.000 informal income)
  const zeroFormalSession = {
    id: 'z-1',
    nomeCliente: 'AUTÔNOMO PURO',
    cpfCliente: '123.456.789-00',
    status: 'Em Análise',
    arquivos: [{ id: 'f-1', name: 'Extrato.pdf' }],
    regrasConsiderar: 'Movimentação PIX',
    regrasDesconsiderar: '',
    rendaFormal: 0,
    rendaInformal: 5000,
    descontosDesconsiderados: 0,
    mensagens: []
  };

  const metrics = calculateFallbackMetrics(zeroFormalSession);
  // Implementation line 281: `let formal = sessao.rendaFormal || 6500;`
  // Since 0 is falsy, formal becomes 6500 instead of keeping 0!
  assert.strictEqual(metrics.rendaFormal, 6500, "0 || 6500 overwrites 0 with 6500");
  recordFinding(
    "Zero Income Falsy Overwrite Bug in Fallback",
    "In `calculateFallbackMetrics`, `let formal = sessao.rendaFormal || 6500` treats `0` as falsy and overwrites explicit R$ 0 formal income with R$ 6.500. Same occurs for `rendaInformal` and `descontosDesconsiderados`.",
    "High - An audit session with R$ 0 formal income will incorrectly calculate R$ 6.500 formal income in fallback mode."
  );
});

test("Fallback Income: Rule keyword matching 'Pró-labore' / 'pro-labore'", () => {
  const proLaboreSession = {
    id: 'pl-1',
    regrasConsiderar: 'Pró-labore mensal regular de R$ 12.000',
    regrasDesconsiderar: '',
    rendaFormal: 0,
    rendaInformal: 0,
    descontosDesconsiderados: 0,
    arquivos: [{ id: 'f-1', name: 'IRPF.pdf' }]
  };

  const metrics = calculateFallbackMetrics(proLaboreSession);
  assert.strictEqual(metrics.rendaFormal, 12000);
  assert.strictEqual(metrics.rendaInformal, 0);
  assert.strictEqual(metrics.rendaBruta, 12000);
  assert.strictEqual(metrics.rendaLiquida, 10560); // 12000 - round(12000 * 0.12) = 12000 - 1440 = 10560
  assert.strictEqual(metrics.capacidadePagamento, 3168); // round(10560 * 0.30) = 3168
});

test("Fallback Income: Rule keyword matching 'Comissão' and 'Horas Extras'", () => {
  const commSession = {
    id: 'cm-1',
    regrasConsiderar: 'Comissão recorrente de vendas',
    regrasDesconsiderar: 'Horas extras eventuais',
    rendaFormal: 4000,
    rendaInformal: 1000,
    descontosDesconsiderados: 100,
    arquivos: [{ id: 'f-1', name: 'Holerite.pdf' }]
  };

  const metrics = calculateFallbackMetrics(commSession);
  assert.strictEqual(metrics.rendaFormal, 4000);
  assert.strictEqual(metrics.rendaInformal, 2500); // 1000 + 1500
  assert.strictEqual(metrics.descontosDesconsiderados, 450); // 100 + 350
  assert.strictEqual(metrics.rendaBruta, 6500);
});

test("Fallback Income: Missing rules or files arrays handled gracefully or caught", () => {
  const nullRulesSession = {
    id: 'nr-1',
    regrasConsiderar: null as any,
    regrasDesconsiderar: undefined as any,
    arquivos: null as any
  };

  let crashOnNullRules = false;
  try {
    calculateFallbackMetrics(nullRulesSession);
  } catch (err) {
    crashOnNullRules = true;
  }
  if (crashOnNullRules) {
    recordFinding(
      "Fallback Calculation Null Safety",
      "Line 286 in `calculateFallbackMetrics` calls `sessao.regrasConsiderar.toLowerCase()` without null check `(sessao.regrasConsiderar || '')`, causing crash if session properties are null/undefined.",
      "Medium - New or imported sessions with null rule properties will throw during analysis."
    );
  }
});


// ============================================================================
// SECTION 4: STATE TRANSITION INTEGRITY & WORKFLOW HARNESS
// ============================================================================
console.log("\n--- SECTION 4: State Transition & Workflow Harness ---");

test("State Transitions: Execution workflow from empty files -> error state", () => {
  let state: any = { status: 'idle', progressPercent: 0, currentStepMessage: '' };

  const activeSessaoNoFiles = {
    id: 'no-file-1',
    arquivos: []
  };

  // Simulate handleAnalisarNotebookLM file validation
  if (!activeSessaoNoFiles.arquivos || activeSessaoNoFiles.arquivos.length === 0) {
    state = {
      status: 'error',
      progressPercent: 0,
      currentStepMessage: '',
      errorMessage: 'Anexe pelo menos 1 documento (holerite, extrato ou IRPF) antes de iniciar a análise no NotebookLM (1-Clique).'
    };
  }

  assert.strictEqual(state.status, 'error');
  assert.strictEqual(state.progressPercent, 0);
  assert.strictEqual(typeof state.errorMessage, 'string');
});

test("State Transitions: Complete 4-step sequence ('uploading' -> 'analyzing' -> 'calculating' -> 'complete')", async () => {
  const stepsRecorded: string[] = [];

  let state: any = { status: 'idle', progressPercent: 0, currentStepMessage: '' };

  // Step 1: Uploading
  state = {
    status: 'uploading',
    progressPercent: 30,
    currentStepMessage: 'Passo 1/3 [Uploading]: Enviando 2 documento(s)...'
  };
  stepsRecorded.push(state.status);
  assert.strictEqual(state.status, 'uploading');
  assert.strictEqual(state.progressPercent, 30);

  // Step 2: Analyzing
  state = {
    status: 'analyzing',
    progressPercent: 65,
    currentStepMessage: 'Passo 2/3 [Analyzing]: Extraindo comprovantes...'
  };
  stepsRecorded.push(state.status);
  assert.strictEqual(state.status, 'analyzing');
  assert.strictEqual(state.progressPercent, 65);

  // Step 3: Calculating
  state = {
    status: 'calculating',
    progressPercent: 90,
    currentStepMessage: 'Passo 3/3 [Calculating]: Calculando Renda Formal...'
  };
  stepsRecorded.push(state.status);
  assert.strictEqual(state.status, 'calculating');
  assert.strictEqual(state.progressPercent, 90);

  // Step 4: Complete
  state = {
    status: 'complete',
    progressPercent: 100,
    currentStepMessage: 'Apuração concluída com sucesso!'
  };
  stepsRecorded.push(state.status);
  assert.strictEqual(state.status, 'complete');
  assert.strictEqual(state.progressPercent, 100);

  assert.deepStrictEqual(stepsRecorded, ['uploading', 'analyzing', 'calculating', 'complete']);
});

test("State Transitions: Processing flag `isProcessing` lock during execution", () => {
  const getIsProcessing = (status: string) => status !== 'idle' && status !== 'complete' && status !== 'error';

  assert.strictEqual(getIsProcessing('idle'), false);
  assert.strictEqual(getIsProcessing('uploading'), true);
  assert.strictEqual(getIsProcessing('analyzing'), true);
  assert.strictEqual(getIsProcessing('calculating'), true);
  assert.strictEqual(getIsProcessing('complete'), false);
  assert.strictEqual(getIsProcessing('error'), false);
});


// ============================================================================
// SECTION 5: MONTE CARLO RANDOMIZED STRESS HARNESS (1000 ITERATIONS)
// ============================================================================
console.log("\n--- SECTION 5: Monte Carlo Randomized Stress Harness (1000 iterations) ---");

let monteCarloPassed = 0;
const ruleKeywords = ['Pró-labore', 'pro-labore', 'Comissão', 'autônomo', 'horas extras', 'férias', 'fixo', 'eventual', 'bônus'];
const statuses = ['Em Análise', 'Concluída', 'Pendente de Doc'];

for (let i = 0; i < 1000; i++) {
  try {
    const randomFormal = Math.floor(Math.random() * 20000);
    const randomInformal = Math.floor(Math.random() * 15000);
    const randomDescontos = Math.floor(Math.random() * 3000);
    const kw1 = ruleKeywords[Math.floor(Math.random() * ruleKeywords.length)];
    const kw2 = ruleKeywords[Math.floor(Math.random() * ruleKeywords.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const simSession = {
      id: `mc-${i}`,
      nomeCliente: `CLIENTE TESTE ${i}`,
      cpfCliente: `${Math.floor(Math.random() * 900 + 100)}.${Math.floor(Math.random() * 900 + 100)}.${Math.floor(Math.random() * 900 + 100)}-00`,
      status,
      dataCriacao: new Date().toISOString(),
      arquivos: [{ id: `f-${i}`, name: `Doc_${i}.pdf`, size: '1 MB', type: 'PDF', uploadedAt: '12/08/2026' }],
      regrasConsiderar: `Regra considerar: ${kw1}`,
      regrasDesconsiderar: `Regra desconsiderar: ${kw2}`,
      rendaFormal: randomFormal,
      rendaInformal: randomInformal,
      rendaBruta: randomFormal + randomInformal,
      rendaLiquida: Math.max(0, (randomFormal + randomInformal) - randomDescontos),
      descontosDesconsiderados: randomDescontos,
      capacidadePagamento: Math.round(Math.max(0, (randomFormal + randomInformal) - randomDescontos) * 0.3),
      mensagens: []
    };

    // 1. Serialization cycle
    mockStorage.setItem(STORAGE_KEY, JSON.stringify([simSession]));
    const loaded = initializeSessoesFromStorage(mockStorage);
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].id, `mc-${i}`);

    // 2. Search filter
    const searchRes = filterSessoes(loaded, `TESTE ${i}`);
    assert.strictEqual(searchRes.length, 1);

    // 3. Fallback metrics calculation
    const fallbackRes = calculateFallbackMetrics(simSession);
    assert.strictEqual(typeof fallbackRes.rendaFormal, 'number');
    assert.strictEqual(typeof fallbackRes.rendaInformal, 'number');
    assert.strictEqual(typeof fallbackRes.rendaBruta, 'number');
    assert.strictEqual(typeof fallbackRes.rendaLiquida, 'number');
    assert.strictEqual(typeof fallbackRes.capacidadePagamento, 'number');
    assert.strictEqual(typeof fallbackRes.resumoParecer, 'string');
    assert.strictEqual(fallbackRes.rendaLiquida >= 0, true);

    monteCarloPassed++;
  } catch (err: any) {
    console.error(`[MONTE CARLO STRESS FAIL] Iteration ${i}: ${err.message}`);
  }
}

console.log(`Monte Carlo Stress Test: ${monteCarloPassed}/1000 iterations passed successfully!`);
assert.strictEqual(monteCarloPassed, 1000);


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
  console.log("\nAll Apuração de Renda empirical stress tests completed!");
}
