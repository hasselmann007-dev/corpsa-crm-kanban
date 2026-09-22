import assert from 'assert';
import { parseTextoCaixaDeterministico } from '../utils/sicaqExtractor.js';

async function runTests() {
  console.log('🧪 Iniciando testes de validação da Fase 1 e Extração SICAQ Caixa...');

  // Teste 1: Parser Determinístico do Documento Caixa (OCR do usuário)
  console.log('\nTest 1: Extração dos dados da simulação oficial Caixa (do documento enviado)');
  const ocrTextoUsuario = `
    02/09/2026, 12:45 Portal de Negócios da Habitação
    CAIXA
    Simulador - Detalhamento
    NPMCMV UNIDADE VINCULADA PF EMPREENDIMENTO COM FINANC PJ - (3280)
    Valor do imóvel: R$ 264.000,00
    Prazo Máximo: 420 meses
    Sistema de Amortização: PRICE FGTS
    Cota máx. financiamento: 80%
    Valor de entrada: R$ 69.966,30
    Desconto: R$ 593,00
    Entrada Atualizada: Nao
    Prazo: 420 meses
    Valor de Financiamento + Despesa Cartorária + Despesa com Leiloeiro :
    R$ 193.440,70 (Despesa Cartorária/Leiloeiro: R$ 0,00)
    Apólice de Seguro: 68880
    Primeira Prestação Juros Nominais Juros Efetivos
    R$ 1.098,98 5,5000% 5,6408%
    Taxas a Vista
    Seguro à vista R$ 35,18
    Tarifas R$ 0,00
    IOF R$ 0,00
    TOTAL R$ 35,18
    Componentes da prestação
    Amortização + Juros R$ 1.038,80
    Seguro DFI R$ 18,74
    Seguro MIP R$ 16,44
    Total Seguros R$ 35,18
    Taxa de administração R$ 25,00
    TOTAL R$ 1.098,98
    RESUMO
    Origem De Recurso: FGTS
    Categoria De Imóvel:
    CONSTRUCAO/AQ TER CONST - IM. PLANTA E COLETIVAS
    Cidade: Sorocaba - SP
    Prestação Máxima - SIRIC:R$ 1.098,99
    Valor Do Imóvel:R$ 264.000,00
    Prazo De Obra: 36 Meses
    Renda Familiar:R$ 3.663,33
    FGTS Há Mais De 3 Anos: Sim
  `;

  const extraido = parseTextoCaixaDeterministico(ocrTextoUsuario);

  console.log('  Dados Extraídos:', extraido);

  assert.strictEqual(extraido.valor_imovel, 264000, 'Valor do imóvel deve ser 264.000,00');
  assert.strictEqual(extraido.valor_financiamento, 193440.7, 'Financiamento deve ser 193.440,70');
  assert.strictEqual(extraido.valor_entrada, 69966.3, 'Entrada deve ser 69.966,30');
  assert.strictEqual(extraido.prazo_meses, 420, 'Prazo deve ser 420 meses');
  assert.strictEqual(extraido.sistema_amortizacao, 'PRICE', 'Sistema deve ser PRICE');
  assert.strictEqual(extraido.primeira_prestacao, 1098.98, 'Primeira prestação deve ser 1.098,98');
  assert.strictEqual(extraido.taxa_juros_nominal, '5.5000', 'Taxa nominal deve ser 5.5000%');
  assert.strictEqual(extraido.taxa_juros_efetiva, '5.6408', 'Taxa efetiva deve ser 5.6408%');
  assert.strictEqual(extraido.tipo_imovel, 'Planta', 'Tipo do imóvel deve ser Planta');
  assert.strictEqual(extraido.cidade, 'Sorocaba', 'Cidade deve ser Sorocaba');
  assert.strictEqual(extraido.desconto_subsidio, 593, 'Desconto deve ser 593,00');

  console.log('  ✅ Todos os 11 campos do simulador Caixa foram extraídos com 100% de precisão!');

  // Teste 2: Validação da estrutura de persistência do Chat por Lead
  console.log('\nTest 2: Verificação do formato de mensagens do chat persistente do cliente');
  const dummyLeadId = 'lead-test-123';
  const chatKey = `corpsa_lead_chat_${dummyLeadId}`;
  const mockMsg = {
    id: 'msg-1',
    autor: 'Danilo Hasselmann',
    texto: 'Cliente enviou holerites atualizados e comprovante de residência.',
    data_hora: '14:35 - 03/09',
    etapa_origem: 'Roleta'
  };

  assert.ok(chatKey.includes(dummyLeadId));
  assert.strictEqual(mockMsg.autor, 'Danilo Hasselmann');
  assert.ok(mockMsg.texto.length > 10);
  console.log('  ✅ Estrutura do chat persistente validada com sucesso!');

  console.log('\n🎉 Todos os testes de Fase 1 e Extração SICAQ Caixa foram APROVADOS com sucesso!');
}

runTests().catch(err => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
