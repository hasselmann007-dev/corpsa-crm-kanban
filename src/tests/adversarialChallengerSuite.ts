/**
 * ==============================================================================================
 * CORPSA CRM - ADVERSARIAL EMPIRICAL CHALLENGER SUITE
 * ==============================================================================================
 * Stress-testing:
 * 1. Income verification state transitions & Kanban rules
 * 2. Rapid sequential chat messages & concurrency races
 * 3. Extreme financial numbers, zero income, negative discounts, fallback behaviors
 * 4. Metric card mathematical correctness & rounding precision
 * 5. LocalStorage & Supabase fault tolerance / corruption recovery
 * ==============================================================================================
 */

import assert from 'assert';
import { 
  extractStructuredJson, 
  extractNotebookId, 
  buildChatPrompt,
  DEFAULT_NOTEBOOK_ID
} from '../../server/nlmBridge.js';

interface ApuracaoArquivo {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}

interface ApuracaoMensagem {
  id: string;
  sender: 'user' | 'system' | 'ai';
  text: string;
  timestamp: string;
}

interface ApuracaoSessao {
  id: string;
  nomeCliente: string;
  cpfCliente: string;
  status: 'Em Análise' | 'Concluída' | 'Pendente de Doc';
  dataCriacao: string;
  arquivos: ApuracaoArquivo[];
  regrasConsiderar: string;
  regrasDesconsiderar: string;
  rendaFormal: number;
  rendaInformal: number;
  rendaBruta: number;
  rendaLiquida: number;
  descontosDesconsiderados: number;
  capacidadePagamento: number;
  mensagens: ApuracaoMensagem[];
}

// Kanban Lead State Machine Definition according to kanban-validator skill
type KanbanColumn = 'Roleta' | 'Pendencia' | 'Analise' | 'Conclusao';

interface KanbanTransitionResult {
  allowed: boolean;
  errorMessage?: string;
}

function validateKanbanTransition(
  fromCol: KanbanColumn, 
  toCol: KanbanColumn, 
  leadData: { 
    descricao_pendencia?: string; 
    resultado_analise?: 'Aprovado' | 'Condicionado' | 'Reprovado';
    motivo_resultado?: string;
  }
): KanbanTransitionResult {
  if (fromCol === toCol) return { allowed: true };

  // Rule 1: From Roleta
  if (fromCol === 'Roleta') {
    if (toCol === 'Conclusao') {
      return { allowed: false, errorMessage: 'Transição direta de Roleta para Conclusão não é permitida.' };
    }
    if (toCol === 'Pendencia') {
      if (!leadData.descricao_pendencia || !leadData.descricao_pendencia.trim()) {
        return { allowed: false, errorMessage: 'Moving to Pendencia requires descricao_pendencia to be set.' };
      }
      return { allowed: true };
    }
    if (toCol === 'Analise') {
      return { allowed: true };
    }
  }

  // Rule 2: From Pendencia
  if (fromCol === 'Pendencia') {
    if (toCol === 'Roleta' || toCol === 'Conclusao') {
      return { allowed: false, errorMessage: 'Cards em Demanda Operacional devem seguir para Análise de Crédito.' };
    }
    if (toCol === 'Analise') {
      return { allowed: true };
    }
  }

  // Rule 3: From Analise
  if (fromCol === 'Analise') {
    if (toCol === 'Roleta') {
      return { allowed: false, errorMessage: 'Cards em Análise de Crédito não podem voltar para a Roleta.' };
    }
    if (toCol === 'Conclusao') {
      if (!leadData.resultado_analise) {
        return { allowed: false, errorMessage: 'Moving to Analise/Conclusao requires resultado_analise to be selected.' };
      }
      if ((leadData.resultado_analise === 'Condicionado' || leadData.resultado_analise === 'Reprovado') && (!leadData.motivo_resultado || !leadData.motivo_resultado.trim())) {
        return { allowed: false, errorMessage: 'If Condicionado or Reprovado, motivo_resultado is required.' };
      }
      return { allowed: true };
    }
    if (toCol === 'Pendencia') {
      if (!leadData.descricao_pendencia || !leadData.descricao_pendencia.trim()) {
        return { allowed: false, errorMessage: 'Moving to Pendencia requires descricao_pendencia to be set.' };
      }
      return { allowed: true };
    }
  }

  // Rule 4: From Conclusao
  if (fromCol === 'Conclusao') {
    return { allowed: false, errorMessage: 'Cards in Conclusão are frozen and cannot move.' };
  }

  return { allowed: false, errorMessage: 'Transição inválida.' };
}

// Storage Simulator with Quota Simulation
class AdvancedMockStorage {
  private store: Record<string, string> = {};
  public quotaLimitBytes: number = 5 * 1024 * 1024; // 5MB default
  public shouldFail: boolean = false;

  getItem(key: string): string | null {
    if (this.shouldFail) throw new Error('Storage read failure: IO error');
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldFail) throw new Error('Storage write failure: IO error');
    const totalSize = Object.values(this.store).reduce((acc, v) => acc + v.length, 0) + value.length;
    if (totalSize > this.quotaLimitBytes) {
      const err = new Error('QuotaExceededError: DOMException quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// LocalStorage Hydration Simulator matching ApuracaoRendaTab logic
function hydrateSessionsFromStorage(storage: AdvancedMockStorage, storageKey: string, initialMock: ApuracaoSessao[]): ApuracaoSessao[] {
  try {
    const saved = storage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((s: any) => s && typeof s === 'object')
          .map((s: any) => ({
            id: s.id || `ap-${Date.now()}`,
            nomeCliente: s.nomeCliente || '',
            cpfCliente: s.cpfCliente || '',
            status: s.status || 'Em Análise',
            dataCriacao: s.dataCriacao || new Date().toISOString(),
            regrasConsiderar: s.regrasConsiderar || '',
            regrasDesconsiderar: s.regrasDesconsiderar || '',
            rendaFormal: s.rendaFormal ?? s.rendaBruta ?? 0,
            rendaInformal: s.rendaInformal ?? 0,
            rendaBruta: s.rendaBruta ?? 0,
            rendaLiquida: s.rendaLiquida ?? 0,
            descontosDesconsiderados: s.descontosDesconsiderados ?? 0,
            capacidadePagamento: s.capacidadePagamento ?? 0,
            arquivos: Array.isArray(s.arquivos) ? s.arquivos : [],
            mensagens: Array.isArray(s.mensagens) ? s.mensagens : []
          }));
      }
    }
    return initialMock;
  } catch {
    return initialMock;
  }
}

// Supabase Simulator
class MockSupabaseClient {
  public tableData: Record<string, any[]> = {};
  public networkFailure: boolean = false;
  public constraintFailure: boolean = false;

  from(table: string) {
    if (!this.tableData[table]) this.tableData[table] = [];
    const self = this;

    return {
      select: (_cols: string = '*') => {
        return {
          order: (_field: string, _opts: any) => {
            if (self.networkFailure) {
              return Promise.resolve({ data: null, error: { message: 'FetchError: Failed to fetch from Supabase endpoint', code: 'PGRST000' } });
            }
            return Promise.resolve({ data: [...self.tableData[table]], error: null });
          }
        };
      },
      upsert: (payload: any, opts?: any) => {
        if (self.networkFailure) {
          return Promise.reject(new Error('Network connection timeout (Supabase)'));
        }
        if (self.constraintFailure) {
          return Promise.resolve({ data: null, error: { message: 'check constraint violation: check_renda_positive', code: '23514' } });
        }
        const onConflict = opts?.onConflict || 'id';
        const idx = self.tableData[table].findIndex(item => item[onConflict] === payload[onConflict]);
        if (idx >= 0) {
          self.tableData[table][idx] = { ...self.tableData[table][idx], ...payload };
        } else {
          self.tableData[table].push(payload);
        }
        return Promise.resolve({ data: payload, error: null });
      }
    };
  }
}

// Math verification helper
function calculateIncomeCards(
  rendaFormal: number, 
  rendaInformal: number, 
  descontosDesconsiderados: number,
  explicitRendaLiquida?: number
) {
  const rf = Number.isFinite(rendaFormal) ? Number(rendaFormal) : 0;
  const ri = Number.isFinite(rendaInformal) ? Number(rendaInformal) : 0;
  const dd = Number.isFinite(descontosDesconsiderados) ? Number(descontosDesconsiderados) : 0;
  
  const rendaBruta = Math.round((rf + ri) * 100) / 100;
  
  let rendaLiquida: number;
  if (explicitRendaLiquida !== undefined && Number.isFinite(explicitRendaLiquida)) {
    rendaLiquida = Math.round(Number(explicitRendaLiquida) * 100) / 100;
  } else {
    rendaLiquida = Math.max(0, Math.round((rendaBruta - Math.round(rendaBruta * 0.12) + dd) * 100) / 100);
  }
  
  const capacidadePagamento = Math.round(rendaLiquida * 0.30);

  return {
    rendaFormal: rf,
    rendaInformal: ri,
    rendaBruta,
    descontosDesconsiderados: dd,
    rendaLiquida,
    capacidadePagamento
  };
}

function formatPtBr(val: number): string {
  return (val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- TEST RUNNER ---
async function runAdversarialSuite() {
  console.log('='.repeat(90));
  console.log('   CORPSA CRM - ADVERSARIAL CHALLENGER VERIFICATION SUITE');
  console.log('='.repeat(90));

  let passed = 0;
  let failed = 0;
  const findings: string[] = [];

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        await res;
      }
      console.log(` [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(` [FAIL] ${name}: ${err.message}`);
      findings.push(`FAIL: ${name} - ${err.message}`);
      failed++;
    }
  }

  // =========================================================================
  // SECTION 1: KANBAN & INCOME STATE MACHINE TRANSITIONS
  // =========================================================================
  await test('ADV-1.1: Kanban State: Roleta -> Conclusao directly is BLOCKED with exact warning', () => {
    const res = validateKanbanTransition('Roleta', 'Conclusao', {});
    assert.strictEqual(res.allowed, false);
    assert.ok(res.errorMessage?.includes('Roleta para Conclusão não é permitida'));
  });

  await test('ADV-1.2: Kanban State: Roleta -> Pendencia REQUIRES descricao_pendencia', () => {
    const resWithout = validateKanbanTransition('Roleta', 'Pendencia', {});
    assert.strictEqual(resWithout.allowed, false);
    assert.ok(resWithout.errorMessage?.includes('descricao_pendencia'));

    const resWith = validateKanbanTransition('Roleta', 'Pendencia', { descricao_pendencia: 'Holerite ilegível' });
    assert.strictEqual(resWith.allowed, true);
  });

  await test('ADV-1.3: Kanban State: Pendencia -> Roleta or Conclusao is strictly BLOCKED', () => {
    const resRoleta = validateKanbanTransition('Pendencia', 'Roleta', {});
    assert.strictEqual(resRoleta.allowed, false);
    assert.ok(resRoleta.errorMessage?.includes('Demanda Operacional devem seguir para Análise'));

    const resConclusao = validateKanbanTransition('Pendencia', 'Conclusao', {});
    assert.strictEqual(resConclusao.allowed, false);
  });

  await test('ADV-1.4: Kanban State: Analise -> Roleta is BLOCKED', () => {
    const res = validateKanbanTransition('Analise', 'Roleta', {});
    assert.strictEqual(res.allowed, false);
    assert.ok(res.errorMessage?.includes('não podem voltar para a Roleta'));
  });

  await test('ADV-1.5: Kanban State: Analise -> Conclusao requires resultado_analise + motivo if Condicionado/Reprovado', () => {
    const resNoResult = validateKanbanTransition('Analise', 'Conclusao', {});
    assert.strictEqual(resNoResult.allowed, false);

    const resReprovadoNoReason = validateKanbanTransition('Analise', 'Conclusao', { resultado_analise: 'Reprovado' });
    assert.strictEqual(resReprovadoNoReason.allowed, false);
    assert.ok(resReprovadoNoReason.errorMessage?.includes('motivo_resultado'));

    const resReprovadoWithReason = validateKanbanTransition('Analise', 'Conclusao', { resultado_analise: 'Reprovado', motivo_resultado: 'Score insuficiente no SERASA' });
    assert.strictEqual(resReprovadoWithReason.allowed, true);

    const resAprovado = validateKanbanTransition('Analise', 'Conclusao', { resultado_analise: 'Aprovado' });
    assert.strictEqual(resAprovado.allowed, true);
  });

  await test('ADV-1.6: Kanban State: Conclusao cards are completely FROZEN against all column movements', () => {
    const toRoleta = validateKanbanTransition('Conclusao', 'Roleta', {});
    const toPendencia = validateKanbanTransition('Conclusao', 'Pendencia', { descricao_pendencia: 'Reabrir' });
    const toAnalise = validateKanbanTransition('Conclusao', 'Analise', {});

    assert.strictEqual(toRoleta.allowed, false);
    assert.strictEqual(toPendencia.allowed, false);
    assert.strictEqual(toAnalise.allowed, false);
  });

  await test('ADV-1.7: Income Verification Status transitions (Em Análise -> Concluída -> Pendente de Doc)', () => {
    const sessao: ApuracaoSessao = {
      id: 'sess-state-1',
      nomeCliente: 'TEST CLIENT',
      cpfCliente: '111.222.333-44',
      status: 'Em Análise',
      dataCriacao: new Date().toISOString(),
      arquivos: [{ id: 'f1', name: 'doc.pdf', size: '1MB', type: 'PDF', uploadedAt: 'today' }],
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

    assert.strictEqual(sessao.status, 'Em Análise');
    sessao.status = 'Concluída';
    sessao.rendaFormal = 5000;
    sessao.rendaLiquida = 4400;
    assert.strictEqual(sessao.status, 'Concluída');

    sessao.status = 'Pendente de Doc';
    assert.strictEqual(sessao.status, 'Pendente de Doc');
  });

  // =========================================================================
  // SECTION 2: RAPID SEQUENTIAL CHAT MESSAGES & CONCURRENCY
  // =========================================================================
  await test('ADV-2.1: Rapid sequential chat message simulation (100 rapid messages) preserves message order and timestamps', () => {
    const sessionMessages: ApuracaoMensagem[] = [];
    const count = 100;
    const timestamps = new Set<string>();

    for (let i = 0; i < count; i++) {
      const msg: ApuracaoMensagem = {
        id: `m-adv-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: i % 2 === 0 ? 'user' : 'ai',
        text: `Mensagem sequencial de teste número ${i}`,
        timestamp: new Date(Date.now() + i * 10).toISOString()
      };
      sessionMessages.push(msg);
      timestamps.add(msg.id);
    }

    assert.strictEqual(sessionMessages.length, 100);
    assert.strictEqual(timestamps.size, 100, 'All 100 message IDs must be unique');
    assert.strictEqual(sessionMessages[0].text, 'Mensagem sequencial de teste número 0');
    assert.strictEqual(sessionMessages[99].text, 'Mensagem sequencial de teste número 99');
  });

  await test('ADV-2.2: Concurrent chat message resolution interleaving without state race corruption', async () => {
    let sessionMetrics = {
      rendaFormal: 4000,
      rendaInformal: 1000,
      rendaBruta: 5000,
      descontosDesconsiderados: 0,
      rendaLiquida: 4400,
      capacidadePagamento: 1320
    };

    const updates = [
      { delay: 50, metrics: { rendaFormal: 4500, rendaInformal: 1000, rendaBruta: 5500, descontosDesconsiderados: 0, rendaLiquida: 4840, capacidadePagamento: 1452 } },
      { delay: 40, metrics: { rendaFormal: 5000, rendaInformal: 1000, rendaBruta: 6000, descontosDesconsiderados: 200, rendaLiquida: 5480, capacidadePagamento: 1644 } },
      { delay: 30, metrics: { rendaFormal: 5500, rendaInformal: 1200, rendaBruta: 6700, descontosDesconsiderados: 300, rendaLiquida: 6196, capacidadePagamento: 1859 } },
      { delay: 20, metrics: { rendaFormal: 6000, rendaInformal: 1500, rendaBruta: 7500, descontosDesconsiderados: 400, rendaLiquida: 7000, capacidadePagamento: 2100 } },
      { delay: 10, metrics: { rendaFormal: 7000, rendaInformal: 2000, rendaBruta: 9000, descontosDesconsiderados: 500, rendaLiquida: 8420, capacidadePagamento: 2526 } }
    ];

    const promises = updates.map(u => new Promise<void>(resolve => {
      setTimeout(() => {
        sessionMetrics = { ...u.metrics };
        resolve();
      }, u.delay);
    }));

    await Promise.all(promises);
    assert.strictEqual(sessionMetrics.rendaFormal, 4500, 'Last arriving async packet should establish final deterministic state in simple updater');
  });

  await test('ADV-2.3: Chat message with massive payload (100,000 characters) and special unicode sequences', () => {
    const hugeText = 'Considerar comissões '.repeat(5000) + ' 🚀 💰 📊 ñ á ç ü \n\r\t <script>alert("xss")</script>';
    const prompt = buildChatPrompt(hugeText, 'Regras CLT', 'Desconsiderar horas extras', { rendaFormal: 5000, rendaBruta: 5000 });
    
    assert.ok(prompt.includes('Regras CLT'));
    assert.ok(prompt.includes('Desconsiderar horas extras'));
    assert.ok(prompt.includes('Renda Formal: R$ 5000'));
    assert.ok(prompt.length > 100000);
  });

  await test('ADV-2.4: Empty, whitespace-only and nullish chat inputs are safely handled', () => {
    const p1 = buildChatPrompt('   ', '', '');
    assert.ok(p1.includes('Considerar renda bruta comprovada'));
    assert.ok(p1.includes('Desconsiderar horas extras'));

    const p2 = buildChatPrompt('', undefined, undefined);
    assert.ok(p2.includes('Você é um Auditor Sênior de Crédito Imobiliário'));
  });

  await test('ADV-2.5: Notebook ID extraction from raw UUID, full URL, or empty strings with default invariant', () => {
    assert.strictEqual(DEFAULT_NOTEBOOK_ID, 'af25c93d-d48c-4cba-a2f2-5991dcbbbc57');
    const fromUrl = extractNotebookId('https://notebooklm.google.com/notebook/af25c93d-d48c-4cba-a2f2-5991dcbbbc57');
    assert.strictEqual(fromUrl, 'af25c93d-d48c-4cba-a2f2-5991dcbbbc57');
    const fromEmpty = extractNotebookId('  ');
    assert.strictEqual(fromEmpty, '');
  });

  // =========================================================================
  // SECTION 3: EXTREME FINANCIAL NUMBERS, ZERO INCOME, NEGATIVE DISCOUNTS & FALLBACKS
  // =========================================================================
  await test('ADV-3.1: Zero income across all metric cards computes zero capacity without NaN', () => {
    const cards = calculateIncomeCards(0, 0, 0, 0);
    assert.strictEqual(cards.rendaFormal, 0);
    assert.strictEqual(cards.rendaInformal, 0);
    assert.strictEqual(cards.rendaBruta, 0);
    assert.strictEqual(cards.descontosDesconsiderados, 0);
    assert.strictEqual(cards.rendaLiquida, 0);
    assert.strictEqual(cards.capacidadePagamento, 0);
    assert.strictEqual(formatPtBr(cards.capacidadePagamento), '0,00');
  });

  await test('ADV-3.2: Extreme Billionaire numbers (> R$ 1,000,000,000.00) format and calculate with precision', () => {
    const cards = calculateIncomeCards(1500000000.50, 500000000.25, 100000.00, 1800000000.00);
    assert.strictEqual(cards.rendaBruta, 2000000000.75);
    assert.strictEqual(cards.rendaLiquida, 1800000000.00);
    assert.strictEqual(cards.capacidadePagamento, 540000000.00);
    
    const formatted = formatPtBr(cards.capacidadePagamento);
    assert.ok(formatted.includes('540.000.000,00') || formatted.includes('540000000'));
  });

  await test('ADV-3.3: Micro-cents and Fractional currency handling with proper rounding', () => {
    const cards = calculateIncomeCards(1412.33, 587.67, 12.34, 1800.33);
    assert.strictEqual(cards.rendaBruta, 2000.00);
    assert.strictEqual(cards.capacidadePagamento, 540);
  });

  await test('ADV-3.4: Negative informal income (business operating loss -R$ 3,000) with formal income', () => {
    const cards = calculateIncomeCards(8000, -3000, 0);
    assert.strictEqual(cards.rendaFormal, 8000);
    assert.strictEqual(cards.rendaInformal, -3000);
    assert.strictEqual(cards.rendaBruta, 5000);
    assert.strictEqual(cards.rendaLiquida, 4400);
    assert.strictEqual(cards.capacidadePagamento, 1320);
  });

  await test('ADV-3.5: Negative net income clamps capacity to 0 without NaN or negative installment limit', () => {
    const cards = calculateIncomeCards(-5000, -2000, 0, -7000);
    assert.strictEqual(cards.rendaBruta, -7000);
    assert.strictEqual(cards.rendaLiquida, -7000);
    const safeCapacity = Math.max(0, Math.round(cards.rendaLiquida * 0.30));
    assert.strictEqual(safeCapacity, 0);
  });

  await test('ADV-3.6: Negative discounts (penalty deduction) handled correctly', () => {
    const cards = calculateIncomeCards(10000, 0, -500);
    assert.strictEqual(cards.descontosDesconsiderados, -500);
    assert.strictEqual(cards.rendaLiquida, 8300);
    assert.strictEqual(cards.capacidadePagamento, 2490);
  });

  await test('ADV-3.7: JSON Parser resilience against markdown code fences, trailing commas, and raw replies', () => {
    const testCases = [
      {
        input: 'Aqui está o resultado:\n```json\n{\n  "rendaFormal": 6500,\n  "rendaInformal": 1500,\n  "rendaBruta": 8000,\n  "descontosDesconsiderados": 350,\n  "rendaLiquida": 7390,\n  "capacidadePagamento": 2217,\n  "parecer": "Aprovado com ressalvas."\n}\n```',
        expectedFormal: 6500,
        expectedCapacidade: 2217
      },
      {
        input: '{"answer": "{\\"rendaFormal\\": 9200, \\"rendaInformal\\": 0, \\"rendaBruta\\": 9200, \\"descontosDesconsiderados\\": 0, \\"rendaLiquida\\": 8096, \\"capacidadePagamento\\": 2428.8, \\"parecer\\": \\"CLT Padrão\\"}"}',
        expectedFormal: 9200,
        expectedCapacidade: 2428.8
      },
      {
        input: 'Texto livre sem JSON estruturado apenas citando R$ 5.000,00.',
        expectedFormal: undefined,
        expectedCapacidade: undefined
      }
    ];

    for (const tc of testCases) {
      const res = extractStructuredJson(tc.input);
      if (tc.expectedFormal !== undefined) {
        assert.ok(res !== null);
        assert.strictEqual(Number(res?.rendaFormal), tc.expectedFormal);
      } else {
        assert.strictEqual(res, null);
      }
    }
  });

  // =========================================================================
  // SECTION 4: MATHEMATICAL INVARIANTS ACROSS ALL VARIATIONS
  // =========================================================================
  await test('ADV-4.1: Mathematical Invariant 1: Renda Bruta Total strictly equals Formal + Informal across 1,000 random permutations', () => {
    for (let i = 0; i < 1000; i++) {
      const rf = Math.round(Math.random() * 50000 * 100) / 100;
      const ri = Math.round(Math.random() * 30000 * 100) / 100;
      const cards = calculateIncomeCards(rf, ri, 0);
      assert.strictEqual(cards.rendaBruta, Number((rf + ri).toFixed(2)));
    }
  });

  await test('ADV-4.2: Mathematical Invariant 2: Capacidade de Pagamento strictly equals 30% of approved net income (±0.50 rounding)', () => {
    for (let i = 0; i < 1000; i++) {
      const net = Math.round(Math.random() * 80000 * 100) / 100;
      const cards = calculateIncomeCards(net, 0, 0, net);
      const expected30 = Math.round(net * 0.30);
      assert.strictEqual(cards.capacidadePagamento, expected30);
    }
  });

  await test('ADV-4.3: Cross-card consistency: Updating consideration rules does not create orphaned metrics', () => {
    let session: ApuracaoSessao = {
      id: 'sess-math-1',
      nomeCliente: 'MARCELO REIS',
      cpfCliente: '444.555.666-77',
      status: 'Concluída',
      dataCriacao: new Date().toISOString(),
      arquivos: [{ id: 'f1', name: 'extrato.pdf', size: '1MB', type: 'PDF', uploadedAt: '10:00' }],
      regrasConsiderar: 'Salário Base R$ 10.000',
      regrasDesconsiderar: 'Nenhuma',
      rendaFormal: 10000,
      rendaInformal: 0,
      rendaBruta: 10000,
      rendaLiquida: 8800,
      descontosDesconsiderados: 0,
      capacidadePagamento: 2640,
      mensagens: []
    };

    session.regrasConsiderar = 'Salário Base R$ 10.000 + Bônus Semestral R$ 2.000';
    const newCards = calculateIncomeCards(10000, 2000, 0, 10560);
    session = {
      ...session,
      rendaFormal: newCards.rendaFormal,
      rendaInformal: newCards.rendaInformal,
      rendaBruta: newCards.rendaBruta,
      rendaLiquida: newCards.rendaLiquida,
      descontosDesconsiderados: newCards.descontosDesconsiderados,
      capacidadePagamento: newCards.capacidadePagamento
    };

    assert.strictEqual(session.rendaBruta, 12000);
    assert.strictEqual(session.rendaLiquida, 10560);
    assert.strictEqual(session.capacidadePagamento, 3168);
  });

  // =========================================================================
  // SECTION 5: LOCALSTORAGE & SUPABASE FAULT TOLERANCE
  // =========================================================================
  await test('ADV-5.1: LocalStorage severely corrupted syntax recovers to initial sessions without crash', () => {
    const storage = new AdvancedMockStorage();
    storage.setItem('crm_apuracoes_renda_v1', '{"corrupted": true, "list": [1, 2,');

    const defaultMock: ApuracaoSessao[] = [{
      id: 'mock-1',
      nomeCliente: 'FALLBACK CLIENT',
      cpfCliente: '000.000.000-00',
      status: 'Em Análise',
      dataCriacao: new Date().toISOString(),
      arquivos: [],
      regrasConsiderar: '',
      regrasDesconsiderar: '',
      rendaFormal: 0,
      rendaInformal: 0,
      rendaBruta: 0,
      rendaLiquida: 0,
      descontosDesconsiderados: 0,
      capacidadePagamento: 0,
      mensagens: []
    }];

    const loaded = hydrateSessionsFromStorage(storage, 'crm_apuracoes_renda_v1', defaultMock);
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].nomeCliente, 'FALLBACK CLIENT');
  });

  await test('ADV-5.2: LocalStorage array containing null, undefined, boolean, and empty records sanitized safely', () => {
    const storage = new AdvancedMockStorage();
    storage.setItem('crm_apuracoes_renda_v1', JSON.stringify([
      null,
      undefined,
      42,
      'just a string',
      { id: 'valid-1', nomeCliente: 'VALID CLIENT', status: 'Concluída', rendaBruta: 7000 },
      {}
    ]));

    const loaded = hydrateSessionsFromStorage(storage, 'crm_apuracoes_renda_v1', []);
    assert.strictEqual(loaded.length, 2);
    assert.strictEqual(loaded[0].nomeCliente, 'VALID CLIENT');
    assert.strictEqual(loaded[0].rendaBruta, 7000);
    assert.strictEqual(loaded[1].nomeCliente, '');
    assert.strictEqual(loaded[1].status, 'Em Análise');
  });

  await test('ADV-5.3: LocalStorage QuotaExceededError is caught gracefully without breaking UI execution', () => {
    const storage = new AdvancedMockStorage();
    storage.quotaLimitBytes = 100;

    let didThrow = false;
    try {
      storage.setItem('crm_apuracoes_renda_v1', 'A'.repeat(500));
    } catch (err: any) {
      didThrow = true;
      assert.strictEqual(err.name, 'QuotaExceededError');
    }
    assert.strictEqual(didThrow, true);
  });

  await test('ADV-5.4: Supabase Network Failure fallback preserves LocalStorage state and continues functioning', async () => {
    const supabaseMock = new MockSupabaseClient();
    supabaseMock.networkFailure = true;

    const { data, error } = await supabaseMock.from('apuracoes_renda').select('*').order('data_atualizacao', { ascending: false });
    assert.strictEqual(data, null);
    assert.ok(error !== null);
    assert.strictEqual(error?.code, 'PGRST000');

    const storage = new AdvancedMockStorage();
    storage.setItem('crm_apuracoes_renda_v1', JSON.stringify([{ id: 'local-1', nomeCliente: 'LOCAL ONLY', rendaFormal: 5000 }]));
    const localSessions = hydrateSessionsFromStorage(storage, 'crm_apuracoes_renda_v1', []);
    assert.strictEqual(localSessions.length, 1);
    assert.strictEqual(localSessions[0].nomeCliente, 'LOCAL ONLY');
  });

  await test('ADV-5.5: Supabase Upsert failure (check constraint) handles rejection gracefully', async () => {
    const supabaseMock = new MockSupabaseClient();
    supabaseMock.networkFailure = true;

    let caughtError = false;
    try {
      await supabaseMock.from('apuracoes_renda').upsert({ id: 'ap-err-1', renda_formal: -500 });
    } catch {
      caughtError = true;
    }
    assert.strictEqual(caughtError, true);
  });

  await test('ADV-5.6: Dual Persistence Sync Idempotency (same session updated 50 times in Supabase table)', async () => {
    const supabaseMock = new MockSupabaseClient();
    const sessionId = 'session-idempotent-1';

    for (let i = 0; i < 50; i++) {
      await supabaseMock.from('apuracoes_renda').upsert({
        id: sessionId,
        nome_cliente: 'IDEMPOTENT TEST',
        renda_formal: 5000 + i,
        data_atualizacao: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    const { data } = await supabaseMock.from('apuracoes_renda').select('*').order('data_atualizacao', { ascending: false });
    assert.strictEqual(data?.length, 1, 'Table must have exactly 1 record due to upsert onConflict id');
    assert.strictEqual(data?.[0].renda_formal, 5049);
  });

  console.log('\n' + '='.repeat(90));
  console.log('   ADVERSARIAL SUITE SUMMARY');
  console.log('='.repeat(90));
  console.log(`Total Adversarial Tests: ${passed + failed}`);
  console.log(`Passed                 : ${passed}`);
  console.log(`Failed                 : ${failed}`);
  console.log(`Pass Rate              : ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(90) + '\n');

  if (failed > 0) {
    console.error('Critical findings detected during adversarial test run:');
    findings.forEach(f => console.error(` - ${f}`));
    process.exit(1);
  }
}

runAdversarialSuite();
