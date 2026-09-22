import assert from 'assert';
import { 
  getConsultasRapidas, 
  salvarNovaConsultaRapida, 
  responderConsultaRapida, 
  getAnalistasPresenca, 
  setAnalistaStatus 
} from '../utils/consultaRapidaStore.js';

async function runConsultaRapidaTests() {
  console.log('🧪 Iniciando Testes Unitários de Consultas Rápidas e Presença de Analistas...\n');

  // Teste 1: Criação de Consulta Rápida (sem criar card)
  console.log('Test 1: Disparo de Consulta Rápida de IRPF / Imóvel / CPF');
  const novaConsulta = await salvarNovaConsultaRapida({
    tipo_consulta: 'irpf',
    nome_cliente: 'GABRIEL MONTEIRO',
    cpf_cliente: '111.222.333-44',
    data_nascimento: '15/08/1988',
    documento_identificacao: 'RG 45.123.456-7 SSP/SP',
    detalhes_solicitacao: 'Verificar se a declaração de IRPF 2025 está processada e sem pendência de malha fina.',
    canal_origem: 'WhatsApp Corretor'
  });

  assert.strictEqual(novaConsulta.status, 'Pendente');
  assert.strictEqual(novaConsulta.nome_cliente, 'GABRIEL MONTEIRO');
  assert.strictEqual(novaConsulta.tipo_consulta, 'irpf');
  console.log('  ✅ Consulta Rápida disparada com sucesso! ID:', novaConsulta.id);

  // Teste 2: Listagem de Consultas
  console.log('Test 2: Listagem de Consultas no Store');
  const lista = getConsultasRapidas();
  assert.ok(lista.length > 0, 'Deve haver ao menos 1 consulta na lista');
  const item = lista.find(c => c.id === novaConsulta.id);
  assert.ok(item !== undefined, 'A consulta criada deve estar presente');
  console.log('  ✅ Lista de consultas consultada com sucesso!\n');

  // Teste 3: Analista Preenche Checkbox e Envia Devolutiva
  console.log('Test 3: Analista Preenche Checkbox e Envia Devolutiva');
  const resposta = await responderConsultaRapida(
    novaConsulta.id,
    {
      pesquisa_limpa: true,
      possui_restricao: false,
      irpf_pendente: false,
      imovel_localizado: false,
      pendencia_documental: false
    },
    'Declaração de IRPF 2025 consultada na Receita Federal: processada e restituída, sem pendências de malha fina.',
    'Danilo Hasselmann'
  );

  assert.ok(resposta !== null);
  assert.strictEqual(resposta?.status, 'Respondido');
  assert.strictEqual(resposta?.resultado_checkboxes?.pesquisa_limpa, true);
  assert.strictEqual(resposta?.analista_responsavel, 'Danilo Hasselmann');
  console.log('  ✅ Devolutiva registrada com sucesso pelo analista:', resposta?.devolutiva_texto);
  console.log('  ✅ Status atualizado para:', resposta?.status, '\n');

  // Teste 4: Presença e Status Online/Offline dos Analistas
  console.log('Test 4: Alternância de Status Online / Offline dos Analistas');
  const analistasIniciais = getAnalistasPresenca();
  assert.ok(analistasIniciais.length > 0);

  // Alterna status para offline
  const atualizados = setAnalistaStatus('an-1', false, 'Danilo Hasselmann');
  const danilo = atualizados.find(a => a.nome === 'Danilo Hasselmann');
  assert.strictEqual(danilo?.isOnline, false);
  console.log('  ✅ Status alternado para OFFLINE com sucesso!');

  // Alterna status para online novamente
  const atualizadosOnline = setAnalistaStatus('an-1', true, 'Danilo Hasselmann');
  const daniloOnline = atualizadosOnline.find(a => a.nome === 'Danilo Hasselmann');
  assert.strictEqual(daniloOnline?.isOnline, true);
  console.log('  ✅ Status alternado para ONLINE com sucesso!\n');

  console.log('🎉 Todos os testes de Consultas Rápidas, Devolutivas e Presença foram aprovados!');
}

runConsultaRapidaTests().catch(err => {
  console.error('❌ Erro nos testes:', err);
  process.exit(1);
});
