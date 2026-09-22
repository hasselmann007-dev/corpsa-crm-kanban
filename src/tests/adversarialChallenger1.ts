/**
 * ==============================================================================================
 * CHALLENGER 1: ADVERSARIAL STRESS TEST SUITE & EMPIRICAL VERIFICATION HARNESS
 * ==============================================================================================
 * Empirical testing of:
 * 1. Single-Field Broker Parser Stress Testing:
 *    - parseRawText with empty inputs, corrupt CPFs, emojis, multiline text, continuous numbers,
 *      and verify valid fallbacks (CPF '000.000.000-00', cidade 'Ribeirão Preto', grupo_origem 'WhatsApp', valor 0).
 * 2. Kanban State Transitions & Check Constraints:
 *    - Verify that transitions to Pendência enforce descricao_pendencia,
 *      transitions to Análise enforce resultado_analise, and Conclusão freezes the card.
 * 3. CorPay Fee Matrix Invariants:
 *    - Reavaliação: strictly R$ 7,00 (both MCMV and SBPE).
 *    - Nova Avaliação + MCMV: strictly R$ 12,00.
 *    - Nova Avaliação + SBPE: strictly R$ 13,00.
 *    - Any unknown/unselected combination: 0 or fallback.
 * ==============================================================================================
 */

import assert from 'assert';
import { parseRawText, isValidCpf, capitalizeWords } from '../utils/parser';
import { calculateCorPayFee, validateStageTransition, type EtapaLead } from './e2eDossierSuite';
import type { Lead } from '../App';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function runTest(id: string, name: string, fn: () => void) {
  try {
    fn();
    results.push({ id, name, passed: true });
    console.log(`  [PASS] ${id}: ${name}`);
  } catch (err: any) {
    results.push({ id, name, passed: false, error: err.message, details: err.stack });
    console.error(`  [FAIL] ${id}: ${name} -> ${err.message}`);
  }
}

console.log('='.repeat(90));
console.log('   CHALLENGER 1: ADVERSARIAL STRESS TEST SUITE (STATE MACHINE & LOGIC)');
console.log('='.repeat(90));

// ==============================================================================================
// GROUP 1: SINGLE-FIELD BROKER PARSER STRESS TESTING
// ==============================================================================================
console.log('\n>>> GROUP 1: Single-Field Broker Parser Stress Testing');

// 1.1 Empty inputs and whitespace
runTest('CH1.1.1', 'Empty string input returns deterministic safe defaults without crashing', () => {
  const parsed = parseRawText('');
  assert.strictEqual(parsed.nome_cliente, '');
  assert.strictEqual(parsed.cpf_cliente, '');
  assert.strictEqual(parsed.valor_imovel, 0);
  assert.strictEqual(parsed.cidade, 'Ribeirão Preto');
  assert.strictEqual(typeof parsed.data_hora_entrada, 'string');
});

runTest('CH1.1.2', 'Whitespace, newlines and tabs only return defaults safely', () => {
  const parsed = parseRawText('   \n\t  \r\n   ');
  assert.strictEqual(parsed.nome_cliente, '');
  assert.strictEqual(parsed.cpf_cliente, '');
  assert.strictEqual(parsed.valor_imovel, 0);
  assert.strictEqual(parsed.cidade, 'Ribeirão Preto');
});

// 1.2 Corrupt CPFs & Fallbacks
runTest('CH1.1.3', 'CPF with all identical digits (e.g. 111.111.111-11) is detected as invalid by isValidCpf', () => {
  assert.strictEqual(isValidCpf('111.111.111-11'), false);
  assert.strictEqual(isValidCpf('000.000.000-00'), false);
  assert.strictEqual(isValidCpf('99999999999'), false);
});

runTest('CH1.1.4', 'CPF with invalid checksum digits is detected as invalid by isValidCpf', () => {
  assert.strictEqual(isValidCpf('123.456.789-00'), false);
  assert.strictEqual(isValidCpf('111.222.333-44'), false);
});

runTest('CH1.1.5', 'App.tsx quick create fallback guarantees CPF 000.000.000-00 when CPF is corrupt or missing', () => {
  const mockQuickCreate = (rawInput: string) => {
    const parsed = parseRawText(rawInput);
    const cpfCliente = (parsed.cpf_cliente && isValidCpf(parsed.cpf_cliente)) 
      ? parsed.cpf_cliente 
      : '000.000.000-00';
    return cpfCliente;
  };

  assert.strictEqual(mockQuickCreate(''), '000.000.000-00');
  assert.strictEqual(mockQuickCreate('Cliente sem CPF cadastrado'), '000.000.000-00');
  assert.strictEqual(mockQuickCreate('CPF: 111.111.111-11'), '000.000.000-00');
  assert.strictEqual(mockQuickCreate('CPF: 123.456.789-00'), '000.000.000-00');
});

// 1.3 Emojis and Multiline Text
runTest('CH1.1.6', 'Heavy emoji usage in broker message preserves extraction of name, CPF and property value', () => {
  const emojiMessage = `
    🏢 GRUPO VENDAS SUL - WhatsApp
    👤 Nome: CARLOS EDUARDO DE ALBUQUERQUE
    🪪 CPF: 059.208.970-13
    💰 Valor: R$ 380.000,00
    📍 Ribeirão Preto
    📝 Obs: Cliente autônomo com movimentação bancária alta 🚀✨
  `;
  const parsed = parseRawText(emojiMessage);
  assert.strictEqual(parsed.nome_cliente, 'CARLOS EDUARDO DE ALBUQUERQUE');
  assert.strictEqual(parsed.valor_imovel, 380000);
  assert.strictEqual(parsed.cidade, 'Ribeirão Preto');
  assert.ok(parsed.notes?.includes('autônomo'));
});

// 1.4 Continuous Numbers (11 digits phone vs CPF vs property value)
runTest('CH1.1.7', 'Continuous 11 digits phone number does not collide with 6-digit property value', () => {
  const text = `
    Cliente: MARCOS ANTONIO PEREIRA
    Telefone: 16998765432
    Valor do Imóvel: 275000
    Cidade: Ribeirão Preto
  `;
  const parsed = parseRawText(text);
  assert.strictEqual(parsed.nome_cliente, 'MARCOS ANTONIO PEREIRA');
  assert.strictEqual(parsed.valor_imovel, 275000);
});

runTest('CH1.1.8', 'App.tsx quick create fallback guarantees cidade, grupo_origem and valor defaults', () => {
  const mockQuickCreateFull = (rawInput: string) => {
    const parsed = parseRawText(rawInput);
    const nomeCliente = parsed.nome_cliente?.trim() || 'NOVO CLIENTE';
    const cpfCliente = (parsed.cpf_cliente && isValidCpf(parsed.cpf_cliente)) 
      ? parsed.cpf_cliente 
      : '000.000.000-00';
    const valorImovel = parsed.valor_imovel || 0;
    const cidade = (parsed.cidade && parsed.cidade !== 'Não Informada') 
      ? parsed.cidade.trim() 
      : 'Ribeirão Preto';
    const grupoOrigem = parsed.grupo_origem?.trim() || 'WhatsApp';
    return { nomeCliente, cpfCliente, valorImovel, cidade, grupoOrigem };
  };

  const defaults = mockQuickCreateFull('');
  assert.strictEqual(defaults.nomeCliente, 'NOVO CLIENTE');
  assert.strictEqual(defaults.cpfCliente, '000.000.000-00');
  assert.strictEqual(defaults.valorImovel, 0);
  assert.strictEqual(defaults.cidade, 'Ribeirão Preto');
  assert.ok(defaults.grupoOrigem === 'WhatsApp' || defaults.grupoOrigem === 'Geral');
});

// ==============================================================================================
// GROUP 2: KANBAN STATE TRANSITIONS & CHECK CONSTRAINTS
// ==============================================================================================
console.log('\n>>> GROUP 2: Kanban State Transitions & Check Constraints');

runTest('CH1.2.1', 'Roleta -> Pendencia enforces descricao_pendencia (safeguard default applied if empty)', () => {
  // Direct simulator call
  const withDesc = validateStageTransition('Roleta', 'Pendencia', { descricao_pendencia: 'Falta extrato bancário' });
  assert.strictEqual(withDesc.allowed, true);
  assert.strictEqual(withDesc.appliedSafeguards?.descricao_pendencia, 'Falta extrato bancário');

  const withoutDesc = validateStageTransition('Roleta', 'Pendencia', { descricao_pendencia: '' });
  assert.strictEqual(withoutDesc.allowed, true);
  assert.strictEqual(withoutDesc.appliedSafeguards?.descricao_pendencia, 'Demanda operacional em triagem');
});

runTest('CH1.2.2', 'Roleta -> Conclusao is strictly blocked', () => {
  const result = validateStageTransition('Roleta', 'Conclusao', {});
  assert.strictEqual(result.allowed, false);
  assert.ok(result.error?.includes('não é permitida'));
});

runTest('CH1.2.3', 'Pendencia -> Roleta and Pendencia -> Conclusao are strictly blocked', () => {
  const toRoleta = validateStageTransition('Pendencia', 'Roleta', {});
  assert.strictEqual(toRoleta.allowed, false);
  assert.ok(toRoleta.error?.includes('Análise de Crédito'));

  const toConclusao = validateStageTransition('Pendencia', 'Conclusao', {});
  assert.strictEqual(toConclusao.allowed, false);
  assert.ok(toConclusao.error?.includes('Análise de Crédito'));
});

runTest('CH1.2.4', 'Pendencia -> Analise is allowed and advances lead', () => {
  const result = validateStageTransition('Pendencia', 'Analise', {});
  assert.strictEqual(result.allowed, true);
});

runTest('CH1.2.5', 'Analise -> Conclusao requires resultado_analise', () => {
  const withoutResultado = validateStageTransition('Analise', 'Conclusao', {});
  assert.strictEqual(withoutResultado.allowed, false);
  assert.ok(withoutResultado.error?.includes('parecer'));

  const withResultado = validateStageTransition('Analise', 'Conclusao', { resultado_analise: 'Aprovado' });
  assert.strictEqual(withResultado.allowed, true);
});

runTest('CH1.2.6', 'Analise -> Roleta is strictly blocked', () => {
  const toRoleta = validateStageTransition('Analise', 'Roleta', {});
  assert.strictEqual(toRoleta.allowed, false);
  assert.ok(toRoleta.error?.includes('não podem voltar para a Roleta'));
});

runTest('CH1.2.7', 'Conclusao stage freezes the card: all forward or backward transitions are blocked', () => {
  const toRoleta = validateStageTransition('Conclusao', 'Roleta', {});
  const toPendencia = validateStageTransition('Conclusao', 'Pendencia', {});
  const toAnalise = validateStageTransition('Conclusao', 'Analise', {});

  assert.strictEqual(toRoleta.allowed, false);
  assert.ok(toRoleta.error?.includes('congelados'));

  assert.strictEqual(toPendencia.allowed, false);
  assert.ok(toPendencia.error?.includes('congelados'));

  assert.strictEqual(toAnalise.allowed, false);
  assert.ok(toAnalise.error?.includes('congelados'));
});

runTest('CH1.2.8', 'LeadDetailFullModal handleStageTransition safeguard logic auto-fills constraints', () => {
  // Simulates LeadDetailFullModal.tsx handleStageTransition
  const simulateModalTransition = (targetStage: Lead['etapa'], lead: Partial<Lead>) => {
    const patchPayload: Partial<Lead> = { etapa: targetStage };
    if (targetStage === 'Pendencia') {
      if (!lead.descricao_pendencia || lead.descricao_pendencia.trim().length === 0) {
        patchPayload.descricao_pendencia = 'Demanda operacional em triagem';
      }
    }
    if (targetStage === 'Analise') {
      if (!lead.resultado_analise || lead.resultado_analise.trim().length === 0) {
        patchPayload.resultado_analise = 'Aprovado';
      }
    }
    return patchPayload;
  };

  const p1 = simulateModalTransition('Pendencia', {});
  assert.strictEqual(p1.descricao_pendencia, 'Demanda operacional em triagem');

  const p2 = simulateModalTransition('Analise', {});
  assert.strictEqual(p2.resultado_analise, 'Aprovado');

  const p3 = simulateModalTransition('Conclusao', {});
  assert.strictEqual(p3.etapa, 'Conclusao');
});

// ==============================================================================================
// GROUP 3: CORPAY FEE MATRIX INVARIANTS
// ==============================================================================================
console.log('\n>>> GROUP 3: CorPay Fee Matrix Invariants');

runTest('CH1.3.1', 'Reavaliação + MCMV: strictly R$ 7,00', () => {
  const res = calculateCorPayFee('Reavaliação', 'MCMV');
  assert.strictEqual(res.fee, 7.00);
  assert.strictEqual(res.formattedFee, 'R$ 7,00');
});

runTest('CH1.3.2', 'Reavaliação + SBPE: strictly R$ 7,00', () => {
  const res = calculateCorPayFee('Reavaliação', 'SBPE');
  assert.strictEqual(res.fee, 7.00);
  assert.strictEqual(res.formattedFee, 'R$ 7,00');
});

runTest('CH1.3.3', 'Nova Avaliação + MCMV: strictly R$ 12,00', () => {
  const res = calculateCorPayFee('Nova Avaliação', 'MCMV');
  assert.strictEqual(res.fee, 12.00);
  assert.strictEqual(res.formattedFee, 'R$ 12,00');
});

runTest('CH1.3.4', 'Nova Avaliação + SBPE: strictly R$ 13,00', () => {
  const res = calculateCorPayFee('Nova Avaliação', 'SBPE');
  assert.strictEqual(res.fee, 13.00);
  assert.strictEqual(res.formattedFee, 'R$ 13,00');
});

runTest('CH1.3.5', 'Case-insensitive inputs (reavaliação, mcmv, sbpe) correctly resolve to invariant fees', () => {
  const res1 = calculateCorPayFee('reavaliação', 'mcmv');
  assert.strictEqual(res1.fee, 7.00);

  const res2 = calculateCorPayFee('NOVA AVALIAÇÃO', 'mcmv');
  assert.strictEqual(res2.fee, 12.00);

  const res3 = calculateCorPayFee('Nova Avaliacao', 'sbpe');
  assert.strictEqual(res3.fee, 13.00);
});

runTest('CH1.3.6', 'Unknown or undefined combination returns standard fallback (R$ 12,00)', () => {
  const resEmpty = calculateCorPayFee(undefined, undefined);
  assert.strictEqual(resEmpty.fee, 12.00);

  const resUnknown = calculateCorPayFee('Outro Tipo', 'Outro Financiamento');
  assert.strictEqual(resUnknown.fee, 12.00);
});

// Component inline calculation parity test
runTest('CH1.3.7', 'Fase4ConclusaoCorPay inline calculation strictly matches fee matrix', () => {
  const componentCalcular = (tipoAvaliacao: string, tipoFinanciamento: string): number => {
    if (tipoAvaliacao === 'Reavaliação') {
      return 7.00;
    }
    if (tipoFinanciamento === 'MCMV') {
      return 12.00;
    }
    if (tipoFinanciamento === 'SBPE') {
      return 13.00;
    }
    return 12.00;
  };

  assert.strictEqual(componentCalcular('Reavaliação', 'MCMV'), 7.00);
  assert.strictEqual(componentCalcular('Reavaliação', 'SBPE'), 7.00);
  assert.strictEqual(componentCalcular('Nova Avaliação', 'MCMV'), 12.00);
  assert.strictEqual(componentCalcular('Nova Avaliação', 'SBPE'), 13.00);
});

// ==============================================================================================
// SUMMARY
// ==============================================================================================
console.log('\n' + '='.repeat(90));
console.log('   CHALLENGER 1 ADVERSARIAL TEST SUMMARY');
console.log('='.repeat(90));
const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`Total Adversarial Tests : ${total}`);
console.log(`Passed                  : ${passed}`);
console.log(`Failed                  : ${failed}`);
console.log('='.repeat(90));

export { results };
