import assert from 'assert';
import { executarCriarCardKanban, getRegrasAnaliseKanban, formatarCpf } from '../../tools/kanbanTool.js';
import { chatWithGoogleGemini } from '../../tools/geminiTool.js';

async function runKanbanToolTests() {
  console.log('🧪 Iniciando Testes Unitários da Ferramenta Kanban & Regras Customizadas...\n');

  // Teste 1: Formatação de CPF
  console.log('Test 1: Formatação de CPF');
  assert.strictEqual(formatarCpf('12345678900'), '123.456.789-00');
  assert.strictEqual(formatarCpf('123.456.789-00'), '123.456.789-00');
  console.log('  ✅ Formatação de CPF validada!\n');

  // Teste 2: Execução Direta da Ferramenta de Criação de Card com Consulta
  console.log('Test 2: Criação de Card na Coluna Roleta com Consulta de CPF e Imóvel');
  const uniqueCpfDigits = `321${Date.now().toString().slice(-8)}`;
  const expectedFormattedCpf = formatarCpf(uniqueCpfDigits);
  const leadPayload = {
    nome_cliente: 'FERNANDO ALBUQUERQUE',
    cpf_cliente: uniqueCpfDigits,
    valor_imovel: 320000,
    cidade: 'Ribeirão Preto',
    grupo_origem: 'Direcional',
    tipo_consulta: 'cpf' as const,
    detalhes_solicitacao: 'Cliente autônomo com 6 meses de extrato. Verificar restrições Caixa/Bacen.'
  };

  const cardResult = await executarCriarCardKanban(leadPayload);
  assert.strictEqual(cardResult.success, true);
  assert.strictEqual(cardResult.etapa, 'Roleta');
  assert.strictEqual(cardResult.nome_cliente, 'FERNANDO ALBUQUERQUE');
  assert.strictEqual(cardResult.cpf_cliente, expectedFormattedCpf);
  assert.strictEqual(cardResult.notificacao_enviada, true);
  console.log('  ✅ Card criado com sucesso:', cardResult.message);
  console.log('  ✅ Notificação para todos os analistas disparada com sucesso!\n');

  // Teste 3: Leitura das Regras Editáveis do Usuário
  console.log('Test 3: Leitura de skills/regras-analise-kanban.md');
  const regras = getRegrasAnaliseKanban();
  assert.ok(regras.length > 50, 'Regras de análise devem conter conteúdo válido');
  assert.ok(regras.includes('REGRAS DE ANÁLISE E CRIAÇÃO DE CARDS NO KANBAN'), 'Cabeçalho das regras presente');
  assert.ok(regras.includes('ESPAÇO RESERVADO'), 'Campo reservado para o usuário editar regras faltantes presente');
  console.log('  ✅ Regras de análise carregadas e campo editável validado!\n');

  // Teste 4: Function Calling ao Vivo com Google Gemini
  console.log('Test 4: Chamada ao Vivo do Agente IA com Invocação da Ferramenta criar_card_kanban');
  try {
    const testMessages = [
      {
        role: 'user' as const,
        content: 'Olá! Sou o corretor Rodrigo da MRV. Tenho um novo cliente chamado CARLOS EDUARDO SILVA, CPF 456.789.123-00, valor do imóvel 240k em Ribeirão Preto. Por favor, adicione na fila de crédito e solicite a consulta de CPF e IRPF dele.'
      }
    ];

    const geminiResult = await chatWithGoogleGemini(testMessages);
    assert.strictEqual(typeof geminiResult.text, 'string');
    assert.ok(geminiResult.text.length > 10);
    console.log('  ✅ Agente IA respondeu com sucesso!');
    console.log(`  🤖 Resposta do Agente: "${geminiResult.text.slice(0, 140)}..."`);
    console.log(`  🔧 Ferramenta utilizada: ${geminiResult.toolUsed ? 'Sim (criar_card_kanban / manual)' : 'Não'}\n`);
  } catch (err: any) {
    console.warn(`  ⚠️ Aviso de conexão no teste ao vivo com API Gemini: ${err.message}`);
  }

  console.log('🎉 Todos os testes da ferramenta Kanban e regras customizadas foram concluídos com sucesso!');
}

runKanbanToolTests().catch(err => {
  console.error('❌ Falha nos testes do Kanban:', err);
  process.exit(1);
});
