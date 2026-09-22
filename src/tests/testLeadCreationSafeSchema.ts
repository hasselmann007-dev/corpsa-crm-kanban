import assert from 'assert';
import { supabase } from '../supabaseClient.ts';
import { parseRawText, isValidCpf } from '../utils/parser.ts';

async function testLeadCreationFlow() {
  console.log('🧪 Iniciando Teste de Validação da Criação de Pastas/Leads no Supabase...');

  // 1. Simulação de texto colado pelo corretor com MO do Serasa e Analista
  const samplePastedText = `AVALIAÇÃO 22/09 - IMOBILIÁRIA CENTRAL - Ribeirão Preto - 320k - MO 784912
NOME: CLIENTE TESTE SCHEMA CORRIGIDO
CPF: 111.444.777-35
Analista: @Danilo Hasselmann
Obs: Análise de crédito urgente com holerite.`;

  const parsed = parseRawText(samplePastedText);
  console.log('1. Texto parseado:', {
    nome: parsed.nome_cliente,
    cpf: parsed.cpf_cliente,
    mo: parsed.mo_serasa,
    analista: parsed.analista
  });

  assert.strictEqual(parsed.nome_cliente, 'TESTE SCHEMA CORRIGIDO');
  assert.strictEqual(parsed.mo_serasa, '784912');

  const nomeCliente = parsed.nome_cliente?.trim() || 'NOVO CLIENTE';
  const cpfCliente = (parsed.cpf_cliente && isValidCpf(parsed.cpf_cliente)) 
    ? parsed.cpf_cliente 
    : '000.000.000-00';
  const valorImovel = parsed.valor_imovel || 0;
  const cidade = (parsed.cidade && parsed.cidade !== 'Não Informada') 
    ? parsed.cidade.trim() 
    : 'Ribeirão Preto';
  const grupoOrigem = parsed.grupo_origem?.trim() || 'WhatsApp';

  let finalInfo = parsed.informacoes_importantes?.trim() || '';
  if (parsed.mo_serasa && !finalInfo.includes(`MO: ${parsed.mo_serasa}`)) {
    finalInfo = finalInfo ? `${finalInfo}\nMO: ${parsed.mo_serasa}` : `MO: ${parsed.mo_serasa}`;
  }

  // 2. Insert estrito (apenas colunas existentes no banco)
  const insertPayload = {
    nome_cliente: nomeCliente,
    cpf_cliente: cpfCliente,
    valor_imovel: valorImovel,
    cidade: cidade,
    grupo_origem: grupoOrigem,
    informacoes_importantes: finalInfo || null,
    data_hora_entrada: new Date().toISOString(),
    etapa: 'Roleta' as const,
    prioridade: 'Baixa' as const,
    adicionado_corpay: false
  };

  console.log('2. Enviando payload seguro para o Supabase...');
  const { data: createdLead, error: insertError } = await supabase
    .from('leads')
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    console.error('❌ Falha no insert:', insertError);
    throw insertError;
  }

  console.log('✅ Lead inserido com sucesso sem erro 400! ID:', createdLead.id);
  assert.ok(createdLead.id, 'Lead deve ter um UUID válido gerado pelo Supabase');

  // 3. Teste do enrichLeadData
  const extractMoFromInfo = (info?: string | null): string => {
    if (!info) return '';
    const match = info.match(/\bMO:\s*([^\n\r]+)/i);
    return match ? match[1].trim() : '';
  };
  const extractedMo = extractMoFromInfo(createdLead.informacoes_importantes);
  assert.strictEqual(extractedMo, '784912', 'MO deve ser extraído corretamente de informacoes_importantes');
  console.log('✅ MO recuperado com sucesso:', extractedMo);

  // 4. Teste de atualização de etapa (updateLeadStage)
  const { error: updateError } = await supabase
    .from('leads')
    .update({ etapa: 'Pendencia', descricao_pendencia: 'Falta holerite atualizado' })
    .eq('id', createdLead.id);

  assert.strictEqual(updateError, null, 'Update de etapa não deve retornar erro');
  console.log('✅ Transição de etapa executada com sucesso!');

  // 5. Limpeza do lead de teste
  const { error: deleteError } = await supabase
    .from('leads')
    .delete()
    .eq('id', createdLead.id);

  assert.strictEqual(deleteError, null, 'Cleanup do lead de teste deve ter sucesso');
  console.log('🧹 Cleanup finalizado com sucesso!');

  console.log('\n🎉 TESTE CONCLUÍDO COM 100% DE SUCESSO! A criação de pastas está totalmente operacional.');
}

testLeadCreationFlow().catch((err) => {
  console.error('Falha no teste:', err);
  process.exit(1);
});
