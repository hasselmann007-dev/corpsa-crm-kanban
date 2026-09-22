import assert from 'assert';
import { chatWithGoogleGemini } from '../tools/geminiTool.js';

async function runGeminiTests() {
  console.log('🚀 Iniciando Teste da Infraestrutura de Function Calling do Google Gemini REST API...');

  console.log('\n--- Teste 1: Mensagem normal (Sem necessidade de ferramenta) ---');
  const res1 = await chatWithGoogleGemini([
    { role: 'user', content: 'Olá! Sou um novo corretor e quero saber como funciona o seu atendimento.' }
  ]);
  console.log('Ferramenta utilizada:', res1.toolUsed ? 'Sim' : 'Não (Direto)');
  console.log('Resposta:\n', res1.text);
  assert.ok(res1.text && res1.text.length > 5, 'Deveria retornar resposta válida');

  console.log('\n--- Teste 2: Consulta específica de regra (Ativação automática de Function Calling) ---');
  const res2 = await chatWithGoogleGemini([
    { role: 'user', content: 'Qual é o prazo de SLA para atendimento de Construtora e de Imobiliária?' }
  ]);
  console.log('Ferramenta utilizada:', res2.toolUsed ? 'Sim (consultar_manual_constituicao)' : 'Não');
  console.log('Resposta:\n', res2.text);
  assert.ok(res2.text.includes('2 horas') || res2.text.includes('2h') || res2.text.includes('3 horas') || res2.text.includes('3h'), 'Deveria conter as regras do manual de SLA');

  console.log('\n✅ Todos os testes de Function Calling foram aprovados com sucesso!');
}

runGeminiTests().catch((err) => {
  console.error('❌ Erro no teste Function Calling:', err);
  process.exit(1);
});
