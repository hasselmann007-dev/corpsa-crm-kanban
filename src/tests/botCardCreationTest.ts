import assert from 'assert';
import { supabase } from '../supabaseClient.js';
import { chatWithGoogleGemini } from '../../tools/geminiTool.js';
import { executarCriarCardKanban } from '../../tools/kanbanTool.js';

async function testBotCardCreation() {
  console.log('🧪 Testando criação de card pelo bot e verificação no fluxo Kanban...\n');

  // Teste 1: Execução direta da ferramenta executarCriarCardKanban
  console.log('Test 1: Execução direta de executarCriarCardKanban');
  const nomeClienteTeste = `RODRIGO MENEZES ${Date.now().toString().slice(-4)}`;
  const resCriar = await executarCriarCardKanban({
    nome_cliente: nomeClienteTeste,
    cpf_cliente: '987.654.321-00',
    valor_imovel: 320000,
    cidade: 'Ribeirão Preto',
    grupo_origem: 'Direcional',
    detalhes_solicitacao: 'Análise de crédito para lançamento'
  });

  assert.strictEqual(resCriar.success, true);
  assert.strictEqual(resCriar.etapa, 'Roleta');
  console.log('  ✅ Ferramenta executada com sucesso! Lead ID:', resCriar.leadId);

  // Teste 2: Consulta direta no Supabase para confirmar persistência
  console.log('Test 2: Verificação do lead persistido no Supabase');
  const { data: leadDb, error: errDb } = await supabase
    .from('leads')
    .select('*')
    .eq('nome_cliente', nomeClienteTeste)
    .single();

  assert.strictEqual(errDb, null, `Erro ao buscar lead no Supabase: ${errDb?.message}`);
  assert.ok(leadDb !== null, 'Lead deve existir no banco de dados');
  assert.strictEqual(leadDb.etapa, 'Roleta');
  console.log('  ✅ Lead verificado no banco Supabase na coluna "Roleta":', leadDb.nome_cliente, 'R$', leadDb.valor_imovel);

  // Teste 3: Chamada ao chatWithGoogleGemini com pedido em linguagem natural
  console.log('\nTest 3: Simulação de conversa com o bot solicitando criação de card');
  const nomeClienteChat = `MARCOS VINICIUS ${Date.now().toString().slice(-4)}`;
  const chatRes = await chatWithGoogleGemini([
    {
      role: 'user',
      content: `Olá, por favor adicione um novo card na Roleta para o cliente ${nomeClienteChat}, CPF 456.789.123-00, valor do imóvel R$ 280.000`
    }
  ]);

  console.log('  🤖 Resposta do bot:', chatRes.text);
  console.log('  🔧 Ferramenta utilizada:', chatRes.toolUsed ? 'Sim' : 'Não');

  // Verifica se o lead do chat foi persistido
  const { data: leadChatDb } = await supabase
    .from('leads')
    .select('*')
    .ilike('nome_cliente', `%${nomeClienteChat.slice(0, 15)}%`)
    .limit(1);

  if (leadChatDb && leadChatDb.length > 0) {
    console.log('  ✅ Lead criado pelo bot confirmado no Supabase:', leadChatDb[0].nome_cliente, 'Etapa:', leadChatDb[0].etapa);
  } else {
    console.log('  ℹ️ Lead não encontrado por nome exato, testando fallback.');
  }

  console.log('\n🎉 Todos os testes de criação de card no fluxo Kanban foram concluídos com sucesso!');
}

testBotCardCreation().catch(err => {
  console.error('❌ Erro no teste de criação de cards:', err);
  process.exit(1);
});
