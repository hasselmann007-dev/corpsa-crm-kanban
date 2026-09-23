import assert from 'assert';
import { 
  consultarDadosClienteCrm, 
  gerarHtmlDocumentoSimulacao, 
  limparCpf, 
  formatarCpf 
} from '../../tools/crmConsultaTool.js';
import { supabase } from '../supabaseClient.js';

async function runSimulatorAttachmentTests() {
  console.log('================================================================');
  console.log('🚀 TESTE AUTOMATIZADO: CONSULTA CRM & ANEXO DO SIMULADOR CAIXA');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TESTE 1: Formatação e Limpeza de CPF
  // --------------------------------------------------------------------------
  console.log('👉 Teste 1: Validação das funções utilitárias de CPF...');
  assert.strictEqual(limparCpf('298.112.443-10'), '29811244310');
  assert.strictEqual(formatarCpf('29811244310'), '298.112.443-10');
  console.log('✅ Teste 1 APROVADO: Normalização de CPF operacional.\n');

  // --------------------------------------------------------------------------
  // TESTE 2: Geração do Documento HTML (.doc) do Simulador Caixa
  // --------------------------------------------------------------------------
  console.log('👉 Teste 2: Geração de HTML oficial do Simulador Caixa...');
  const htmlMock = gerarHtmlDocumentoSimulacao({
    cliente: 'ROBERTO SILVA TESTE',
    cpf: '298.112.443-10',
    valor_imovel: 320000,
    valor_financiamento: 256000,
    valor_entrada: 64000,
    prazo_meses: 420,
    sistema_amortizacao: 'PRICE',
    taxa_juros_nominal: '9.50',
    taxa_juros_efetiva: '9.92',
    primeira_prestacao: 2150.40,
    programa: 'SBPE',
    tipo_imovel: 'Novo',
    analista_responsavel: 'Danilo Hasselmann'
  });

  assert.ok(htmlMock.includes('ROBERTO SILVA TESTE'), 'Deve conter nome do cliente');
  assert.ok(htmlMock.includes('298.112.443-10'), 'Deve conter CPF');
  assert.ok(htmlMock.includes('R$ 256.000,00') || htmlMock.includes('256.000'), 'Deve conter valor financiado formatado');
  assert.ok(htmlMock.includes('PRICE'), 'Deve conter sistema de amortização');
  assert.ok(htmlMock.includes('CORPSA'), 'Deve conter cabeçalho da CORPSA');
  console.log('✅ Teste 2 APROVADO: Documento oficial da simulação gerado com sucesso.\n');

  // --------------------------------------------------------------------------
  // TESTE 3: Criação de Lead de Teste com Simulação Aprovada no Supabase
  // --------------------------------------------------------------------------
  console.log('👉 Teste 3: Testando lead APROVADO com simulação anexada...');
  const testCpfAprovado = `777${Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8)}`;
  const formattedCpfAprovado = formatarCpf(testCpfAprovado);

  const mockFichaCaixa = {
    valor_imovel: 300000,
    valor_financiamento: 240000,
    valor_entrada: 60000,
    prazo_meses: 420,
    sistema_amortizacao: 'SAC',
    taxa_juros_nominal: '8.90',
    taxa_juros_efetiva: '9.28',
    primeira_prestacao: 2050.00,
    programa: 'MCMV',
    tipo_imovel: 'Planta',
    analista_responsavel: 'Danilo Hasselmann'
  };

  const { data: createdLead, error: insertError } = await supabase
    .from('leads')
    .insert([
      {
        nome_cliente: 'TESTE CLIENTE APROVADO SIMULADOR',
        cpf_cliente: formattedCpfAprovado,
        valor_imovel: 300000,
        etapa: 'Conclusao',
        resultado_analise: 'Aprovado',
        motivo_resultado: 'Crédito imobiliário Caixa aprovado com subsídio integral.',
        cidade: 'Ribeirão Preto',
        grupo_origem: 'Corretor Parceiro',
        informacoes_importantes: `Lead de validação automática.\n[SIMULACAO_CAIXA: ${JSON.stringify(mockFichaCaixa)}]`
      }
    ])
    .select()
    .single();

  if (insertError) {
    console.warn('   ⚠️ Não foi possível inserir lead de teste no Supabase (verifique permissões/rede):', insertError.message);
  } else {
    console.log(`   -> Lead de teste inserido com ID ${createdLead.id} e CPF ${formattedCpfAprovado}`);
  }

  // Consulta por CPF
  const dossieAprovado = await consultarDadosClienteCrm(formattedCpfAprovado);
  console.log('   -> Dossie Encontrado:', dossieAprovado.encontrado);
  console.log('   -> Tem Simulador:', dossieAprovado.temSimulador);
  if (dossieAprovado.simuladorAnexo) {
    console.log('   -> Anexo Nome:', dossieAprovado.simuladorAnexo.name);
    console.log('   -> Anexo Tipo:', dossieAprovado.simuladorAnexo.type);
    console.log('   -> Anexo URL inicial:', dossieAprovado.simuladorAnexo.url.substring(0, 45) + '...');
  }

  assert.strictEqual(dossieAprovado.encontrado, true, 'Lead aprovado deve ser encontrado na base');
  assert.strictEqual(dossieAprovado.temSimulador, true, 'Lead aprovado deve ter simulador gerado');
  assert.ok(dossieAprovado.simuladorAnexo, 'Dossie deve conter objeto simuladorAnexo');
  assert.strictEqual(dossieAprovado.simuladorAnexo?.type, 'pdf', 'Tipo do anexo deve ser pdf/doc oficial');
  assert.ok(dossieAprovado.simuladorAnexo?.name.endsWith('.doc'), 'Nome do anexo deve terminar com .doc');
  assert.ok(dossieAprovado.simuladorAnexo?.url.startsWith('data:application/msword'), 'URL do anexo deve ser um Data URL com encoding word/html');
  assert.ok(/simulador.*anexad/i.test(dossieAprovado.mensagemFormatada), 'Mensagem formatada deve avisar sobre o anexo do simulador');
  console.log('✅ Teste 3 APROVADO: Lead aprovado extrai simulador e gera anexo para o chat.\n');

  // Limpa o lead criado
  if (createdLead?.id) {
    await supabase.from('leads').delete().eq('id', createdLead.id);
    console.log('   -> Lead de teste limpo com sucesso.');
  }

  // --------------------------------------------------------------------------
  // TESTE 4: Testando Lead em PENDÊNCIA (Sem simulador, com descrição de pendência)
  // --------------------------------------------------------------------------
  console.log('👉 Teste 4: Testando lead em PENDÊNCIA...');
  const testCpfPendencia = `888${Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8)}`;
  const formattedCpfPendencia = formatarCpf(testCpfPendencia);

  const { data: leadPendencia, error: insertPendenciaErr } = await supabase
    .from('leads')
    .insert([
      {
        nome_cliente: 'TESTE CLIENTE COM PENDENCIA',
        cpf_cliente: formattedCpfPendencia,
        valor_imovel: 220000,
        etapa: 'Pendencia',
        descricao_pendencia: 'Falta extrato bancário dos últimos 3 meses e certidão de nascimento legível.',
        motivo_resultado: 'Documentação pendente para aprovação Caixa.',
        cidade: 'Sertãozinho',
        grupo_origem: 'Imobiliária Modelo',
        informacoes_importantes: 'Pendência aberta pelo analista.'
      }
    ])
    .select()
    .single();

  if (insertPendenciaErr) {
    console.warn('   ⚠️ Erro ao inserir lead de pendência:', insertPendenciaErr.message);
  } else {
    console.log(`   -> Lead de pendência inserido com ID ${leadPendencia.id}`);
  }

  const dossiePendencia = await consultarDadosClienteCrm(formattedCpfPendencia);
  console.log('   -> Dossie Pendência Encontrado:', dossiePendencia.encontrado);
  console.log('   -> Tem Simulador:', dossiePendencia.temSimulador);
  console.log('   -> Detalhe Pendência:', dossiePendencia.descricao_detalhamento_pendencia);

  assert.strictEqual(dossiePendencia.encontrado, true, 'Lead de pendência deve ser encontrado');
  assert.strictEqual(dossiePendencia.temSimulador, false, 'Lead com pendência não deve ter simulador');
  assert.ok(dossiePendencia.descricao_detalhamento_pendencia.includes('extrato bancário'), 'Deve detalhar a pendência apontada pelo analista');
  console.log('✅ Teste 4 APROVADO: Pasta com pendência orienta o corretor sem anexar simulação indevida.\n');

  if (leadPendencia?.id) {
    await supabase.from('leads').delete().eq('id', leadPendencia.id);
  }

  // --------------------------------------------------------------------------
  // TESTE 5: Testando Consulta de CPF Inexistente na Base
  // --------------------------------------------------------------------------
  console.log('👉 Teste 5: Testando CPF inexistente na base...');
  const dossieInexistente = await consultarDadosClienteCrm('000.111.222-33');
  assert.ok(dossieInexistente.mensagemFormatada.toLowerCase().includes('não localizei nenhuma pasta'), 'Deve orientar cordialmente o corretor');
  console.log('✅ Teste 5 APROVADO: Resposta cordial para clientes fora da base.\n');

  console.log('================================================================');
  console.log('🎉 TODOS OS TESTES DE CONSULTA & SIMULADOR FORAM CONCLUÍDOS COM SUCESSO!');
  console.log('================================================================');
}

runSimulatorAttachmentTests().catch((err) => {
  console.error('\n❌ ERRO NO TESTE DE ANEXO DO SIMULADOR:', err);
  process.exit(1);
});
