import assert from 'assert';
import { consultarObsidianNormas } from '../../tools/obsidianNormasTool.js';
import { consultarDadosClienteCrm } from '../../tools/crmConsultaTool.js';

async function runObsidianAndCrmToolTests() {
  console.log('================================================================');
  console.log('📚 TESTE DETERMINÍSTICO: OBSIDIAN (@Normas) & CONSULTA CRM');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TESTE 1: Leitura do Cofre Obsidian (@Normas) - Tópico INSS
  // --------------------------------------------------------------------------
  console.log('👉 Teste 1: Consultando Obsidian (@Normas) sobre "INSS"...');
  const inssResult = consultarObsidianNormas('benefícios INSS aceitos e vedados');
  assert.ok(inssResult.length > 50, 'Resultado sobre INSS não deve ser vazio');
  assert.ok(inssResult.toLowerCase().includes('inss'), 'Deve conter referências a INSS');
  console.log(`   -> Resposta encontrada (${inssResult.length} caracteres)`);
  console.log(`   -> Trecho: "${inssResult.substring(0, 140).replace(/\n/g, ' ')}..."`);
  console.log('✅ Teste 1 APROVADO: Acervo Obsidian lido com sucesso.\n');

  // --------------------------------------------------------------------------
  // TESTE 2: Consulta Obsidian - Tópico IRPF 2026
  // --------------------------------------------------------------------------
  console.log('👉 Teste 2: Consultando Obsidian (@Normas) sobre "IRPF 2026"...');
  const irpfResult = consultarObsidianNormas('regras IRPF 2026');
  assert.ok(irpfResult.length > 50, 'Resultado sobre IRPF 2026 não deve ser vazio');
  assert.ok(irpfResult.toLowerCase().includes('irpf') || irpfResult.toLowerCase().includes('renda'), 'Deve conter referências a IRPF ou renda');
  console.log(`   -> Resposta encontrada (${irpfResult.length} caracteres)`);
  console.log('✅ Teste 2 APROVADO: Regras de IRPF recuperadas do Obsidian.\n');

  // --------------------------------------------------------------------------
  // TESTE 3: Consulta Obsidian - Procedimento Uber / Motorista de Aplicativo
  // --------------------------------------------------------------------------
  console.log('👉 Teste 3: Consultando Obsidian (@Normas) sobre "Motorista de Aplicativo Uber"...');
  const uberResult = consultarObsidianNormas('procedimento motorista uber');
  assert.ok(uberResult.length > 50, 'Resultado sobre motorista de aplicativo não deve ser vazio');
  console.log(`   -> Resposta encontrada (${uberResult.length} caracteres)`);
  console.log('✅ Teste 3 APROVADO: Procedimentos de comprovação de renda recuperados.\n');

  // --------------------------------------------------------------------------
  // TESTE 4: Consulta CRM dos 4 Blocos Regulamentares
  // --------------------------------------------------------------------------
  console.log('👉 Teste 4: Consultando dados de cliente no CRM via crmConsultaTool...');
  // Busca qualquer lead existente ou proponente
  const crmResult = await consultarDadosClienteCrm('PLANTA');
  console.log('   -> Sucesso:', crmResult.sucesso);
  console.log('   -> Mensagem formatada:\n', crmResult.mensagemFormatada);

  assert.ok(crmResult.mensagemFormatada.includes('1. Observações Operacionais & Dados da Triagem'), 'Deve conter Bloco 1');
  assert.ok(crmResult.mensagemFormatada.includes('2. Descrição e Detalhamento da Pendência'), 'Deve conter Bloco 2');
  assert.ok(crmResult.mensagemFormatada.includes('3. Parecer Oficial do Analista de Crédito'), 'Deve conter Bloco 3');
  assert.ok(crmResult.mensagemFormatada.includes('4. Considerações Finais & Instruções para Contrato'), 'Deve conter Bloco 4');
  console.log('✅ Teste 4 APROVADO: Os 4 blocos regulamentares foram extraídos e formatados com exatidão.\n');

  console.log('================================================================');
  console.log('🎉 TODOS OS TESTES DO OBSIDIAN E FERRAMENTAS CRM FORAM APROVADOS!');
  console.log('================================================================');
}

runObsidianAndCrmToolTests().catch((err) => {
  console.error('\n❌ ERRO NOS TESTES DO OBSIDIAN E CRM:', err);
  process.exit(1);
});
