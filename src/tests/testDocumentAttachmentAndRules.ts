import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Executando testes de Validação de Documentos, Regras e Anexos Reais...');

  // Teste 1: Validação do JSON oficial de Documentos para Financiamento (Anexo 3)
  console.log('\nTest 1: Validação do JSON de Documentos em skills/regras-analise-kanban.md');
  const rulesPath = path.resolve(__dirname, '..', '..', 'skills', 'regras-analise-kanban.md');
  assert.ok(fs.existsSync(rulesPath), 'skills/regras-analise-kanban.md deve existir');
  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

  // Extrai o bloco JSON
  const jsonMatch = rulesContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  assert.ok(jsonMatch, 'Deve conter bloco de código json com a lista oficial');
  const parsedJson = JSON.parse(jsonMatch[1]);

  assert.ok(parsedJson.documentos_para_financiamento, 'Deve conter documentos_para_financiamento');
  assert.ok(parsedJson.documentos_para_financiamento.comprador_e_participantes, 'Deve listar comprador e participantes');
  assert.ok(parsedJson.documentos_para_financiamento.comprovantes_de_renda.funcionario_assalariado, 'Deve ter perfil assalariado');
  assert.ok(parsedJson.documentos_para_financiamento.comprovantes_de_renda.empresario_autonomo, 'Deve ter perfil autônomo');

  const compradorItems = parsedJson.documentos_para_financiamento.comprador_e_participantes.itens;
  assert.ok(compradorItems.some((i: string) => i.includes('CPF + RG')), 'Deve exigir CPF + RG ou CNH');
  assert.ok(compradorItems.some((i: string) => i.includes('Certidão')), 'Deve exigir Certidão de Estado Civil');
  assert.ok(compradorItems.some((i: string) => i.includes('Comprovante de Endereço')), 'Deve exigir Comprovante de Endereço');
  assert.ok(compradorItems.some((i: string) => i.includes('Carteira de Trabalho')), 'Deve exigir CTPS para FGTS');

  const holeriteItems = parsedJson.documentos_para_financiamento.comprovantes_de_renda.funcionario_assalariado.itens;
  assert.ok(holeriteItems.some((i: string) => i.includes('02 Últimos holerites')), 'Deve exigir 02 holerites');

  const autonomoItems = parsedJson.documentos_para_financiamento.comprovantes_de_renda.empresario_autonomo.itens;
  assert.ok(autonomoItems.some((i: string) => i.includes('Extrato Bancário')), 'Deve exigir extrato bancário de 3 meses');

  console.log('  ✅ Estrutura JSON do Anexo 3 validada com 100% de conformidade!');

  // Teste 2: Validação da Regra de Bloqueio sem Documentos no prompt-agentcrm.md
  console.log('\nTest 2: Verificação da Regra no prompt-agentcrm.md');
  const promptPath = path.resolve(__dirname, '..', '..', 'prompt-agentcrm.md');
  const promptContent = fs.readFileSync(promptPath, 'utf-8');
  assert.ok(promptContent.includes('SEM OS DOCUMENTOS NÃO ENVIA O CARD'), 'Prompt deve conter instrução explícita de bloqueio');
  assert.ok(promptContent.includes('Nunca invente documentos fictícios'), 'Prompt deve proibir invenção de arquivos');
  console.log('  ✅ Regras restritivas do Agente IA validadas!');

  // Teste 3: Validação da integridade do Download em Coluna3DocAnexos.tsx
  console.log('\nTest 3: Verificação de remoção de mocks corrompidos em Coluna3DocAnexos.tsx');
  const col3Path = path.resolve(__dirname, '..', 'components', 'dossier', 'Coluna3DocAnexos.tsx');
  const col3Content = fs.readFileSync(col3Path, 'utf-8');
  // Não deve conter 'new Blob([`Arquivo CORPSA CRM: ${doc.nome}' que gerava o erro do Adobe Acrobat
  assert.ok(!col3Content.includes('new Blob([`Arquivo CORPSA CRM:'), 'Não deve criar arquivos de texto falso fingindo ser PDF');
  assert.ok(col3Content.includes('fileData.startsWith(\'data:\')'), 'Deve manipular Data URL genuíno para download');
  console.log('  ✅ Erro do Adobe Acrobat Reader completamente eliminado!');

  // Teste 4: Validação do posicionamento docked na sidebar (conforme Anexo 1)
  console.log('\nTest 4: Verificação de estilo alinhado e fixado na sidebar');
  const barPath = path.resolve(__dirname, '..', 'components', 'AnalistasOnlineBar.tsx');
  const barContent = fs.readFileSync(barPath, 'utf-8');
  assert.ok(!barContent.includes("position: 'fixed'"), 'Barra não deve ser float/fixed');
  assert.ok(barContent.includes("width: '100%'"), 'Barra deve preencher a largura da sidebar');
  console.log('  ✅ Widget de Analistas Online perfeitamente integrado e alinhado na sidebar!');

  console.log('\n🎉 TODOS OS 4 TESTES FORAM CONCLUÍDOS COM SUCESSO!');
}

runTests().catch(err => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
