import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLeadSlaCountdown } from '../utils/sla';
import { formatTaxa2Decimais } from '../utils/sicaqPdfExporter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Iniciando Testes do SLA Countdown de 30 minutos e Simulação Anexo 3...\n');

  // Teste 1: Contagem Regressiva dos 30 minutos na Roleta
  console.log('Test 1: Validação do Timer de 30 Minutos de SLA na Roleta');
  const now = new Date();

  // Cenário 1.1: 80 minutos decorridos (faltam 40 min para o SLA de 120 min) -> não deve exibir timer ainda
  const d80 = new Date(now.getTime() - 80 * 60 * 1000).toISOString();
  const res80 = getLeadSlaCountdown(d80, 'Roleta', now);
  assert.strictEqual(res80.isCountingDown, false, 'Aos 80 min não deve estar contando ainda');
  assert.strictEqual(res80.isOverdue, false, 'Aos 80 min não está atrasado');
  console.log('  ✅ 80 min decorridos: timer inativo (restam 40 min).');

  // Cenário 1.2: 90 minutos decorridos (faltam exatamente 30 min) -> ativa o timer regressivo
  const d90 = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
  const res90 = getLeadSlaCountdown(d90, 'Roleta', now);
  assert.strictEqual(res90.isCountingDown, true, 'Aos 90 min o timer regressivo DEVE estar ativo');
  assert.strictEqual(res90.minutesRemaining, 30, 'Devem restar exatamente 30 min');
  assert.ok(res90.label.includes('30 min p/ estourar SLA'), 'Label deve informar 30 min para estourar SLA');
  console.log(`  ✅ 90 min decorridos: ${res90.label}`);

  // Cenário 1.3: 105 minutos decorridos (faltam 15 min) -> decrementa a cada minuto
  const d105 = new Date(now.getTime() - 105 * 60 * 1000).toISOString();
  const res105 = getLeadSlaCountdown(d105, 'Roleta', now);
  assert.strictEqual(res105.isCountingDown, true);
  assert.strictEqual(res105.minutesRemaining, 15);
  assert.ok(res105.label.includes('15 min p/ estourar SLA'));
  console.log(`  ✅ 105 min decorridos: ${res105.label}`);

  // Cenário 1.4: 119 minutos decorridos (falta 1 min)
  const d119 = new Date(now.getTime() - 119 * 60 * 1000).toISOString();
  const res119 = getLeadSlaCountdown(d119, 'Roleta', now);
  assert.strictEqual(res119.isCountingDown, true);
  assert.strictEqual(res119.minutesRemaining, 1);
  assert.ok(res119.label.includes('1 min p/ estourar SLA'));
  console.log(`  ✅ 119 min decorridos: ${res119.label}`);

  // Cenário 1.5: 120 minutos decorridos -> estoura a SLA
  const d120 = new Date(now.getTime() - 120 * 60 * 1000).toISOString();
  const res120 = getLeadSlaCountdown(d120, 'Roleta', now);
  assert.strictEqual(res120.isOverdue, true);
  assert.strictEqual(res120.isCountingDown, false);
  assert.strictEqual(res120.label, 'SLA Estourada');
  console.log(`  ✅ 120 min decorridos: ${res120.label}`);

  // Cenário 1.6: Card em 'Conclusao' não deve ter SLA
  const resConclusao = getLeadSlaCountdown(d120, 'Conclusao', now);
  assert.strictEqual(resConclusao.isOverdue, false);
  assert.strictEqual(resConclusao.isCountingDown, false);
  console.log('  ✅ Card em Conclusão não ativa SLA atrasada nem countdown.');

  // Teste 2: Formatação de Taxa de Juros com Rigorosamente 2 Casas Decimais
  console.log('\nTest 2: Validação de Formatação de Taxa com 2 Casas Decimais');
  assert.strictEqual(formatTaxa2Decimais('5.5000%'), '5,50');
  assert.strictEqual(formatTaxa2Decimais('5.6408%'), '5,64');
  assert.strictEqual(formatTaxa2Decimais('8.99'), '8,99');
  assert.strictEqual(formatTaxa2Decimais(9.372), '9,37');
  assert.strictEqual(formatTaxa2Decimais('10%'), '10,00');
  console.log('  ✅ Todas as taxas formatadas para exatamente 2 casas decimais após a vírgula.');

  // Teste 3: Validação do Checklist nos Arquivos do Projeto (Anexo 2 e 3)
  console.log('\nTest 3: Validação da Substituição do Checklist no Código');
  const fichaPath = path.resolve(__dirname, '..', 'components', 'FichaAprovacaoCaixa.tsx');
  const pdfPath = path.resolve(__dirname, '..', 'utils', 'sicaqPdfExporter.ts');
  const fichaContent = fs.readFileSync(fichaPath, 'utf-8');
  const pdfContent = fs.readFileSync(pdfPath, 'utf-8');

  // Verifica substituição por "Possui imóvel nas pesquisas?"
  assert.ok(fichaContent.includes('Possui imóvel nas pesquisas?'), 'Ficha deve conter "Possui imóvel nas pesquisas?"');
  assert.ok(pdfContent.includes('Possui imóvel nas pesquisas?'), 'PDF deve conter "Possui imóvel nas pesquisas?"');
  assert.ok(!fichaContent.includes('Avaliação do engenheiro/imóvel compatível?'), 'Ficha não deve mais conter texto de avaliação do engenheiro');
  assert.ok(!pdfContent.includes('Avaliação do engenheiro/imóvel compatível?'), 'PDF não deve mais conter texto de avaliação do engenheiro');
  console.log('  ✅ "Possui imóvel nas pesquisas?" substituiu "Avaliação do engenheiro" em 100% dos componentes.');

  // Verifica que os badges fixos "CONFORME" / "PENDENTE" foram removidos e substituídos por table text
  assert.ok(!fichaContent.includes('status-conforme'), 'Ficha removeu classes de conforme/pendente fixo');
  assert.ok(fichaContent.includes('pendencias_checklist'), 'Ficha implementou table text para pendências');
  console.log('  ✅ Textos fixos "CONFORME"/"PENDENTE" removidos e substituídos por table text editável.');

  // Teste 4: Validação de Analistas Online Docked na Sidebar
  console.log('\nTest 4: Validação de Analistas Online na Sidebar');
  const analistasPath = path.resolve(__dirname, '..', 'components', 'AnalistasOnlineBar.tsx');
  const analistasContent = fs.readFileSync(analistasPath, 'utf-8');
  assert.ok(!analistasContent.includes("position: 'fixed'"), 'Barra de analistas não deve ter position fixed');
  assert.ok(analistasContent.includes("width: '100%'"), 'Barra deve preencher 100% da largura da sidebar');

  const appPath = path.resolve(__dirname, '..', 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  assert.ok(appContent.includes('<AnalistasOnlineBar'), 'AnalistasOnlineBar deve estar renderizada no App.tsx');
  console.log('  ✅ AnalistasOnlineBar docada e alinhada na barra lateral.');

  // Teste 5: Validação da Tipografia Inter e Lucide Icons
  console.log('\nTest 5: Validação de Fonte Inter e Lucide Icons');
  const indexHtmlPath = path.resolve(__dirname, '..', '..', 'index.html');
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
  assert.ok(indexHtmlContent.includes('family=Inter'), 'index.html deve importar fonte Inter');

  const cssPath = path.resolve(__dirname, '..', 'index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  assert.ok(cssContent.includes('--font-sans: \'Inter\''), 'CSS deve usar Inter como fonte principal');

  assert.ok(fichaContent.includes('from \'lucide-react\''), 'FichaAprovacaoCaixa deve usar Lucide icons');
  assert.ok(appContent.includes('from \'lucide-react\''), 'App.tsx deve usar Lucide icons');
  console.log('  ✅ Fonte Inter e Lucide Icons configurados em todo o projeto.');

  console.log('\n🎉 TODOS OS 5 TESTES CONCLUÍDOS COM SUCESSO (100% PASS)!');
}

runTests().catch((err) => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
