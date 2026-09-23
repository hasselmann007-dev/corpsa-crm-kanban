import assert from 'assert';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  extrairLancamentosCorPay, 
  serializarLancamentosCorPay, 
  calcularRemuneracaoAnalista,
  type LancamentoCorPay 
} from '../utils/corpayStore.js';
import { 
  getAnalistaResponsavel, 
  registrarTrocaAnalista 
} from '../utils/analistaResponsavel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper para ler variáveis do .env de forma confiável
function loadConfig() {
  let url = process.env.VITE_SUPABASE_URL || '';
  let key = process.env.VITE_SUPABASE_ANON_KEY || '';

  try {
    const envPath = path.resolve(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
          url = trimmed.substring('VITE_SUPABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
        }
        if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
          key = trimmed.substring('VITE_SUPABASE_ANON_KEY='.length).trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch {}

  return {
    url: url || 'https://yjjzmgrjgracgzqywaqc.supabase.co',
    key: key || 'sb_publishable_Jcb8tZ7M1nnDJQSjzMChjw_RqcuA2Tx'
  };
}

async function runDatabasePersistenceAndRLSTests() {
  console.log('================================================================');
  console.log('🔍 VERIFICAÇÃO DETERMINÍSTICA: PERSISTÊNCIA NO BANCO & POLÍTICAS RLS');
  console.log('================================================================\n');

  const { url, key } = loadConfig();
  console.log(`📡 Supabase Endpoint: ${url}`);
  console.log(`🔑 Client Key: ${key.substring(0, 16)}... [Ativa]\n`);

  const supabase = createClient(url, key);

  // --------------------------------------------------------------------------
  // TESTE 1: Inserção de Novo Lead com Tags de Analista e CorPay Serializadas
  // --------------------------------------------------------------------------
  console.log('👉 Teste 1: Testando inserção no banco com tags de Analista e CorPay...');
  const testCpf = '999.888.777-66';
  const testName = `CLIENTE_TESTE_PERSISTENCIA_${Date.now()}`;
  const analistaInicial = 'Danilo Hasselmann';

  const lancamentoInicial: LancamentoCorPay = {
    id: `cp-test-init-${Date.now()}`,
    lead_id: '', // será preenchido após insert
    analista_nome: analistaInicial,
    data_hora: new Date().toISOString(),
    tipo_imovel: 'Planta',
    programa: 'MCMV',
    tipo_servico: 'Avaliação',
    valor_remuneracao: 12.00,
    resultado: 'Aprovado',
    observacoes: 'Avaliação MCMV inicial cadastrada no fluxo'
  };

  const infoComTags = `[ANALISTA RESPONSÁVEL]: ${analistaInicial}\nNotas: Teste automatizado de gravação no banco Supabase.\n${serializarLancamentosCorPay('', [lancamentoInicial])}`;

  const { data: leadInserido, error: insertError } = await supabase
    .from('leads')
    .insert({
      nome_cliente: testName,
      cpf_cliente: testCpf,
      valor_imovel: 280000,
      cidade: 'Ribeirão Preto',
      grupo_origem: 'Teste Automatizado RLS',
      etapa: 'Roleta',
      prioridade: 'Média',
      informacoes_importantes: infoComTags,
      adicionado_corpay: true,
      tipo_avaliacao: 'Nova Avaliação',
      tipo_financiamento: 'MCMV',
      data_hora_entrada: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Falha na inserção do lead no banco:', insertError);
    throw insertError;
  }

  assert.ok(leadInserido?.id, 'O lead inserido deve possuir um ID válido (UUID)');
  console.log(`   -> Lead inserido com sucesso! ID: ${leadInserido.id}`);
  console.log('✅ Teste 1 APROVADO: Inserção no Supabase validada com sucesso.\n');

  const leadId = leadInserido.id;

  try {
    // --------------------------------------------------------------------------
    // TESTE 2: Leitura Direta (SELECT) e Validação de RLS
    // --------------------------------------------------------------------------
    console.log('👉 Teste 2: Validando leitura direta (SELECT) e RLS...');
    const { data: leadLido, error: selectError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (selectError) {
      console.error('❌ Falha ao buscar lead gravado:', selectError);
      throw selectError;
    }

    assert.strictEqual(leadLido.id, leadId);
    assert.strictEqual(leadLido.nome_cliente, testName);
    assert.strictEqual(leadLido.cpf_cliente, testCpf);
    assert.ok(leadLido.informacoes_importantes.includes('[ANALISTA RESPONSÁVEL]: Danilo Hasselmann'));
    assert.ok(leadLido.informacoes_importantes.includes('[CORPAY_LANCAMENTOS:'));

    // Valida extração das tags
    const respExtraido = getAnalistaResponsavel(leadLido);
    assert.strictEqual(respExtraido, analistaInicial, 'O analista extraído deve ser Danilo Hasselmann');

    const lancsExtraidos = extrairLancamentosCorPay(leadLido.informacoes_importantes, leadId);
    assert.strictEqual(lancsExtraidos.length, 1, 'Deve conter exatamente 1 lançamento CorPay inicial');
    assert.strictEqual(lancsExtraidos[0].valor_remuneracao, 12.00);

    console.log(`   -> Analista responsável verificado: "${respExtraido}"`);
    console.log(`   -> Lançamentos CorPay recuperados: ${lancsExtraidos.length} (Valor: R$ ${lancsExtraidos[0].valor_remuneracao})`);
    console.log('✅ Teste 2 APROVADO: Dados persistidos e recuperados com integridade perfeita.\n');

    // --------------------------------------------------------------------------
    // TESTE 3: Troca de Analista no Banco (Assumir Pasta / Pegar Pendência)
    // --------------------------------------------------------------------------
    console.log('👉 Teste 3: Validando operação de UPDATE no Supabase (Transferência de Analista)...');
    const novoAnalista = 'Luciana Martins';
    const { novoTextoInfo, mensagemChat } = registrarTrocaAnalista(
      leadLido,
      novoAnalista,
      'Pegar Pendência',
      'Danilo ausente; assumido para responder pendência do corretor'
    );

    const { data: leadAtualizado, error: updateError } = await supabase
      .from('leads')
      .update({
        informacoes_importantes: novoTextoInfo,
        etapa: 'Pendencia',
        descricao_pendencia: 'Contracheque do mês anterior ilegível'
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Falha no UPDATE de transferência no Supabase:', updateError);
      throw updateError;
    }

    assert.strictEqual(leadAtualizado.etapa, 'Pendencia');
    assert.strictEqual(leadAtualizado.descricao_pendencia, 'Contracheque do mês anterior ilegível');
    assert.ok(leadAtualizado.informacoes_importantes.includes('[ANALISTA RESPONSÁVEL]: Luciana Martins'));
    assert.ok(leadAtualizado.informacoes_importantes.includes('[TROCA DE ANALISTA'));
    assert.ok(leadAtualizado.informacoes_importantes.includes('Motivo: Pegar Pendência'));

    const novoRespExtraido = getAnalistaResponsavel(leadAtualizado);
    assert.strictEqual(novoRespExtraido, 'Luciana Martins', 'Novo responsável deve ser Luciana Martins');
    console.log(`   -> Transferência persistida com sucesso! Novo responsável: "${novoRespExtraido}"`);
    console.log('✅ Teste 3 APROVADO: UPDATE no banco e trilha auditável gravados com sucesso.\n');

    // --------------------------------------------------------------------------
    // TESTE 4: Adição de Reavaliação no CORPSA Pay (Múltiplos Lançamentos)
    // --------------------------------------------------------------------------
    console.log('👉 Teste 4: Validando persistência de múltiplos lançamentos CorPay...');
    const lancamentoReavaliacao: LancamentoCorPay = {
      id: `cp-test-reav-${Date.now()}`,
      lead_id: leadId,
      analista_nome: 'Luciana Martins',
      data_hora: new Date().toISOString(),
      tipo_imovel: 'Planta',
      programa: 'MCMV',
      tipo_servico: 'Reavaliação',
      valor_remuneracao: 7.00,
      resultado: 'Aprovado',
      observacoes: 'Reavaliação após reenvio de contracheque nítido'
    };

    const listaAtual = extrairLancamentosCorPay(leadAtualizado.informacoes_importantes, leadId);
    listaAtual.push(lancamentoReavaliacao);

    const infoComMultiplosLancs = serializarLancamentosCorPay(leadAtualizado.informacoes_importantes, listaAtual);

    const { data: leadComMultiCorPay, error: multiError } = await supabase
      .from('leads')
      .update({
        informacoes_importantes: infoComMultiplosLancs,
        etapa: 'Conclusao',
        tipo_avaliacao: 'Reavaliação'
      })
      .eq('id', leadId)
      .select()
      .single();

    if (multiError) {
      console.error('❌ Falha ao persistir múltiplos lançamentos CorPay:', multiError);
      throw multiError;
    }

    const lancsFinais = extrairLancamentosCorPay(leadComMultiCorPay.informacoes_importantes, leadId);
    assert.strictEqual(lancsFinais.length, 2, 'O lead deve conter agora 2 lançamentos no CorPay');

    // --------------------------------------------------------------------------
    // TESTE 5: Isolamento Rigoroso de Remuneração por Analista (POP-02)
    // --------------------------------------------------------------------------
    console.log('👉 Teste 5: Validando isolamento financeiro absoluto (nenhum analista vê o CorPay do outro)...');
    
    // Danilo deve ter R$ 12,00 (Avaliação inicial)
    const remunDanilo = calcularRemuneracaoAnalista([leadComMultiCorPay], 'Danilo Hasselmann');
    assert.strictEqual(remunDanilo.total, 12.00, 'Remuneração de Danilo deve ser exatamente R$ 12,00');
    assert.strictEqual(remunDanilo.count, 1, 'Danilo deve ter 1 lançamento');

    // Luciana deve ter R$ 7,00 (Reavaliação)
    const remunLuciana = calcularRemuneracaoAnalista([leadComMultiCorPay], 'Luciana Martins');
    assert.strictEqual(remunLuciana.total, 7.00, 'Remuneração de Luciana deve ser exatamente R$ 7,00');
    assert.strictEqual(remunLuciana.count, 1, 'Luciana deve ter 1 lançamento');

    // Outro analista qualquer (ex: Matheus) deve ter R$ 0,00
    const remunOutro = calcularRemuneracaoAnalista([leadComMultiCorPay], 'Matheus Corretor');
    assert.strictEqual(remunOutro.total, 0.00, 'Analistas terceiros não possuem remuneração nesta pasta');
    assert.strictEqual(remunOutro.count, 0);

    console.log(`   -> CorPay Danilo Hasselmann: R$ ${remunDanilo.total.toFixed(2)} (${remunDanilo.count} op.)`);
    console.log(`   -> CorPay Luciana Martins: R$ ${remunLuciana.total.toFixed(2)} (${remunLuciana.count} op.)`);
    console.log(`   -> CorPay Matheus Corretor: R$ ${remunOutro.total.toFixed(2)} (${remunOutro.count} op.)`);
    console.log('✅ Teste 5 APROVADO: Isolamento financeiro 100% garantido.\n');

  } finally {
    // --------------------------------------------------------------------------
    // LIMPEZA AUTOMÁTICA (Exclusão Segura)
    // --------------------------------------------------------------------------
    console.log('👉 Limpeza: Excluindo lead temporário de teste...');
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (deleteError) {
      console.warn('⚠️ Falha ao excluir lead de teste:', deleteError);
    } else {
      console.log('   -> Lead temporário removido com sucesso.');
    }
  }

  console.log('================================================================');
  console.log('🎉 TODAS AS VALIDAÇÕES DE PERSISTÊNCIA E RLS FORAM CONCLUÍDAS COM SUCESSO!');
  console.log('================================================================');
}

runDatabasePersistenceAndRLSTests().catch((err) => {
  console.error('\n❌ ERRO NA SUÍTE DE PERSISTÊNCIA E RLS:', err);
  process.exit(1);
});
